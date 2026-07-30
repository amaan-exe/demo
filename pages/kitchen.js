import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import RouteGuard from '../components/RouteGuard'

export default function KitchenPortal() {
  const { user, userRole, logout, accessToken } = useAuth()
  const [orders, setOrders] = useState([])
  const [filterTab, setFilterTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedback, setFeedback] = useState(null)

  const triggerFeedback = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }

  // Real-time listener for Kitchen Orders
  useEffect(() => {
    const fetchFallback = async () => {
      try {
        const res = await fetch('/api/orders/admin-all', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.orders) {
            setOrders(prev => {
              const combined = [...prev]
              data.orders.forEach(o => {
                const idx = combined.findIndex(item => item.id === o.id)
                if (idx >= 0) combined[idx] = { ...combined[idx], ...o }
                else combined.push(o)
              })
              return combined
            })
          }
        }
      } catch (e) {}
    }

    fetchFallback()

    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const fetched = snapshot.docs.map(d => {
        const data = d.data()
        let dateObj = new Date()
        if (data.createdAt?.toDate) {
          dateObj = data.createdAt.toDate()
        } else if (data.createdAtSeconds) {
          dateObj = new Date(data.createdAtSeconds * 1000)
        } else if (data.createdAt) {
          dateObj = new Date(data.createdAt)
        }

        const createdAtFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const elapsedMinutes = Math.max(0, Math.floor((Date.now() - dateObj.getTime()) / 60000))

        return {
          id: d.id,
          ...data,
          dateObj,
          createdAtFormatted,
          elapsedMinutes
        }
      })

      // Sort by oldest order first (highest waiting time = kitchen priority)
      fetched.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      setOrders(fetched)
    }, () => {
      fetchFallback()
    })

    return () => unsub()
  }, [])

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const targetDoc = doc(db, 'orders', orderId)
      await updateDoc(targetDoc, {
        orderStatus: newStatus,
        updatedAt: serverTimestamp()
      })

      fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ orderId, orderStatus: newStatus })
      }).catch(() => {})

      triggerFeedback(`Order status updated to ${newStatus}`)
    } catch (e) {
      triggerFeedback(`Update error: ${e.message}`)
    }
  }

  const handleKitchenCancel = async (orderId, grandTotal) => {
    if (!confirm('Cancel this order and send to Refund Desk for customer refund?')) return
    try {
      const cleanDocId = String(orderId).replace(/^#/, '').trim()
      const refundPayload = {
        requested: true,
        status: 'REFUND_PENDING',
        requestedAt: new Date().toISOString(),
        processingAt: null,
        refundedAt: null,
        refundedBy: null,
        amount: grandTotal || 0,
        cancellationReason: 'Cancelled by Kitchen Staff'
      }

      const targetDoc = doc(db, 'orders', cleanDocId)
      await updateDoc(targetDoc, {
        orderStatus: 'REFUND_PENDING',
        status: 'REFUND_PENDING',
        updatedAt: serverTimestamp(),
        refund: refundPayload
      }).catch(async () => {
        if (orderId !== cleanDocId) {
          await updateDoc(doc(db, 'orders', orderId), {
            orderStatus: 'REFUND_PENDING',
            status: 'REFUND_PENDING',
            updatedAt: serverTimestamp(),
            refund: refundPayload
          }).catch(() => {})
        }
      })

      fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ orderId: cleanDocId, cancellationReason: 'Cancelled by Kitchen Staff' })
      }).catch(() => {})

      triggerFeedback('Order cancelled by Kitchen. Sent to Refund Desk.')
    } catch (e) {
      triggerFeedback(`Cancel error: ${e.message}`)
    }
  }

  // Filter Active Kitchen Orders - ONLY show orders whose payment is verified AND are NOT out for delivery, delivered, or cancelled!
  const isKitchenOrder = (o) => {
    const st = (o.orderStatus || o.status || '').toLowerCase()
    const paySt = (o.paymentStatus || '').toLowerCase()
    const refSt = (o.refund?.status || '').toLowerCase()

    // Exclude any refund requested or processing/refunded orders
    if (st.includes('refund') || refSt.includes('refund') || o.refund?.requested === true) {
      return false
    }

    // Exclude orders that are already out for delivery, delivered, or cancelled!
    if (st === 'out_for_delivery' || st === 'out for delivery' || st === 'delivered' || st === 'cancelled' || st === 'rejected') {
      return false
    }

    // Must be payment verified
    const isPaymentVerified = paySt === 'paid' || paySt === 'verified' || st === 'payment_verified' || o.paymentVerifiedBy
    if (!isPaymentVerified) {
      return false
    }

    // Active kitchen stages only (payment_verified, accepted, confirmed, preparing, ready)
    return (
      st === 'payment_verified' ||
      st === 'accepted' ||
      st === 'confirmed' ||
      st === 'preparing' ||
      st === 'ready'
    )
  }

  const kitchenOrders = orders.filter(isKitchenOrder)

  const newOrdersCount = kitchenOrders.filter(o => {
    const st = (o.orderStatus || o.status || '').toLowerCase()
    const paySt = (o.paymentStatus || '').toLowerCase()
    return st === 'payment_verified' || (paySt === 'paid' && st !== 'accepted' && st !== 'preparing' && st !== 'ready')
  }).length

  const approvedCount = kitchenOrders.filter(o => {
    const st = (o.orderStatus || o.status || '').toLowerCase()
    return st === 'accepted' || st === 'confirmed'
  }).length

  const preparingCount = kitchenOrders.filter(o => {
    const st = (o.orderStatus || o.status || '').toLowerCase()
    return st === 'preparing'
  }).length

  const readyCount = kitchenOrders.filter(o => {
    const st = (o.orderStatus || o.status || '').toLowerCase()
    return st === 'ready' || st === 'ready_for_delivery'
  }).length

  const filteredOrders = kitchenOrders.filter(o => {
    const st = (o.orderStatus || o.status || '').toLowerCase()
    const paySt = (o.paymentStatus || '').toLowerCase()

    if (filterTab === 'new') {
      if (!(st === 'payment_verified' || (paySt === 'paid' && st !== 'accepted' && st !== 'preparing' && st !== 'ready'))) return false
    } else if (filterTab === 'approved') {
      if (!(st === 'accepted' || st === 'confirmed')) return false
    } else if (filterTab === 'preparing') {
      if (st !== 'preparing') return false
    } else if (filterTab === 'ready') {
      if (!(st === 'ready' || st === 'ready_for_delivery')) return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const nameMatch = (o.customerName || o.userName || '').toLowerCase().includes(q)
      const phoneMatch = (o.customerPhone || o.userPhone || '').toLowerCase().includes(q)
      const idMatch = (o.orderId || o.id || '').toLowerCase().includes(q)
      return nameMatch || phoneMatch || idMatch
    }

    return true
  })

  const haltedCancellationCount = orders.filter(o => {
    const st = (o.orderStatus || o.status || '').toLowerCase()
    const refSt = (o.refund?.status || '').toLowerCase()

    // Once refund is complete (REFUNDED), halt the notice notification!
    if (st === 'refunded' || refSt === 'refunded' || st === 'cancelled') return false

    return st === 'refund_pending' || st === 'refund_processing' || refSt === 'refund_pending' || refSt === 'refund_processing' || o.refund?.requested === true
  }).length

  return (
    <RouteGuard allowedRoles={['staff', 'admin']}>
      <Head>
        <title>Kitchen Live KDS | Biriyani Station Patna</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#f4f6f3', color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', 'Outfit', sans-serif", paddingBottom: '40px' }}>
        {/* Toast Feedback */}
        {feedback && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#0d5a3a',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '999px',
            fontSize: '0.9rem',
            fontWeight: 900,
            zIndex: 9999,
            boxShadow: '0 8px 30px rgba(13, 90, 58, 0.3)',
            fontFamily: "'Outfit', sans-serif"
          }}>
            ⚡ {feedback}
          </div>
        )}

        {/* Brand Header Bar */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: '#0d5a3a',
          color: '#ffffff',
          boxShadow: '0 4px 20px rgba(13, 90, 58, 0.25)',
          padding: '12px 18px',
          borderBottom: '3px solid #f59e0b'
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#ffffff', color: '#0d5a3a', display: 'grid', placeItems: 'center', fontSize: '1.5rem', fontWeight: 900, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                🍳
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 900, letterSpacing: '0.04em', color: '#ffffff' }}>
                    BIRIYANI <span style={{ color: '#f59e0b' }}>STATION</span>
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, background: '#ea580c', color: '#ffffff', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Outfit', sans-serif" }}>
                    KITCHEN KDS
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                  Kitchen Display System • Live Chef Stream
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link href="/" style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', padding: '8px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 800, textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}>
                🏠 Website
              </Link>
              <button type="button" onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ffffff', border: '1px solid rgba(239,68,68,0.4)', padding: '8px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
                🔒 Exit Portal
              </button>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '20px 16px' }}>
          {/* URGENT KITCHEN CANCELLATION HALT BANNER */}
          {haltedCancellationCount > 0 && (
            <div style={{
              background: '#fee2e2',
              border: '2px solid #dc2626',
              borderRadius: '16px',
              padding: '14px 18px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 4px 14px rgba(220,38,38,0.15)'
            }}>
              <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>⛔</div>
              <div>
                <strong style={{ color: '#dc2626', fontSize: '0.96rem', fontFamily: "'Outfit', sans-serif", display: 'block' }}>
                  KITCHEN NOTICE: {haltedCancellationCount} Order Cancellation Request(s) Received!
                </strong>
                <span style={{ fontSize: '0.82rem', color: '#991b1b', fontWeight: 700 }}>
                  Food preparation halted immediately for customer-cancelled orders. Orders removed from chef stream.
                </span>
              </div>
            </div>
          )}

          {/* Dashboard Interactive Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              style={{
                background: filterTab === 'all' ? '#0d5a3a' : '#ffffff',
                color: filterTab === 'all' ? '#ffffff' : '#0d5a3a',
                border: '2px solid #0d5a3a',
                borderRadius: '16px',
                padding: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 900, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
                🔥 TOTAL ACTIVE
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, fontFamily: "'Outfit', sans-serif", marginTop: '2px' }}>
                {kitchenOrders.length} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>orders</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('new')}
              style={{
                background: filterTab === 'new' ? '#1a73e8' : '#ffffff',
                color: filterTab === 'new' ? '#ffffff' : '#1a73e8',
                border: '2px solid #1a73e8',
                borderRadius: '16px',
                padding: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 900, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
                ⏳ NEW ORDERS
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, fontFamily: "'Outfit', sans-serif", marginTop: '2px' }}>
                {newOrdersCount} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>to accept</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('approved')}
              style={{
                background: filterTab === 'approved' ? '#0284c7' : '#ffffff',
                color: filterTab === 'approved' ? '#ffffff' : '#0284c7',
                border: '2px solid #0284c7',
                borderRadius: '16px',
                padding: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 900, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
                👍 APPROVED & QUEUED
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, fontFamily: "'Outfit', sans-serif", marginTop: '2px' }}>
                {approvedCount} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>orders</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('preparing')}
              style={{
                background: filterTab === 'preparing' ? '#ea580c' : '#ffffff',
                color: filterTab === 'preparing' ? '#ffffff' : '#ea580c',
                border: '2px solid #ea580c',
                borderRadius: '16px',
                padding: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 900, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
                👨‍🍳 PREPARING
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, fontFamily: "'Outfit', sans-serif", marginTop: '2px' }}>
                {preparingCount} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>cooking</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('ready')}
              style={{
                background: filterTab === 'ready' ? '#0d5a3a' : '#ffffff',
                color: filterTab === 'ready' ? '#ffffff' : '#0d5a3a',
                border: '2px solid #0d5a3a',
                borderRadius: '16px',
                padding: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 900, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
                🍱 READY
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, fontFamily: "'Outfit', sans-serif", marginTop: '2px' }}>
                {readyCount} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>for pickup</span>
              </div>
            </button>
          </div>

          {/* Search Box */}
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="🔍 Search Order ID, Customer Name, Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 18px',
                borderRadius: '14px',
                border: '1.5px solid rgba(13,90,58,0.2)',
                background: '#ffffff',
                color: 'var(--ink)',
                fontSize: '0.92rem',
                fontWeight: 800,
                outline: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}
            />
          </div>

          {/* Orders Grid */}
          {filteredOrders.length === 0 ? (
            <div style={{ padding: '70px 20px', background: '#ffffff', borderRadius: '24px', textAlign: 'center', border: '2px dashed rgba(13,90,58,0.15)', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>👨‍🍳</div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', fontWeight: 900, color: '#0d5a3a', margin: '0 0 6px 0' }}>
                Kitchen Display Clear
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'var(--muted)', margin: 0, fontWeight: 700 }}>
                {searchQuery ? `No active kitchen orders matching "${searchQuery}"` : 'All Admin-approved orders have been cooked and sent to delivery partners!'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {filteredOrders.map(ord => {
                const st = (ord.orderStatus || ord.status || 'Confirmed').toLowerCase()
                const paySt = (ord.paymentStatus || '').toLowerCase()
                
                const isPendingAcceptance = st === 'payment_verified' || (paySt === 'paid' && st !== 'accepted' && st !== 'preparing' && st !== 'ready')
                const isAccepted = st === 'accepted' || st === 'confirmed'
                const isPreparing = st === 'preparing'
                const isReady = st === 'ready' || st === 'ready_for_delivery'

                const customerName = ord.customerName || ord.userName || 'Customer'
                const rawPhone = (ord.customerPhone || ord.userPhone || '').replace(/[^0-9]/g, '')
                const waMessage = encodeURIComponent(`Hi ${customerName}, updating you from Kitchen regarding Order #${ord.orderId || ord.id.slice(0, 8)}.`)

                return (
                  <div
                    key={ord.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '20px',
                      border: isPreparing ? '2.5px solid #ea580c' : isAccepted ? '2px solid #0284c7' : isPendingAcceptance ? '2px solid #1a73e8' : '2px solid #0d5a3a',
                      boxShadow: isPreparing ? '0 10px 30px rgba(234, 88, 12, 0.15)' : '0 6px 20px rgba(0,0,0,0.04)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justify: 'space-between',
                      position: 'relative'
                    }}
                  >
                    {/* Status Top Strip Accent */}
                    <div style={{ height: '6px', width: '100%', background: isPreparing ? '#ea580c' : isAccepted ? '#0284c7' : isPendingAcceptance ? '#1a73e8' : '#0d5a3a' }} />

                    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Header Row: Order ID & Timer Ticker */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(13,90,58,0.06)',
                          border: '1.5px solid #0d5a3a',
                          padding: '4px 12px',
                          borderRadius: '10px'
                        }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif" }}>ORDER ID:</span>
                          <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0d5a3a', letterSpacing: '0.06em', fontFamily: "'JetBrains Mono', monospace" }}>
                            #{ord.orderId || ord.id.slice(0, 8)}
                          </span>
                        </div>

                        {/* Live Waiting Time Ticker */}
                        <span style={{
                          fontSize: '0.78rem',
                          fontWeight: 900,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          background: ord.elapsedMinutes > 20 ? '#fce8e6' : '#fffbeb',
                          color: ord.elapsedMinutes > 20 ? '#dc2626' : '#b45309',
                          border: ord.elapsedMinutes > 20 ? '1px solid #dc2626' : '1px solid #f59e0b',
                          fontFamily: "'Outfit', sans-serif"
                        }}>
                          ⏱ {ord.elapsedMinutes}m ago ({ord.createdAtFormatted})
                        </span>
                      </div>

                      {/* PRIMARY CENTER OF ATTENTION: ORDERED ITEMS & QUANTITIES */}
                      <div style={{
                        background: 'linear-gradient(180deg, #ffffff 0%, #f6fbf8 100%)',
                        border: '2px solid rgba(13,90,58,0.2)',
                        borderRadius: '16px',
                        padding: '14px',
                        boxShadow: '0 4px 14px rgba(13,90,58,0.06)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#0d5a3a', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🍱 DISHES TO PREPARE
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--muted)', background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: '999px', fontFamily: "'Outfit', sans-serif" }}>
                            {ord.items?.reduce((sum, i) => sum + (i.qty || i.quantity || 1), 0) || 0} Total Items
                          </span>
                        </div>

                        {/* Items List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                          {ord.items?.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 10px', background: '#ffffff', borderRadius: '8px', border: '1px solid rgba(13,90,58,0.1)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                <span style={{ background: '#0d5a3a', color: '#ffffff', fontSize: '0.85rem', fontWeight: 900, padding: '3px 9px', borderRadius: '6px', flexShrink: 0, fontFamily: "'Outfit', sans-serif" }}>
                                  {item.qty || item.quantity}x
                                </span>
                                <span style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--ink)', fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif", wordBreak: 'break-word' }}>
                                  {item.title || item.name}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#0d5a3a', fontFamily: "'Outfit', sans-serif" }}>
                                ₹{((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(0)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {ord.specialInstructions && (
                          <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '8px', padding: '8px 10px', fontSize: '0.8rem', color: '#b45309', fontWeight: 800, marginBottom: '10px' }}>
                            📝 Special Instructions: {ord.specialInstructions}
                          </div>
                        )}

                        <div style={{ borderTop: '2px dashed rgba(13,90,58,0.2)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif" }}>TOTAL BILL</span>
                          <strong style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0d5a3a', fontFamily: "'Outfit', sans-serif" }}>
                            ₹{(ord.grandTotal || 0).toFixed(0)}
                          </strong>
                        </div>
                      </div>

                      {/* Customer & Location Box */}
                      <div style={{ background: '#faf9f5', borderRadius: '12px', padding: '12px', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <strong style={{ fontSize: '0.92rem', color: 'var(--ink)', fontWeight: 900 }}>
                            👤 {customerName}
                          </strong>
                          {rawPhone && (
                            <a
                              href={`https://wa.me/91${rawPhone}?text=${waMessage}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ background: '#25d366', color: '#ffffff', padding: '3px 9px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
                            >
                              WhatsApp 💬
                            </a>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 700 }}>
                          📞 {ord.customerPhone || ord.userPhone || 'No Phone'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--ink)', fontWeight: 700, lineHeight: 1.35 }}>
                          📍 {ord.deliveryAddress || 'Patna Delivery Address'}
                        </div>
                      </div>

                      {/* ONE-TOUCH KITCHEN WORKFLOW ACTIONS */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {isPendingAcceptance ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(ord.id, 'Accepted')}
                            style={{
                              width: '100%',
                              padding: '14px',
                              borderRadius: '14px',
                              background: '#1a73e8',
                              color: '#ffffff',
                              border: 'none',
                              fontWeight: 900,
                              fontSize: '0.98rem',
                              cursor: 'pointer',
                              fontFamily: "'Outfit', sans-serif",
                              boxShadow: '0 4px 16px rgba(26, 115, 232, 0.4)'
                            }}
                          >
                            Accept Order 👍
                          </button>
                        ) : isAccepted ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(ord.id, 'Preparing')}
                            style={{
                              width: '100%',
                              padding: '14px',
                              borderRadius: '14px',
                              background: '#ea580c',
                              color: '#ffffff',
                              border: 'none',
                              fontWeight: 900,
                              fontSize: '0.98rem',
                              cursor: 'pointer',
                              fontFamily: "'Outfit', sans-serif",
                              boxShadow: '0 4px 16px rgba(234, 88, 12, 0.4)'
                            }}
                          >
                            Start Preparing 👨‍🍳
                          </button>
                        ) : isPreparing ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(ord.id, 'Ready')}
                            style={{
                              width: '100%',
                              padding: '14px',
                              borderRadius: '14px',
                              background: '#0d5a3a',
                              color: '#ffffff',
                              border: 'none',
                              fontWeight: 900,
                              fontSize: '0.98rem',
                              cursor: 'pointer',
                              fontFamily: "'Outfit', sans-serif",
                              boxShadow: '0 4px 16px rgba(13, 90, 58, 0.4)'
                            }}
                          >
                            Ready for Delivery 🍱 ➔
                          </button>
                        ) : isReady ? (
                          <div style={{
                            padding: '12px',
                            borderRadius: '12px',
                            background: '#e0e7ff',
                            color: '#3730a3',
                            border: '1.5px solid #6366f1',
                            fontWeight: 900,
                            fontSize: '0.86rem',
                            textAlign: 'center',
                            fontFamily: "'Outfit', sans-serif"
                          }}>
                            Sent to Delivery Partner (Waiting for Pickup 📦)
                          </div>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleKitchenCancel(ord.id, ord.grandTotal)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '10px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            fontFamily: "'Outfit', sans-serif"
                          }}
                        >
                          Cancel Order (Send to Refund Desk) 🚫
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </RouteGuard>
  )
}
