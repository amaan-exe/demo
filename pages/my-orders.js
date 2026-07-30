import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

export default function MyOrdersPage() {
  const { user, isAdmin, isStaffOnly, isDeliveryOnly, openAuthModal, accessToken } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [cancelModalOrder, setCancelModalOrder] = useState(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [submittingCancel, setSubmittingCancel] = useState(false)
  const [toast, setToast] = useState(null)
  const [isNavOpen, setIsNavOpen] = useState(false)

  const triggerToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetchLocalOrders()
    const interval = setInterval(fetchLocalOrders, 5000)

    let unsubscribe = () => {}
    try {
      const ordersRef = collection(db, 'orders')
      const q = query(ordersRef, where('userId', '==', user.uid))

      unsubscribe = onSnapshot(q, (snapshot) => {
        const orderList = snapshot.docs.map(docSnap => {
          const data = docSnap.data()
          let dateStr = new Date().toLocaleDateString()
          try {
            if (data.createdAt?.toDate) {
              dateStr = data.createdAt.toDate().toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            } else if (data.createdAt) {
              dateStr = new Date(data.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            }
          } catch (e) {}

          return {
            id: docSnap.id,
            orderId: data.orderId || docSnap.id,
            ...data,
            createdAt: dateStr
          }
        })

        orderList.sort((a, b) => (b.orderId || '').localeCompare(a.orderId || ''))

        if (orderList.length) {
          setOrders(prev => {
            const map = new Map()
            prev.forEach(item => map.set(item.orderId || item.id, item))
            orderList.forEach(item => map.set(item.orderId || item.id, { ...map.get(item.orderId || item.id), ...item }))
            return Array.from(map.values())
          })
        }
        setLoading(false)
      }, (error) => {
        console.warn('Real-time order listener notice:', error.message)
        fetchLocalOrders()
      })

    } catch (err) {
      console.warn('Real-time query fallback:', err)
      fetchLocalOrders()
    }

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [user])

  const fetchLocalOrders = async () => {
    try {
      const res = await fetch(`/api/orders/user?userId=${user.uid}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        const fetchedList = data.orders || []
        if (fetchedList.length > 0) {
          setOrders(prev => {
            const map = new Map()
            fetchedList.forEach(item => map.set(item.orderId || item.id, item))
            prev.forEach(item => map.set(item.orderId || item.id, { ...map.get(item.orderId || item.id), ...item }))
            return Array.from(map.values())
          })
        }
      }
    } catch (e) {}
    setLoading(false)
  }

  const handleRequestCancellation = async () => {
    if (!cancelModalOrder) return
    setSubmittingCancel(true)

    const rawId = cancelModalOrder.orderId || cancelModalOrder.id || ''
    const cleanDocId = String(rawId).replace(/^#/, '').trim()
    const grandTotal = cancelModalOrder.grandTotal || cancelModalOrder.amount || 0

    const refundPayload = {
      requested: true,
      status: 'REFUND_PENDING',
      requestedAt: new Date().toISOString(),
      processingAt: null,
      refundedAt: null,
      refundedBy: null,
      amount: grandTotal,
      cancellationReason: cancellationReason || 'Customer requested cancellation'
    }

    try {
      // 1. Update Firestore in real time
      const targetDocRef = doc(db, 'orders', cleanDocId)
      await updateDoc(targetDocRef, {
        orderStatus: 'REFUND_PENDING',
        status: 'REFUND_PENDING',
        updatedAt: serverTimestamp(),
        refund: refundPayload
      }).catch(async () => {
        // Fallback: try using original id
        if (cancelModalOrder.id && cancelModalOrder.id !== cleanDocId) {
          await updateDoc(doc(db, 'orders', cancelModalOrder.id), {
            orderStatus: 'REFUND_PENDING',
            status: 'REFUND_PENDING',
            updatedAt: serverTimestamp(),
            refund: refundPayload
          }).catch(() => {})
        }
      })

      // 2. Call Server API
      await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          orderId: cleanDocId,
          cancellationReason: cancellationReason || 'Customer requested cancellation',
          userEmail: user.email,
          userId: user.uid
        })
      }).catch(() => {})

      triggerToast('Order cancellation requested! Moved to Refund Queue.')
      setCancelModalOrder(null)
      setCancellationReason('')
    } catch (err) {
      triggerToast('Notice: ' + err.message)
    } finally {
      setSubmittingCancel(false)
    }
  }

  // Check if order is eligible for customer cancellation
  const isEligibleForCancellation = (order) => {
    const st = (order.orderStatus || order.status || '').toLowerCase()
    const refRequested = order.refund?.requested === true
    if (refRequested) return false

    // Allowed ONLY when payment is verified and before ready for delivery
    const allowed = ['payment_verified', 'payment verified', 'confirmed', 'accepted', 'preparing']
    return allowed.includes(st)
  }

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase()
    if (s.includes('refund_pending')) return { bg: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: 'rgba(220, 38, 38, 0.3)' }
    if (s.includes('refund_processing')) return { bg: 'rgba(217, 119, 6, 0.15)', color: '#d97706', border: 'rgba(217, 119, 6, 0.3)' }
    if (s.includes('refunded')) return { bg: 'rgba(5, 150, 105, 0.15)', color: '#059669', border: 'rgba(5, 150, 105, 0.3)' }

    switch (status) {
      case 'verification_pending':
      case 'payment_verification_pending':
      case 'Awaiting Payment Verification':
      case 'Pending':
        return { bg: 'rgba(245, 200, 66, 0.18)', color: '#8a6200', border: 'rgba(245, 200, 66, 0.4)' }
      case 'paid':
      case 'accepted':
      case 'Accepted':
      case 'CONFIRMED':
      case 'Confirmed':
        return { bg: 'rgba(13, 90, 58, 0.15)', color: 'var(--deep-green)', border: 'rgba(13, 90, 58, 0.3)' }
      case 'preparing':
      case 'Preparing':
        return { bg: 'rgba(255, 140, 0, 0.15)', color: '#d97706', border: 'rgba(255, 140, 0, 0.3)' }
      case 'ready':
      case 'Ready':
        return { bg: 'rgba(147, 51, 234, 0.15)', color: '#7e22ce', border: 'rgba(147, 51, 234, 0.3)' }
      case 'out_for_delivery':
      case 'Out For Delivery':
        return { bg: 'rgba(6, 182, 212, 0.15)', color: '#0891b2', border: 'rgba(6, 182, 212, 0.3)' }
      case 'delivered':
      case 'Delivered':
        return { bg: 'rgba(13, 90, 58, 0.25)', color: 'var(--deep-green)', border: 'rgba(13, 90, 58, 0.4)' }
      case 'rejected':
      case 'cancelled':
      case 'Cancelled':
      case 'Payment Failed':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: 'rgba(239, 68, 68, 0.3)' }
      default:
        return { bg: 'rgba(0, 0, 0, 0.08)', color: 'var(--ink)', border: 'rgba(0, 0, 0, 0.15)' }
    }
  }

  const standardSteps = ['Order Placed', 'Payment Verified', 'Accepted', 'Preparing', 'Ready', 'Out For Delivery', 'Delivered']
  const refundSteps = ['Order Placed', 'Payment Verified', 'Cancellation Requested', 'Refund Processing', 'Refund Completed']

  const getStandardStepIndex = (order) => {
    const rawSt = (order.orderStatus || order.status || '').toLowerCase()
    const paySt = (order.paymentStatus || '').toLowerCase()

    if (rawSt === 'delivered') return 6
    if (rawSt === 'out_for_delivery' || rawSt === 'out for delivery') return 5
    if (rawSt === 'ready' || rawSt === 'ready_for_delivery') return 4
    if (rawSt === 'preparing') return 3
    if (rawSt === 'accepted' || rawSt === 'confirmed') return 2
    if (rawSt === 'payment_verified' || paySt === 'paid' || paySt === 'verified' || order.paymentVerifiedBy) return 1
    return 0 // Order Placed
  }

  const getStatusEmoji = (step) => {
    const map = {
      'Order Placed': '📋',
      'Payment Verification Pending': '🔄',
      'Payment Verified': '✅',
      'Accepted': '👍',
      'Preparing': '👨‍🍳',
      'Ready': '🍱',
      'Out For Delivery': '🛵',
      'Delivered': '🎉',
      'Cancellation Requested': '📝',
      'Refund Processing': '⏳',
      'Refund Completed': '💸'
    }
    return map[step] || '📌'
  }

  useEffect(() => {
    if (selectedOrder || cancelModalOrder) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [selectedOrder, cancelModalOrder])

  return (
    <>
      <Head>
        <title>My Orders & Refund Status | Biriyani Station Patna</title>
      </Head>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#0d5a3a',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '999px',
          fontSize: '0.9rem',
          fontWeight: 900,
          zIndex: 9999,
          boxShadow: '0 8px 30px rgba(13,90,58,0.3)',
          fontFamily: "'Outfit', sans-serif"
        }}>
          ⚡ {toast}
        </div>
      )}

      <header className="site-header scrolled" id="top">
        <nav className="nav container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link href="/menu" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(13,90,58,0.08)',
              border: '1.5px solid rgba(13,90,58,0.2)',
              color: 'var(--deep-green)',
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '0.84rem',
              fontWeight: 800,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              fontFamily: "'Outfit', sans-serif"
            }}>
              ← Back to Menu
            </Link>
            <Link href="/" className="logo">BIRIYANI <span>STATION</span></Link>
          </div>

          <button className="nav-toggle" aria-label="Toggle navigation" aria-expanded={isNavOpen} onClick={() => setIsNavOpen(!isNavOpen)}>
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className={`nav-backdrop ${isNavOpen ? 'visible' : ''}`} onClick={() => setIsNavOpen(false)} />

          <div className={`nav-right ${isNavOpen ? 'open' : ''}`}>
            <Link href="/" onClick={() => setIsNavOpen(false)}>HOME</Link>
            <Link href="/menu" onClick={() => setIsNavOpen(false)}>MENU</Link>
            <Link href="/my-orders" className="active" style={{ color: 'var(--yellow)' }} onClick={() => setIsNavOpen(false)}>MY ORDERS</Link>
            <Link href="/profile" onClick={() => setIsNavOpen(false)}>PROFILE</Link>

            {/* Role-Exclusive Portal Access Pills (Admin ONLY sees Admin, Staff ONLY sees Kitchen, Delivery ONLY sees Delivery) */}
            {user && isAdmin && (
              <Link href="/admin" style={{ background: '#0d5a3a', color: '#ffffff', padding: '6px 14px', borderRadius: '999px', fontWeight: 900, fontSize: '0.78rem', textDecoration: 'none' }} onClick={() => setIsNavOpen(false)}>
                🛡️ ADMIN
              </Link>
            )}
            {user && isStaffOnly && (
              <Link href="/kitchen" style={{ background: '#ea580c', color: '#ffffff', padding: '6px 14px', borderRadius: '999px', fontWeight: 900, fontSize: '0.78rem', textDecoration: 'none' }} onClick={() => setIsNavOpen(false)}>
                🍳 KITCHEN
              </Link>
            )}
            {user && isDeliveryOnly && (
              <Link href="/delivery" style={{ background: '#0284c7', color: '#ffffff', padding: '6px 14px', borderRadius: '999px', fontWeight: 900, fontSize: '0.78rem', textDecoration: 'none' }} onClick={() => setIsNavOpen(false)}>
                🛵 DELIVERY
              </Link>
            )}

            {!user && (
              <button className="btn" onClick={() => { openAuthModal(); setIsNavOpen(false); }}>
                SIGN IN
              </button>
            )}
          </div>
        </nav>
      </header>

      <main style={{ minHeight: '80vh', padding: '100px 0 80px 0', background: 'var(--cream)' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <Link href="/menu" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0d5a3a',
              color: '#ffffff',
              padding: '7px 18px',
              borderRadius: '999px',
              fontSize: '0.84rem',
              fontWeight: 800,
              textDecoration: 'none',
              marginBottom: '14px',
              boxShadow: '0 4px 14px rgba(13,90,58,0.2)',
              fontFamily: "'Outfit', sans-serif"
            }}>
              ← Back to Food Menu
            </Link>
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.22em', color: 'var(--deep-green)', textTransform: 'uppercase' }}>
                REAL-TIME TRACKING & REFUNDS
              </span>
            </div>
            <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(2rem, 6vw, 2.8rem)', fontWeight: 900, color: 'var(--ink)', margin: '6px 0' }}>
              My Orders
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
              Track live food prep updates and manage cancellations & refunds seamlessly.
            </p>
          </div>

          {!user ? (
            <div className="empty-state">
              <span className="empty-state-icon">🔒</span>
              <h2>Please Sign In</h2>
              <p>You must be logged in to view your orders.</p>
              <button onClick={openAuthModal} className="btn" style={{ padding: '12px 28px' }}>SIGN IN NOW</button>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--muted)', fontWeight: 600 }}>Syncing live orders with Firestore...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🍲</span>
              <h2>No Orders Placed Yet</h2>
              <p>Explore our authentic charcoal kawabs and dum biryanis to place your first order!</p>
              <Link href="/menu" className="btn" style={{ padding: '14px 32px' }}>EXPLORE MENU</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {orders.map((order) => {
                const st = (order.orderStatus || order.status || 'Confirmed').toUpperCase()
                const refSt = (order.refund?.status || '').toUpperCase()
                const isRefundWorkflow = st === 'REFUND_PENDING' || st === 'REFUND_PROCESSING' || st === 'REFUNDED' || refSt === 'REFUND_PENDING' || refSt === 'REFUND_PROCESSING' || refSt === 'REFUNDED' || order.refund?.requested === true

                const statusStyle = getStatusColor(order.orderStatus || 'Confirmed')
                const canCancel = isEligibleForCancellation(order)

                // Step index for progress timeline
                let activeSteps = standardSteps
                let currentStepIdx = getStandardStepIndex(order)

                if (isRefundWorkflow) {
                  activeSteps = refundSteps
                  if (st === 'REFUNDED' || refSt === 'REFUNDED') currentStepIdx = 4
                  else if (st === 'REFUND_PROCESSING' || refSt === 'REFUND_PROCESSING') currentStepIdx = 3
                  else currentStepIdx = 2
                }

                return (
                  <div
                    key={order.id || order.orderId}
                    className="order-card-mobile"
                    style={{
                      background: '#ffffff',
                      borderRadius: '24px',
                      padding: '24px',
                      border: isRefundWorkflow ? '2px solid rgba(220,38,38,0.2)' : '1px solid rgba(13,90,58,0.1)',
                      boxShadow: '0 6px 24px rgba(0,0,0,0.04)',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    {/* Order Card Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <div onClick={() => setSelectedOrder(order)} style={{ cursor: 'pointer' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                          ORDER ID
                        </span>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ink)', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                          #{order.orderId || order.id?.slice(0, 8)}
                        </h3>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{order.createdAt}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span className="status-badge" style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, fontWeight: 900 }}>
                          ● {order.orderStatus || 'Confirmed'}
                        </span>

                        {/* PROMINENT CANCEL ORDER BUTTON (when eligible) */}
                        {canCancel && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCancelModalOrder(order)
                            }}
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1.5px solid #dc2626',
                              padding: '6px 14px',
                              borderRadius: '999px',
                              fontSize: '0.78rem',
                              fontWeight: 900,
                              cursor: 'pointer',
                              fontFamily: "'Outfit', sans-serif",
                              boxShadow: '0 2px 8px rgba(220,38,38,0.15)'
                            }}
                          >
                            Cancel Order 🚫
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Refund Banner if Refund Completed */}
                    {(st === 'REFUNDED' || refSt === 'REFUNDED') && (
                      <div style={{ background: '#d1fae5', border: '1.5px solid #059669', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px' }}>
                        <div style={{ color: '#059669', fontWeight: 900, fontSize: '0.95rem', fontFamily: "'Outfit', sans-serif", marginBottom: '4px' }}>
                          ✅ Refund Completed
                        </div>
                        <div style={{ color: '#065f46', fontSize: '0.85rem', fontWeight: 800 }}>
                          ₹{(order.refund?.amount || order.grandTotal || 0).toFixed(0)} refunded successfully
                        </div>
                        {order.refund?.refundedAt && (
                          <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                            Processed on {new Date(order.refund.refundedAt).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Progress Timeline (Standard or Refund Workflow) */}
                    <div className="order-progress-horizontal" style={{ margin: '16px 0', padding: '16px', background: '#faf9f6', borderRadius: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', margin: '0 10px' }}>
                        {activeSteps.map((step, idx) => {
                          const isDone = currentStepIdx >= idx
                          const isCurrent = currentStepIdx === idx
                          return (
                            <div key={step} style={{ textAlign: 'center', zIndex: 1, flex: 1 }}>
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: isDone ? (isRefundWorkflow ? '#dc2626' : 'var(--deep-green)') : '#e0e0e0',
                                color: isDone ? '#ffffff' : '#888888',
                                display: 'grid', placeItems: 'center',
                                margin: '0 auto 6px', fontSize: '0.75rem', fontWeight: '800',
                                border: isCurrent ? '3px solid var(--yellow)' : 'none'
                              }}>
                                {isDone ? '✓' : idx + 1}
                              </div>
                              <span style={{ fontSize: '0.68rem', fontWeight: isCurrent ? 800 : 600, color: isCurrent ? 'var(--deep-green)' : 'var(--muted)', display: 'block' }}>
                                {step}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Mobile Timeline */}
                    <div className="order-timeline-vertical" style={{ margin: '12px 0', padding: '16px', background: '#faf9f6', borderRadius: '16px' }}>
                      {activeSteps.map((step, idx) => {
                        const isDone = currentStepIdx >= idx
                        const isCurrent = currentStepIdx === idx
                        const isPending = currentStepIdx < idx
                        return (
                          <div key={step} className={`timeline-step ${isDone && !isCurrent ? 'done' : ''}`}>
                            <div className={`timeline-dot ${isDone && !isCurrent ? 'done' : ''} ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}`}>
                              {isDone ? '✓' : getStatusEmoji(step)}
                            </div>
                            <div className="timeline-info">
                              <p className={`timeline-label ${isPending ? 'muted' : ''}`}>{step}</p>
                              {isCurrent && <p className="timeline-sublabel">Current status</p>}
                              {isDone && !isCurrent && <p className="timeline-sublabel">Completed</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', cursor: 'pointer' }} onClick={() => setSelectedOrder(order)}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                        {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? '' : 's'} · Tap for receipt
                      </span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--deep-green)', fontFamily: "'Outfit', sans-serif" }}>
                        ₹{(order.grandTotal || 0).toFixed(0)}
                      </strong>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* CUSTOMER CANCELLATION CONFIRMATION MODAL */}
      {cancelModalOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={() => setCancelModalOrder(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} />

          <div style={{ position: 'relative', zIndex: 10, width: 'min(460px, 94vw)', background: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>⚠️</div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.35rem', fontWeight: 900, color: '#dc2626', margin: '0 0 8px 0' }}>
              Cancel Order?
            </h2>

            <p style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.45, fontWeight: 700, margin: '0 0 16px 0' }}>
              Your payment has already been verified by Biriyani Station. Cancelling this order will move it into the restaurant’s <strong>Refund Queue</strong> for manual verification and payout.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Cancellation Reason (Optional):
              </label>
              <textarea
                placeholder="e.g. Changed my mind, ordered by mistake..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1.5px solid rgba(0,0,0,0.15)',
                  fontSize: '0.88rem',
                  outline: 'none',
                  resize: 'none',
                  height: '70px',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                disabled={submittingCancel}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#f3f4f6',
                  color: 'var(--ink)',
                  border: 'none',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                Keep Order
              </button>

              <button
                type="button"
                onClick={handleRequestCancellation}
                disabled={submittingCancel}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                  boxShadow: '0 4px 14px rgba(220,38,38,0.3)'
                }}
              >
                {submittingCancel ? 'Submitting...' : 'Request Cancellation 🚫'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Receipt Bottom Sheet */}
      {selectedOrder && (
        <div className="co-overlay" aria-hidden="false" style={{ opacity: 1, visibility: 'visible', zIndex: 5000, position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <button type="button" className="co-backdrop" onClick={() => setSelectedOrder(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer' }} />
          <div className="order-detail-sheet" style={{ position: 'relative', zIndex: 10, width: 'min(540px, 94vw)', maxHeight: '85vh', overflowY: 'auto', background: '#ffffff', color: '#111827', borderRadius: '28px', padding: '24px 28px', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4)' }}>
            <div className="sheet-handle" style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--deep-green)', letterSpacing: '0.15em' }}>ORDER RECEIPT</span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>#{selectedOrder.orderId}</h2>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: '#f3f4f6', color: '#111827', border: 'none', borderRadius: '50%', width: '40px', height: '4px', height: '40px', cursor: 'pointer', fontSize: '1.1rem', display: 'grid', placeItems: 'center', fontWeight: 700 }}>✕</button>
            </div>

            <div style={{ padding: '14px 18px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '16px', marginBottom: '20px', color: '#1f2937' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.88rem', color: '#1f2937' }}><strong style={{ color: '#111827' }}>Customer:</strong> {selectedOrder.customerName || selectedOrder.userName}</p>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.88rem', color: '#1f2937' }}><strong style={{ color: '#111827' }}>Phone:</strong> {selectedOrder.customerPhone || selectedOrder.userPhone}</p>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#1f2937' }}><strong style={{ color: '#111827' }}>Address:</strong> {selectedOrder.deliveryAddress}</p>
            </div>

            <h4 style={{ fontSize: '0.85rem', letterSpacing: '0.1em', color: 'var(--deep-green)', marginBottom: '12px', fontWeight: 800 }}>ORDERED ITEMS</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {selectedOrder.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.92rem', padding: '12px 16px', background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px', color: '#1f2937' }}>
                  <span style={{ color: '#1f2937' }}>{item.title || item.name} <strong style={{ color: 'var(--deep-green)' }}>x{item.qty || item.quantity}</strong></span>
                  <strong style={{ color: '#111827' }}>₹{((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(0)}</strong>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: '800', color: '#111827' }}>
              <span>Total Paid</span>
              <span style={{ color: 'var(--deep-green)' }}>₹{(selectedOrder.grandTotal || 0).toFixed(0)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
