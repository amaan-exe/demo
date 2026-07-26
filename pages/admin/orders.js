import { useEffect, useState, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/AdminLayout'

const getInitials = (nameStr) => {
  if (!nameStr) return 'CU'
  const parts = nameStr.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
  }
  return parts[0].slice(0, 2).toUpperCase()
}

const getStatusMeta = (status, isDelivered, isCancelled) => {
  if (isDelivered) return { color: '#047857', bg: '#e6f4ea', text: 'DELIVERED', icon: '🟢' }
  if (isCancelled) return { color: '#dc2626', bg: '#fce8e6', text: 'CANCELLED', icon: '🔴' }
  switch (status) {
    case 'UPI Verification Pending':
      return { color: '#b45309', bg: '#fef3c7', text: 'UPI VERIFICATION REQUIRED', icon: '💳' }
    case 'Pending':
      return { color: '#d97706', bg: '#fef3c7', text: 'PENDING CONFIRMATION', icon: '⏳' }
    case 'Accepted':
      return { color: '#1a73e8', bg: '#e8f0fe', text: 'ACCEPTED', icon: '👍' }
    case 'Preparing':
      return { color: '#d97706', bg: '#fef3c7', text: 'PREPARING IN KITCHEN', icon: '👨‍🍳' }
    case 'Ready':
      return { color: '#7e22ce', bg: '#f3e8ff', text: 'READY FOR PICKUP', icon: '🍱' }
    case 'Out For Delivery':
      return { color: '#0891b2', bg: '#e0f2fe', text: 'OUT FOR DELIVERY', icon: '🛵' }
    default:
      return { color: '#047857', bg: '#e6f4ea', text: (status || 'CONFIRMED').toUpperCase(), icon: '📦' }
  }
}

export default function AdminOrdersDesk() {
  const { user, isAdmin } = useAuth()
  const [orders, setOrders] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const [mounted, setMounted] = useState(false)
  const [firestoreError, setFirestoreError] = useState(null)
  const [actionFeedback, setActionFeedback] = useState(null)
  const prevOrderCount = useRef(0)
  const isFirstLoad = useRef(true)

  // Click outside to close status dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setMounted(true)

    const fetchAllOrders = async () => {
      try {
        const res = await fetch('/api/orders/admin-all')
        if (res.ok) {
          const data = await res.json()
          if (data.orders && data.orders.length) {
            setOrders(prev => {
              const combined = [...prev]
              data.orders.forEach(o => {
                const idx = combined.findIndex(item => item.id === o.id)
                if (idx >= 0) {
                  combined[idx] = { ...combined[idx], ...o }
                } else {
                  combined.push(o)
                }
              })
              return combined.sort((a, b) => (b.createdAtSeconds || 0) - (a.createdAtSeconds || 0))
            })
          }
        }
      } catch (err) {}
    }

    fetchAllOrders()

    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setFirestoreError(null)
      const fetched = snapshot.docs.map((d) => {
        const data = d.data()
        let dateObj = new Date()
        if (data.createdAt?.toDate) {
          dateObj = data.createdAt.toDate()
        } else if (data.createdAtSeconds) {
          dateObj = new Date(data.createdAtSeconds * 1000)
        }

        const createdAtFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
          ' (' + dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')'

        return {
          id: d.id,
          ...data,
          createdAtFormatted,
          createdAtSeconds: Math.floor(dateObj.getTime() / 1000)
        }
      })

      fetched.sort((a, b) => (b.createdAtSeconds || 0) - (a.createdAtSeconds || 0))

      if (!isFirstLoad.current && fetched.length > prevOrderCount.current) {
        try {
          const audio = new Audio('/sounds/notification.mp3')
          audio.play().catch(() => {})
        } catch (e) {}
      }

      isFirstLoad.current = false
      prevOrderCount.current = fetched.length
      setOrders(fetched)
    }, (err) => {
      setFirestoreError('Real-time sync paused. Fetching fallback data...')
      fetchAllOrders()
    })

    return () => unsub()
  }, [])

  const triggerFeedback = (msg) => {
    setActionFeedback(msg)
    setTimeout(() => setActionFeedback(null), 3500)
  }

  const handleUpdateStatus = async (orderId, newStatus) => {
    let newPaymentStatus = undefined
    if (newStatus === 'Delivered') {
      newPaymentStatus = 'paid'
    } else if (newStatus === 'Cancelled') {
      newPaymentStatus = 'rejected'
    }

    try {
      const targetDoc = doc(db, 'orders', orderId)
      const updateData = { orderStatus: newStatus, updatedAt: serverTimestamp() }
      if (newPaymentStatus) updateData.paymentStatus = newPaymentStatus
      await updateDoc(targetDoc, updateData)

      fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus, paymentStatus: newPaymentStatus })
      }).catch(() => {})

      triggerFeedback(`Order status updated to ${newStatus}`)
    } catch (e) {
      triggerFeedback(`Status update error: ${e.message}`)
    }
  }

  const handleApprovePayment = async (orderId) => {
    try {
      const targetDoc = doc(db, 'orders', orderId)
      await updateDoc(targetDoc, {
        paymentStatus: 'paid',
        orderStatus: 'Accepted',
        updatedAt: serverTimestamp()
      })

      fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: 'Accepted', paymentStatus: 'paid' })
      }).catch(() => {})

      triggerFeedback(`UPI Payment Verified! Order moved to Accepted.`)
    } catch (e) {
      triggerFeedback(`Error approving payment: ${e.message}`)
    }
  }

  const handleRejectPayment = async (orderId) => {
    if (!confirm('Reject UPI payment and cancel order?')) return
    try {
      const targetDoc = doc(db, 'orders', orderId)
      await updateDoc(targetDoc, {
        paymentStatus: 'rejected',
        orderStatus: 'Cancelled',
        updatedAt: serverTimestamp()
      })

      fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: 'Cancelled', paymentStatus: 'rejected' })
      }).catch(() => {})

      triggerFeedback(`UPI Payment Rejected. Order Cancelled.`)
    } catch (e) {
      triggerFeedback(`Error rejecting payment: ${e.message}`)
    }
  }

  // Calculate Metrics
  const countUpiPending = orders.filter(o => o.paymentStatus === 'verification_pending' || o.paymentStatus === 'Verification Pending' || o.orderStatus === 'payment_verification_pending').length
  const countPending = orders.filter(o => o.orderStatus === 'Pending' || o.orderStatus === 'pending').length
  const countAccepted = orders.filter(o => o.orderStatus === 'Accepted' || o.orderStatus === 'accepted').length
  const countPreparing = orders.filter(o => o.orderStatus === 'Preparing' || o.orderStatus === 'preparing').length
  const countReady = orders.filter(o => o.orderStatus === 'Ready' || o.orderStatus === 'ready').length
  const countOut = orders.filter(o => o.orderStatus === 'Out For Delivery' || o.orderStatus === 'out_for_delivery').length
  const countDelivered = orders.filter(o => o.orderStatus === 'Delivered' || o.orderStatus === 'delivered').length
  const countCancelled = orders.filter(o => o.orderStatus === 'Cancelled' || o.orderStatus === 'cancelled' || o.orderStatus === 'rejected').length

  // Filter Logic
  const filteredOrders = orders.filter((o) => {
    // 1. Status Filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'UPI Verification Pending') {
        const isUpi = o.paymentStatus === 'verification_pending' || o.paymentStatus === 'Verification Pending' || o.orderStatus === 'payment_verification_pending'
        if (!isUpi) return false
      } else {
        if ((o.orderStatus || '').toLowerCase() !== filterStatus.toLowerCase()) return false
      }
    }

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const nameMatch = (o.customerName || o.userName || '').toLowerCase().includes(q)
      const phoneMatch = (o.customerPhone || o.userPhone || '').toLowerCase().includes(q)
      const idMatch = (o.orderId || o.id || '').toLowerCase().includes(q)
      const addressMatch = (o.deliveryAddress || '').toLowerCase().includes(q)
      return nameMatch || phoneMatch || idMatch || addressMatch
    }

    return true
  })

  if (!user || !isAdmin) return null

  return (
    <AdminLayout activePage="orders" title="Orders Dashboard">
      <Head>
        <title>Orders Dashboard | Biriyani Station Admin</title>
      </Head>

      <div className="admin-page-container">
        {/* Action Feedback Toast */}
        {actionFeedback && (
          <div style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            background: 'var(--ink, #0c0c0b)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            fontSize: '0.86rem',
            fontWeight: 800,
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            {actionFeedback}
          </div>
        )}

        {/* HERO CONTROL CARD */}
        <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', marginBottom: '24px' }}>
          {/* Header Row: Title & Search/Filter Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.12em', color: 'var(--deep-green)', textTransform: 'uppercase' }}>
                <span style={{ animation: 'pulse 1.5s infinite' }}>🟢</span> LIVE ORDER STREAM
              </span>
              <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)', fontWeight: 900, color: 'var(--ink)', margin: '2px 0 0 0' }}>
                Orders Dashboard
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--muted)', fontWeight: 600 }}>
                Manage and track live customer orders
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '640px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
              {/* Standout Search Box */}
              <div className="admin-search-box" style={{ flex: '1 1 240px' }}>
                <span className="admin-search-icon" style={{ color: 'var(--deep-green)', opacity: 1 }}>🔍</span>
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Search Order ID, Phone, Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="admin-search-clear" onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>

              {/* Custom Status Dropdown Menu (Opens Inwards) */}
              <div ref={dropdownRef} style={{ position: 'relative', flex: '1 1 180px', minWidth: '160px', maxWidth: '240px' }}>
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(13,90,58,0.18)',
                    background: '#ffffff',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    outline: 'none'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span>
                      {filterStatus === 'all' ? '📦' :
                       filterStatus === 'UPI Verification Pending' ? '💳' :
                       filterStatus === 'Pending' ? '⏳' :
                       filterStatus === 'Accepted' ? '👍' :
                       filterStatus === 'Preparing' ? '👨‍🍳' :
                       filterStatus === 'Ready' ? '🍱' :
                       filterStatus === 'Out For Delivery' ? '🛵' :
                       filterStatus === 'Delivered' ? '✅' : '❌'}
                    </span>
                    <span>
                      {filterStatus === 'all' ? `All (${orders.length})` :
                       filterStatus === 'UPI Verification Pending' ? `UPI (${countUpiPending})` :
                       filterStatus === 'Pending' ? `Pending (${countPending})` :
                       filterStatus === 'Accepted' ? `Accepted (${countAccepted})` :
                       filterStatus === 'Preparing' ? `Preparing (${countPreparing})` :
                       filterStatus === 'Ready' ? `Ready (${countReady})` :
                       filterStatus === 'Out For Delivery' ? `Out Delivery (${countOut})` :
                       filterStatus === 'Delivered' ? `Delivered (${countDelivered})` : `Cancelled (${countCancelled})`}
                    </span>
                  </span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.6, transform: statusDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', marginLeft: '6px' }}>▼</span>
                </button>

                {statusDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      background: '#ffffff',
                      borderRadius: '14px',
                      border: '1px solid rgba(13,90,58,0.18)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                      padding: '6px',
                      minWidth: '220px',
                      maxWidth: 'calc(100vw - 32px)',
                      zIndex: 2000,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    {[
                      { id: 'all', label: 'All Orders', icon: '📦', count: orders.length },
                      { id: 'UPI Verification Pending', label: 'UPI Verification', icon: '💳', count: countUpiPending, highlight: countUpiPending > 0 },
                      { id: 'Pending', label: 'Pending Confirmation', icon: '⏳', count: countPending, highlight: countPending > 0 },
                      { id: 'Accepted', label: 'Accepted Orders', icon: '👍', count: countAccepted },
                      { id: 'Preparing', label: 'Preparing in Kitchen', icon: '👨‍🍳', count: countPreparing },
                      { id: 'Ready', label: 'Ready for Pickup', icon: '🍱', count: countReady },
                      { id: 'Out For Delivery', label: 'Out For Delivery', icon: '🛵', count: countOut },
                      { id: 'Delivered', label: 'Delivered & Closed', icon: '✅', count: countDelivered },
                      { id: 'Cancelled', label: 'Cancelled Orders', icon: '❌', count: countCancelled }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setFilterStatus(opt.id)
                          setStatusDropdownOpen(false)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: filterStatus === opt.id ? 'rgba(13,90,58,0.08)' : 'transparent',
                          color: filterStatus === opt.id ? 'var(--deep-green)' : 'var(--ink)',
                          fontWeight: filterStatus === opt.id ? 900 : 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </span>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: opt.highlight ? '#f59e0b' : 'rgba(0,0,0,0.06)',
                          color: opt.highlight ? '#ffffff' : 'var(--ink)'
                        }}>
                          {opt.count}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Descriptive Flat Stat Cards (12px Radius, 16px Spacing) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {/* Card 1: All Orders */}
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              style={{
                borderRadius: '12px',
                padding: '14px 16px',
                border: filterStatus === 'all' ? '2px solid var(--deep-green)' : '1px solid rgba(0,0,0,0.06)',
                background: filterStatus === 'all' ? 'rgba(13,90,58,0.05)' : '#fafaf5',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                transition: 'all 0.18s ease'
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                📦 ALL ORDERS
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--deep-green)', marginTop: '4px' }}>
                {orders.length} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' }}>total</span>
              </div>
            </button>

            {/* Card 2: Requires Attention */}
            <button
              type="button"
              onClick={() => setFilterStatus(countUpiPending > 0 ? 'UPI Verification Pending' : 'Pending')}
              style={{
                borderRadius: '12px',
                padding: '14px 16px',
                border: (countUpiPending + countPending) > 0 ? '1.5px solid #f59e0b' : '1px solid rgba(0,0,0,0.06)',
                background: (countUpiPending + countPending) > 0 ? '#fffbeb' : '#fafaf5',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                transition: 'all 0.18s ease'
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: (countUpiPending + countPending) > 0 ? '#b45309' : 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⚡ REQUIRES ATTENTION
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: (countUpiPending + countPending) > 0 ? '#b45309' : 'var(--ink)', marginTop: '4px' }}>
                {countUpiPending + countPending} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: (countUpiPending + countPending) > 0 ? '#d97706' : 'var(--muted)' }}>pending</span>
              </div>
            </button>

            {/* Card 3: Kitchen & Transit */}
            <button
              type="button"
              onClick={() => setFilterStatus('Preparing')}
              style={{
                borderRadius: '12px',
                padding: '14px 16px',
                border: filterStatus === 'Preparing' ? '2px solid var(--deep-green)' : '1px solid rgba(0,0,0,0.06)',
                background: filterStatus === 'Preparing' ? 'rgba(13,90,58,0.05)' : '#fafaf5',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                transition: 'all 0.18s ease'
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                👨‍🍳 KITCHEN & TRANSIT
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--ink)', marginTop: '4px' }}>
                {countPreparing + countReady + countOut} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' }}>active</span>
              </div>
            </button>

            {/* Card 4: Delivered & Closed */}
            <button
              type="button"
              onClick={() => setFilterStatus('Delivered')}
              style={{
                borderRadius: '12px',
                padding: '14px 16px',
                border: filterStatus === 'Delivered' ? '2px solid var(--deep-green)' : '1px solid rgba(0,0,0,0.06)',
                background: filterStatus === 'Delivered' ? 'rgba(13,90,58,0.05)' : '#fafaf5',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                transition: 'all 0.18s ease'
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ✅ DELIVERED & CLOSED
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--deep-green)', marginTop: '4px' }}>
                {countDelivered} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' }}>completed</span>
              </div>
            </button>
          </div>
        </div>

        {/* 2-COLUMN RESPONSIVE ORDERS CARDS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {filteredOrders.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', textAlign: 'center', border: '1px dashed rgba(0,0,0,0.12)' }}>
              <p style={{ color: 'var(--muted)', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                {searchQuery ? `No orders matching "${searchQuery}"` : 'No orders found under this status filter.'}
              </p>
            </div>
          ) : (
            filteredOrders.map((ord) => {
              const isDelivered = ord.orderStatus === 'Delivered' || ord.orderStatus === 'delivered'
              const isCancelled = ord.orderStatus === 'Cancelled' || ord.orderStatus === 'cancelled' || ord.orderStatus === 'rejected' || ord.orderStatus === 'Payment Failed' || ord.paymentStatus === 'rejected' || ord.paymentStatus === 'Payment Failed'
              const isLocked = isDelivered || isCancelled
              const customerName = ord.customerName || ord.userName || 'Customer'
              const initials = getInitials(customerName)
              const rawPhone = (ord.customerPhone || ord.userPhone || '').replace(/[^0-9]/g, '')
              const waMessage = encodeURIComponent(`Hi ${customerName}, updating you regarding your Biriyani Station Patna Order #${ord.orderId || ord.id.slice(0, 8)} (Status: ${ord.orderStatus || 'Confirmed'}).`)
              const statusMeta = getStatusMeta(ord.orderStatus, isDelivered, isCancelled)

              return (
                <div
                  key={ord.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    position: 'relative'
                  }}
                >
                  {/* TOP COLORED STATUS ACCENT BAR (Instant visual identity for staff) */}
                  <div style={{ height: '5px', width: '100%', background: statusMeta.color }} />

                  <div style={{ padding: '16px 18px' }}>
                    {/* Top Status Strip Banner */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      padding: '6px 12px',
                      background: statusMeta.bg,
                      borderRadius: '8px',
                      marginBottom: '14px'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: statusMeta.color, letterSpacing: '0.04em' }}>
                        {statusMeta.icon} {statusMeta.text}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)' }}>
                        🕒 {ord.createdAtFormatted}
                      </span>
                    </div>

                    {/* Customer Info & Prominent Order ID */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* 2-Letter Initials Avatar */}
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: 'var(--deep-green)',
                          color: '#ffffff',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 900,
                          fontSize: '0.92rem',
                          flexShrink: 0
                        }}>
                          {initials}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                              {customerName}
                            </h3>
                            {rawPhone && (
                              <a
                                href={`https://wa.me/91${rawPhone}?text=${waMessage}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ padding: '2px 8px', fontSize: '0.7rem', fontWeight: 800, background: '#25d366', color: '#ffffff', borderRadius: '6px', textDecoration: 'none' }}
                              >
                                WhatsApp 💬
                              </a>
                            )}
                          </div>
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 700 }}>
                            📞 {ord.customerPhone || ord.userPhone || 'No Phone'}
                          </p>
                        </div>
                      </div>

                      {/* Prominent Brand Green Order ID */}
                      <span style={{
                        fontSize: '1.05rem',
                        fontWeight: 900,
                        color: 'var(--deep-green)',
                        background: 'rgba(13,90,58,0.08)',
                        border: '1px solid rgba(13,90,58,0.18)',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        letterSpacing: '0.04em'
                      }}>
                        #{ord.orderId || ord.id.slice(0, 8)}
                      </span>
                    </div>

                    {/* Delivery Location */}
                    <div style={{ background: '#faf9f5', borderRadius: '10px', padding: '8px 12px', marginBottom: '14px', fontSize: '0.8rem', color: 'var(--ink)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📍</span>
                      <span style={{ wordBreak: 'break-word' }}>{ord.deliveryAddress || 'Patna Delivery Address'}</span>
                    </div>

                    {/* Payment Info & Items List Split */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '10px', marginBottom: '14px' }}>
                      {/* Left: Scannable Payment Card */}
                      <div style={{
                        background: (ord.paymentStatus === 'paid' || ord.paymentStatus === 'Paid') ? '#e6f4ea' : isCancelled ? '#fce8e6' : '#fef3c7',
                        borderRadius: '12px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justify: 'space-between',
                        border: '1px solid rgba(0,0,0,0.05)'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            💳 {ord.paymentMethod === 'UPI' ? 'UPI Online' : 'Cash on Delivery'}
                          </div>

                          <div style={{ fontSize: '0.78rem', fontWeight: 900, marginTop: '4px', color: (ord.paymentStatus === 'paid' || ord.paymentStatus === 'Paid') ? '#047857' : isCancelled ? '#dc2626' : '#b45309' }}>
                            {(ord.paymentStatus === 'paid' || ord.paymentStatus === 'Paid') ? '🟢 Paid' : isCancelled ? '🔴 Rejected' : '🟡 Verification Pending'}
                          </div>

                          {ord.transactionReference && (
                            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>
                              👤 {ord.transactionReference}
                            </div>
                          )}
                        </div>

                        {!isLocked && (ord.paymentStatus === 'verification_pending' || ord.paymentStatus === 'Verification Pending' || ord.orderStatus === 'payment_verification_pending') && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                            <button
                              type="button"
                              onClick={() => handleApprovePayment(ord.id)}
                              style={{ background: 'var(--deep-green)', color: '#ffffff', border: 'none', padding: '6px', borderRadius: '6px', fontWeight: 900, fontSize: '0.72rem', cursor: 'pointer', width: '100%' }}
                            >
                              Approve ✅
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectPayment(ord.id)}
                              style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 8px', borderRadius: '6px', fontWeight: 900, fontSize: '0.72rem', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right: Items & Prominent 22-24px Total */}
                      <div style={{ background: '#fafaf5', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '80px', overflowY: 'auto' }}>
                          {ord.items?.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                              <span><strong style={{ color: 'var(--deep-green)' }}>{item.qty || item.quantity}x</strong> {item.title || item.name}</span>
                              <span style={{ fontWeight: 700, color: 'var(--muted)' }}>₹{((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(0)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Prominent Total Amount (22-24px bold) */}
                        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: '6px', paddingTop: '4px', textAlign: 'right' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--muted)', display: 'block' }}>TOTAL AMOUNT</span>
                          <strong style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--deep-green)', lineHeight: 1.1 }}>
                            ₹{(ord.grandTotal || 0).toFixed(0)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Pipeline Controls / Concise Action Badges */}
                    <div>
                      {isDelivered ? (
                        <div style={{ padding: '8px 12px', borderRadius: '10px', background: '#e6f4ea', color: '#047857', fontWeight: 900, fontSize: '0.82rem', textAlign: 'center' }}>
                          Delivered ✓
                        </div>
                      ) : isCancelled ? (
                        <div style={{ padding: '8px 12px', borderRadius: '10px', background: '#fce8e6', color: '#dc2626', fontWeight: 900, fontSize: '0.82rem', textAlign: 'center' }}>
                          ❌ Cancelled
                        </div>
                      ) : (
                        <div className="pipeline-container" style={{ margin: 0, padding: '6px', gap: '4px' }}>
                          {[
                            { key: 'Accepted', label: 'Accept', color: '#1a73e8' },
                            { key: 'Preparing', label: 'Preparing', color: '#d97706' },
                            { key: 'Ready', label: 'Ready', color: '#7e22ce' },
                            { key: 'Out For Delivery', label: 'Out Delivery', color: '#0891b2' },
                            { key: 'Delivered', label: 'Delivered', color: '#047857' },
                            { key: 'Cancelled', label: 'Cancel', color: '#dc2626' }
                          ].map(stepBtn => {
                            const isCurrent = ord.orderStatus === stepBtn.key
                            return (
                              <button
                                key={stepBtn.key}
                                disabled={isLocked}
                                onClick={() => handleUpdateStatus(ord.id, stepBtn.key)}
                                className={`pipeline-btn ${isCurrent ? 'active' : ''}`}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '5px 8px',
                                  borderColor: isCurrent ? stepBtn.color : undefined,
                                  background: isCurrent ? stepBtn.color : undefined
                                }}
                              >
                                {stepBtn.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
