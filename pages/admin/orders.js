import { useEffect, useState, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/AdminLayout'

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
              data.orders.forEach(mongoOrder => {
                const idx = combined.findIndex(o => (o.orderId || o.id) === mongoOrder.orderId)
                if (idx >= 0) {
                  combined[idx] = { ...combined[idx], ...mongoOrder }
                } else {
                  combined.push({ id: mongoOrder.orderId, ...mongoOrder })
                }
              })
              return combined
            })
          }
        }
      } catch (e) {}
    }

    fetchAllOrders()
    const interval = setInterval(fetchAllOrders, 3000)

    const playNewOrderSound = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (!AudioCtx) return
        const ctx = new AudioCtx()
        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(587.33, now)
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15)
        gain.gain.setValueAtTime(0.3, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.6)
      } catch (e) {}
    }

    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setFirestoreError(null)
      const docs = snapshot.docs.map(d => {
        const data = d.data()
        let dateFormatted = new Date().toLocaleString()
        try {
          if (data.createdAt?.toDate) {
            dateFormatted = data.createdAt.toDate().toLocaleString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })
          } else if (data.createdAt) {
            dateFormatted = new Date(data.createdAt).toLocaleString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })
          }
        } catch (e) {}

        return {
          id: d.id,
          orderId: data.orderId || d.id,
          ...data,
          createdAtFormatted: dateFormatted
        }
      })

      if (!isFirstLoad.current && docs.length > prevOrderCount.current) {
        playNewOrderSound()
        setActionFeedback('🔔 New Live Order Arrived!')
        setTimeout(() => setActionFeedback(null), 4000)
      }
      isFirstLoad.current = false
      prevOrderCount.current = docs.length

      setOrders(prev => {
        const map = new Map()
        prev.forEach(item => map.set(item.orderId || item.id, item))
        docs.forEach(item => map.set(item.orderId || item.id, { ...map.get(item.orderId || item.id), ...item }))
        return Array.from(map.values())
      })
    }, (err) => {
      console.warn('Firestore admin notice:', err.message)
      setFirestoreError(err.message)
    })

    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [])

  const showToast = (msg) => {
    setActionFeedback(msg)
    setTimeout(() => setActionFeedback(null), 3500)
  }

  const handleUpdateStatus = async (orderId, newStatus) => {
    const ord = orders.find(o => o.id === orderId || o.orderId === orderId)
    if (ord && (ord.orderStatus === 'Delivered' || ord.orderStatus === 'delivered' || ord.orderStatus === 'Cancelled' || ord.orderStatus === 'cancelled' || ord.orderStatus === 'rejected' || ord.paymentStatus === 'rejected')) {
      showToast('⚠️ Completed or Cancelled orders are locked and cannot be edited.')
      return
    }

    try {
      const orderRef = doc(db, 'orders', orderId)
      await updateDoc(orderRef, {
        orderStatus: newStatus,
        updatedAt: serverTimestamp()
      }).catch(() => {})

      fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderStatus: newStatus })
      }).catch(() => {})

      setOrders(prev => prev.map(o => (o.orderId === orderId || o.id === orderId) ? { ...o, orderStatus: newStatus, status: newStatus } : o))
      showToast(`⚡ Order #${orderId.slice(-6)} set to ${newStatus}`)
    } catch (err) {
      console.error('Update Status Error:', err)
    }
  }

  const handleApprovePayment = async (orderId) => {
    const ord = orders.find(o => o.id === orderId || o.orderId === orderId)
    if (ord && (ord.orderStatus === 'Delivered' || ord.orderStatus === 'delivered' || ord.orderStatus === 'Cancelled' || ord.orderStatus === 'cancelled' || ord.orderStatus === 'rejected' || ord.paymentStatus === 'rejected')) {
      showToast('⚠️ Locked orders cannot be modified.')
      return
    }

    try {
      const orderRef = doc(db, 'orders', orderId)
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        orderStatus: 'Accepted',
        paymentVerifiedBy: user?.uid || 'admin',
        paymentVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(() => {})

      fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentStatus: 'paid', orderStatus: 'Accepted' })
      }).catch(() => {})

      setOrders(prev => prev.map(o => (o.orderId === orderId || o.id === orderId) ? { ...o, paymentStatus: 'paid', orderStatus: 'Accepted' } : o))
      showToast('✅ Payment Verified & Order Automatically Accepted!')
    } catch (err) {
      alert('Error approving payment: ' + err.message)
    }
  }

  const handleRejectPayment = async (orderId) => {
    const ord = orders.find(o => o.id === orderId || o.orderId === orderId)
    if (ord && (ord.orderStatus === 'Delivered' || ord.orderStatus === 'delivered' || ord.orderStatus === 'Cancelled' || ord.orderStatus === 'cancelled' || ord.orderStatus === 'rejected' || ord.paymentStatus === 'rejected')) {
      showToast('⚠️ Locked orders cannot be modified.')
      return
    }

    if (!window.confirm('Are you sure you want to reject this payment?\nReason: Payment Not Received')) return
    try {
      const orderRef = doc(db, 'orders', orderId)
      await updateDoc(orderRef, {
        paymentStatus: 'rejected',
        orderStatus: 'Cancelled',
        rejectionReason: 'Payment Not Received',
        updatedAt: serverTimestamp()
      }).catch(() => {})

      fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentStatus: 'rejected', orderStatus: 'Cancelled', rejectionReason: 'Payment Not Received' })
      }).catch(() => {})

      setOrders(prev => prev.map(o => (o.orderId === orderId || o.id === orderId) ? { ...o, paymentStatus: 'rejected', orderStatus: 'Cancelled' } : o))
      showToast('❌ Payment Rejected & Order Cancelled')
    } catch (err) {
      alert('Error rejecting payment: ' + err.message)
    }
  }

  // Count helper functions
  const countUpiPending = orders.filter(o => o.paymentMethod === 'UPI' && (o.paymentStatus === 'verification_pending' || o.paymentStatus === 'Verification Pending' || o.orderStatus === 'payment_verification_pending')).length
  const countPending = orders.filter(o => o.orderStatus === 'Pending' || o.orderStatus === 'pending').length
  const countAccepted = orders.filter(o => o.orderStatus === 'Accepted' || o.orderStatus === 'accepted').length
  const countPreparing = orders.filter(o => o.orderStatus === 'Preparing' || o.orderStatus === 'preparing').length
  const countReady = orders.filter(o => o.orderStatus === 'Ready' || o.orderStatus === 'ready').length
  const countOut = orders.filter(o => o.orderStatus === 'Out For Delivery' || o.orderStatus === 'out_for_delivery').length
  const countDelivered = orders.filter(o => o.orderStatus === 'Delivered' || o.orderStatus === 'delivered').length
  const countCancelled = orders.filter(o => o.orderStatus === 'Cancelled' || o.orderStatus === 'cancelled' || o.orderStatus === 'rejected' || o.paymentStatus === 'rejected').length

  // Filtering
  const filteredOrders = orders.filter(o => {
    // 1. Status Filter
    if (filterStatus === 'UPI Verification Pending') {
      if (!(o.paymentMethod === 'UPI' && (o.paymentStatus === 'verification_pending' || o.paymentStatus === 'Verification Pending' || o.orderStatus === 'payment_verification_pending'))) return false
    } else if (filterStatus !== 'all') {
      if (filterStatus === 'Cancelled') {
        if (!(o.orderStatus === 'Cancelled' || o.orderStatus === 'cancelled' || o.orderStatus === 'rejected' || o.paymentStatus === 'rejected')) return false
      } else {
        if (o.orderStatus?.toLowerCase() !== filterStatus.toLowerCase()) return false
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
    <AdminLayout activePage="orders" title="Live Orders Desk">
      <div className="admin-page-container">
        {/* EXECUTIVE ADMIN CONTROL DECK HERO CARD */}
        <div className="admin-control-hero-card">
          {/* Header Row: Title, Search Bar & Granular Status Selector */}
          <div className="admin-orders-header">
            <div className="admin-title-area">
              <span className="admin-sync-pill">
                <span style={{ animation: 'pulse 1.5s infinite' }}>🟢</span> Live Sync Active
              </span>
              <h1>Orders Management Desk</h1>
            </div>

            <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '680px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Premium Search Input Box */}
              <div className="admin-search-box" style={{ flex: '1 1 260px' }}>
                <span className="admin-search-icon">🔍</span>
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Search Order ID, Phone, Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="admin-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search query"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {/* Custom Right-Aligned Status Select Dropdown (Zero Frame Overflow) */}
              <div ref={dropdownRef} style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px', maxWidth: '260px' }}>
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: '999px',
                    border: '1.5px solid rgba(13,90,58,0.18)',
                    background: '#ffffff',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
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
                      {filterStatus === 'all' ? `All Orders (${orders.length})` :
                       filterStatus === 'UPI Verification Pending' ? `UPI Verification (${countUpiPending})` :
                       filterStatus === 'Pending' ? `Pending (${countPending})` :
                       filterStatus === 'Accepted' ? `Accepted (${countAccepted})` :
                       filterStatus === 'Preparing' ? `Preparing (${countPreparing})` :
                       filterStatus === 'Ready' ? `Ready (${countReady})` :
                       filterStatus === 'Out For Delivery' ? `Out For Delivery (${countOut})` :
                       filterStatus === 'Delivered' ? `Delivered (${countDelivered})` : `Cancelled (${countCancelled})`}
                    </span>
                  </span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.6, transform: statusDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', marginLeft: '6px' }}>▼</span>
                </button>

                {/* Dropdown Panel Aligned to Right Edge (Opens Inwards, NEVER overflows frame!) */}
                {statusDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0, // Aligned to RIGHT edge so it opens INWARDS inside the frame!
                      background: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid rgba(13,90,58,0.18)',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
                      padding: '8px',
                      minWidth: '220px',
                      maxWidth: 'calc(100vw - 32px)',
                      zIndex: 2000,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}
                  >
                    {[
                      { id: 'all', label: 'All Orders', icon: '📦', count: orders.length },
                      { id: 'UPI Verification Pending', label: 'UPI Verification', icon: '💳', count: countUpiPending, highlight: countUpiPending > 0 },
                      { id: 'Pending', label: 'Pending', icon: '⏳', count: countPending, highlight: countPending > 0 },
                      { id: 'Accepted', label: 'Accepted', icon: '👍', count: countAccepted },
                      { id: 'Preparing', label: 'Preparing', icon: '👨‍🍳', count: countPreparing },
                      { id: 'Ready', label: 'Ready', icon: '🍱', count: countReady },
                      { id: 'Out For Delivery', label: 'Out For Delivery', icon: '🛵', count: countOut },
                      { id: 'Delivered', label: 'Delivered', icon: '✅', count: countDelivered },
                      { id: 'Cancelled', label: 'Cancelled', icon: '❌', count: countCancelled }
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
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: 'none',
                          background: filterStatus === opt.id ? 'rgba(13,90,58,0.08)' : 'transparent',
                          color: filterStatus === opt.id ? 'var(--deep-green)' : 'var(--ink)',
                          fontWeight: filterStatus === opt.id ? 900 : 700,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s ease'
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

          {/* Interactive KPI Filter Cards (Rethought Master Category Deck) */}
          <div className="admin-stats-summary-strip">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`admin-stat-chip ${filterStatus === 'all' ? 'active-filter' : ''}`}
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: filterStatus === 'all' ? '2px solid var(--deep-green)' : '1px solid rgba(0,0,0,0.08)',
                background: filterStatus === 'all' ? 'rgba(13,90,58,0.06)' : '#ffffff',
                boxShadow: filterStatus === 'all' ? '0 4px 14px rgba(13,90,58,0.12)' : 'none'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ALL ORDERS
                </span>
                <strong style={{ fontSize: '1.2rem' }}>📦 {orders.length}</strong>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(countUpiPending > 0 ? 'UPI Verification Pending' : 'Pending')}
              className={`admin-stat-chip ${(countUpiPending + countPending) > 0 ? 'action-needed' : ''}`}
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: (filterStatus === 'UPI Verification Pending' || filterStatus === 'Pending') ? '2px solid #b45309' : undefined
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: (countUpiPending + countPending) > 0 ? '#92400e' : 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ACTION NEEDED
                </span>
                <strong style={{ fontSize: '1.2rem', color: (countUpiPending + countPending) > 0 ? '#b45309' : 'var(--deep-green)' }}>
                  ⚡ {countUpiPending + countPending}
                </strong>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('Preparing')}
              className={`admin-stat-chip ${filterStatus === 'Preparing' ? 'active-filter' : ''}`}
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: filterStatus === 'Preparing' ? '2px solid var(--deep-green)' : '1px solid rgba(0,0,0,0.08)',
                background: filterStatus === 'Preparing' ? 'rgba(13,90,58,0.06)' : '#ffffff'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  IN KITCHEN & TRANSIT
                </span>
                <strong style={{ fontSize: '1.2rem' }}>👨‍🍳 {countPreparing + countReady + countOut}</strong>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('Delivered')}
              className={`admin-stat-chip ${filterStatus === 'Delivered' ? 'active-filter' : ''}`}
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: filterStatus === 'Delivered' ? '2px solid var(--deep-green)' : '1px solid rgba(0,0,0,0.08)',
                background: filterStatus === 'Delivered' ? 'rgba(13,90,58,0.06)' : '#ffffff'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  DELIVERED
                </span>
                <strong style={{ fontSize: '1.2rem' }}>✅ {countDelivered}</strong>
              </div>
            </button>
          </div>
        </div>

          {/* 2-COLUMN RESPONSIVE ORDERS CARD GRID */}
          <div className="admin-orders-grid">
            {filteredOrders.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '60px 20px', background: '#ffffff', borderRadius: '20px', textAlign: 'center', border: '1px dashed rgba(0,0,0,0.12)' }}>
                <p style={{ color: 'var(--muted)', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                  {searchQuery ? `No orders matching "${searchQuery}"` : 'No orders found under this filter status.'}
                </p>
              </div>
            ) : (
              filteredOrders.map((ord) => {
                const isDelivered = ord.orderStatus === 'Delivered' || ord.orderStatus === 'delivered'
                const isCancelled = ord.orderStatus === 'Cancelled' || ord.orderStatus === 'cancelled' || ord.orderStatus === 'rejected' || ord.orderStatus === 'Payment Failed' || ord.paymentStatus === 'rejected' || ord.paymentStatus === 'Payment Failed'
                const isLocked = isDelivered || isCancelled
                const customerName = ord.customerName || ord.userName || 'Customer'
                const initial = customerName.charAt(0).toUpperCase()
                const rawPhone = (ord.customerPhone || ord.userPhone || '').replace(/[^0-9]/g, '')
                const waMessage = encodeURIComponent(`Hi ${customerName}, updating you regarding your Biriyani Station Patna Order #${ord.orderId || ord.id.slice(0, 8)} (Status: ${ord.orderStatus || 'Confirmed'}).`)

                return (
                  <div
                    key={ord.id}
                    className={`admin-card-compact ${isDelivered ? 'delivered' : ''} ${isCancelled ? 'cancelled' : ''}`}
                  >
                    {/* Top Header Row: Customer Info & Order Meta */}
                    <div className="admin-card-top-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div className="customer-avatar-circle" style={{ width: '38px', height: '38px', fontSize: '0.95rem' }}>{initial}</div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--ink)', margin: 0 }}>{customerName}</h3>
                            {rawPhone && (
                              <a
                                href={`https://wa.me/91${rawPhone}?text=${waMessage}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="customer-wa-btn"
                                style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                              >
                                WhatsApp 💬
                              </a>
                            )}
                          </div>
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>
                            📞 {ord.customerPhone || ord.userPhone || 'No Phone'}
                          </p>
                        </div>
                      </div>

                      <div className="admin-card-top-row-right">
                        <span style={{ fontSize: '0.72rem', fontWeight: 900, color: isCancelled ? '#dc2626' : 'var(--deep-green)', background: isCancelled ? 'rgba(239,68,68,0.1)' : 'rgba(13,90,58,0.08)', padding: '3px 8px', borderRadius: '6px' }}>
                          #{ord.orderId || ord.id.slice(0, 8)}
                        </span>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700 }}>
                          🕒 {ord.createdAtFormatted}
                        </p>
                      </div>
                    </div>

                    {/* Location Badge */}
                    <div style={{ background: '#faf9f5', borderRadius: '10px', padding: '8px 12px', marginBottom: '14px', fontSize: '0.8rem', color: 'var(--ink)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span>📍</span>
                      <span className="admin-truncate" style={{ wordBreak: 'break-word' }}>{ord.deliveryAddress || 'Patna Delivery Address'}</span>
                    </div>

                    {/* INNER SPLIT: PAYMENT BOX & ITEMS SUMMARY */}
                    <div className="admin-card-inner-split">
                      {/* Left: Payment Box */}
                      {ord.paymentMethod === 'UPI' ? (
                        <div style={{
                          background: (ord.paymentStatus === 'paid' || ord.paymentStatus === 'Paid') ? 'rgba(13,90,58,0.08)' : (ord.paymentStatus === 'rejected' || isCancelled) ? 'rgba(239,68,68,0.08)' : 'rgba(245,200,66,0.14)',
                          border: '1px solid rgba(0,0,0,0.08)',
                          borderRadius: '14px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justify: 'space-between'
                        }}>
                          <div>
                            <span style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--ink)', textTransform: 'uppercase' }}>
                              📲 UPI ONLINE
                            </span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', fontWeight: 900, color: (ord.paymentStatus === 'paid' || ord.paymentStatus === 'Paid') ? 'var(--deep-green)' : isCancelled ? '#dc2626' : '#d97706' }}>
                              Status: {ord.paymentStatus === 'verification_pending' ? 'Verification Pending' : (ord.paymentStatus || 'Pending').toUpperCase()}
                            </p>
                            {ord.transactionReference && (
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem', fontWeight: 700, color: 'var(--ink)' }}>
                                UPI Payer Name: <code style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800 }}>{ord.transactionReference}</code>
                              </p>
                            )}
                          </div>

                          {!isLocked && (ord.paymentStatus === 'verification_pending' || ord.paymentStatus === 'Verification Pending' || ord.orderStatus === 'payment_verification_pending') && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                              <button
                                type="button"
                                onClick={() => handleApprovePayment(ord.id)}
                                style={{ background: 'var(--deep-green)', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer', width: '100%' }}
                              >
                                Approve & Accept ✅
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectPayment(ord.id)}
                                style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 10px', borderRadius: '8px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                ❌
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background: 'rgba(13,90,58,0.06)', borderRadius: '14px', padding: '12px', fontSize: '0.8rem', color: 'var(--deep-green)', fontWeight: 800 }}>
                          💵 CASH / QR SCAN ON DELIVERY
                        </div>
                      )}

                      {/* Right: Items List & Total */}
                      <div style={{ background: '#fcfcf9', padding: '12px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                          {ord.items?.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                              <span><strong style={{ color: 'var(--deep-green)' }}>{item.qty || item.quantity}x</strong> {item.title || item.name}</span>
                              <span style={{ fontWeight: 700, color: 'var(--muted)' }}>₹{((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: '8px', paddingTop: '6px', textAlign: 'right', fontWeight: 900, fontSize: '1.05rem', color: 'var(--deep-green)' }}>
                          Total: ₹{(ord.grandTotal || 0).toFixed(0)}
                        </div>
                      </div>
                    </div>

                    {/* Pipeline Controls */}
                    <div style={{ marginTop: '10px' }}>
                      {isDelivered ? (
                        <div style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(13,90,58,0.12)', color: 'var(--deep-green)', fontWeight: 900, fontSize: '0.8rem', border: '1px solid rgba(13,90,58,0.3)', width: '100%', textAlign: 'center' }}>
                          ✓ Order Delivered & Completed (Locked)
                        </div>
                      ) : isCancelled ? (
                        <div style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', color: '#dc2626', fontWeight: 900, fontSize: '0.8rem', border: '1px solid rgba(239,68,68,0.3)', width: '100%', textAlign: 'center' }}>
                          ❌ Order Cancelled (Locked)
                        </div>
                      ) : (
                        <div className="pipeline-container" style={{ margin: 0, padding: '8px', gap: '4px' }}>
                          {[
                            { key: 'Accepted', label: 'Accept', color: '#1a73e8' },
                            { key: 'Preparing', label: 'Preparing', color: '#d97706' },
                            { key: 'Ready', label: 'Ready', color: '#7e22ce' },
                            { key: 'Out For Delivery', label: 'Out For Delivery', color: '#0891b2' },
                            { key: 'Delivered', label: 'Delivered', color: 'var(--deep-green)' },
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
                                  padding: '5px 9px',
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
                )
              })
            )}
          </div>
        </div>
    </AdminLayout>
  )
}
