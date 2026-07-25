import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

export default function MyOrdersPage() {
  const { user, isAdmin, openAuthModal } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isNavOpen, setIsNavOpen] = useState(false)

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
              dateStr = new Date(data.createdAt).toLocaleDateString()
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
      const res = await fetch(`/api/orders/user?userId=${user.uid}`)
      if (res.ok) {
        const data = await res.json()
        const fetchedList = data.orders || []
        if (fetchedList.length > 0) {
          setOrders(prev => {
            const map = new Map()
            // First load fetched, then let existing (or Firestore synced) items update/override
            fetchedList.forEach(item => map.set(item.orderId || item.id, item))
            prev.forEach(item => map.set(item.orderId || item.id, { ...map.get(item.orderId || item.id), ...item }))
            return Array.from(map.values())
          })
        }
      }
    } catch (e) {}
    setLoading(false)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'verification_pending':
      case 'payment_verification_pending':
      case 'Awaiting Payment Verification':
      case 'Pending':
        return { bg: 'rgba(245, 200, 66, 0.18)', color: '#8a6200', border: 'rgba(245, 200, 66, 0.4)' }
      case 'paid':
      case 'accepted':
      case 'Accepted':
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

  const statusSteps = ['Order Placed', 'Payment Verification Pending', 'Accepted', 'Preparing', 'Ready', 'Out For Delivery', 'Delivered']

  const getStatusEmoji = (step) => {
    const map = {
      'Order Placed': '\u{1F4CB}',
      'Payment Verification Pending': '\u{1F504}',
      'Accepted': '\u2705',
      'Preparing': '\u{1F468}\u200D\u{1F373}',
      'Ready': '\u{1F37D}\uFE0F',
      'Out For Delivery': '\u{1F6F5}',
      'Delivered': '\u{1F389}'
    }
    return map[step] || '\u25CB'
  }

  useEffect(() => {
    document.body.style.overflow = selectedOrder ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedOrder])

  return (
    <>
      <Head>
        <title>My Orders | Biriyani Station Patna</title>
      </Head>

      <header className="site-header scrolled" id="top">
        <nav className="nav container">
          <Link href="/" className="logo">BIRIYANI <span>STATION</span></Link>

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
            <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.22em', color: 'var(--deep-green)', textTransform: 'uppercase' }}>
              REAL-TIME TRACKING
            </span>
            <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(2rem, 6vw, 2.8rem)', fontWeight: 900, color: 'var(--ink)', margin: '6px 0' }}>
              My Orders
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
              Track live updates as our chefs prepare your dum pukht biryani & clay-oven tandoori kawabs.
            </p>
          </div>

          {!user ? (
            <div className="empty-state">
              <span className="empty-state-icon">{'\u{1F512}'}</span>
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
              <span className="empty-state-icon">{'\u{1F372}'}</span>
              <h2>No Orders Placed Yet</h2>
              <p>Explore our authentic charcoal kawabs and dum biryanis to place your first order!</p>
              <Link href="/menu" className="btn" style={{ padding: '14px 32px' }}>EXPLORE MENU</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {orders.map((order) => {
                const statusStyle = getStatusColor(order.orderStatus || 'Confirmed')
                const currentStepIdx = statusSteps.indexOf(order.orderStatus)
                
                return (
                  <div
                    key={order.id || order.orderId}
                    className="order-card-mobile"
                    style={{
                      background: '#ffffff',
                      borderRadius: '24px',
                      padding: '24px',
                      border: '1px solid rgba(13,90,58,0.1)',
                      boxShadow: '0 6px 24px rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="order-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <div>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                          ORDER ID
                        </span>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
                          #{order.orderId || order.id?.slice(0, 8)}
                        </h3>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{order.createdAt}</span>
                      </div>
                      <span className="status-badge" style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                        {'\u25CF'} {order.orderStatus || 'Confirmed'}
                      </span>
                    </div>

                    {(order.paymentStatus === 'verification_pending' || order.orderStatus === 'payment_verification_pending' || order.orderStatus === 'Awaiting Payment Verification') && (
                      <div style={{ background: 'rgba(245, 200, 66, 0.14)', border: '1px solid rgba(245, 200, 66, 0.4)', borderRadius: '14px', padding: '12px 14px', marginBottom: '14px' }}>
                        <p style={{ margin: 0, color: '#8a6200', fontWeight: 800, fontSize: '0.85rem' }}>
                          {'\u{1F7E1}'} Payment Verification Pending
                        </p>
                        <p style={{ margin: '4px 0 0 0', color: '#665000', fontSize: '0.8rem', lineHeight: 1.5 }}>
                          Submitted. Verifying now. Est: 1\u20135 min.
                        </p>
                      </div>
                    )}

                    {(order.paymentStatus === 'paid' || order.paymentStatus === 'Paid') && (
                      <div style={{ background: 'rgba(13, 90, 58, 0.12)', border: '1px solid rgba(13, 90, 58, 0.3)', borderRadius: '14px', padding: '12px 14px', marginBottom: '14px' }}>
                        <p style={{ margin: 0, color: 'var(--deep-green)', fontWeight: 800, fontSize: '0.85rem' }}>
                          {'\u{1F7E2}'} Payment Verified
                        </p>
                      </div>
                    )}

                    {(order.paymentStatus === 'rejected' || order.orderStatus === 'cancelled' || order.orderStatus === 'Payment Failed') && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '14px', padding: '12px 14px', marginBottom: '14px' }}>
                        <p style={{ margin: 0, color: '#dc2626', fontWeight: 800, fontSize: '0.85rem' }}>
                          {'\u274C'} Payment Failed
                        </p>
                      </div>
                    )}

                    {/* Desktop: Horizontal Progress */}
                    <div className="order-progress-horizontal" style={{ margin: '16px 0', padding: '16px', background: '#faf9f6', borderRadius: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', margin: '0 10px' }}>
                        {statusSteps.map((step, idx) => {
                          const isDone = currentStepIdx >= idx
                          const isCurrent = currentStepIdx === idx
                          return (
                            <div key={step} style={{ textAlign: 'center', zIndex: 1, flex: 1 }}>
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: isDone ? 'var(--deep-green)' : '#e0e0e0',
                                color: isDone ? '#ffffff' : '#888888',
                                display: 'grid', placeItems: 'center',
                                margin: '0 auto 6px', fontSize: '0.75rem', fontWeight: '800',
                                border: isCurrent ? '3px solid var(--yellow)' : 'none'
                              }}>
                                {isDone ? '\u2713' : idx + 1}
                              </div>
                              <span style={{ fontSize: '0.68rem', fontWeight: isCurrent ? 800 : 600, color: isCurrent ? 'var(--deep-green)' : 'var(--muted)', display: 'block' }}>
                                {step}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Mobile: Vertical Timeline */}
                    <div className="order-timeline-vertical" style={{ margin: '12px 0', padding: '16px', background: '#faf9f6', borderRadius: '16px' }}>
                      {statusSteps.map((step, idx) => {
                        const isDone = currentStepIdx >= idx
                        const isCurrent = currentStepIdx === idx
                        const isPending = currentStepIdx < idx
                        return (
                          <div key={step} className={`timeline-step ${isDone && !isCurrent ? 'done' : ''}`}>
                            <div className={`timeline-dot ${isDone && !isCurrent ? 'done' : ''} ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}`}>
                              {isDone ? '\u2713' : getStatusEmoji(step)}
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

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                        {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? '' : 's'} {'\u00B7'} Tap for details
                      </span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--deep-green)' }}>
                        {'\u20B9'}{(order.grandTotal || 0).toFixed(0)}
                      </strong>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <div className="mobile-bottom-bar">
        <nav>
          <Link href="/"><span className="tab-icon">{'\u{1F3E0}'}</span>Home</Link>
          <Link href="/menu"><span className="tab-icon">{'\u{1F35B}'}</span>Menu</Link>
          <Link href="/my-orders" className="active"><span className="tab-icon">{'\u{1F4E6}'}</span>Orders</Link>
          {user && isAdmin && (
            <Link href="/admin" style={{ color: 'var(--deep-green)', fontWeight: 800 }}>
              <span className="tab-icon">🛡️</span>
              Admin
            </Link>
          )}
          {user ? (
            <Link href="/profile"><span className="tab-icon">{'\u{1F464}'}</span>Profile</Link>
          ) : (
            <button type="button" onClick={openAuthModal}><span className="tab-icon">{'\u{1F510}'}</span>Sign In</button>
          )}
        </nav>
      </div>

      {/* Order Detail Bottom Sheet */}
      {selectedOrder && (
        <div className="co-overlay" aria-hidden="false" style={{ opacity: 1, visibility: 'visible', zIndex: 5000, position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <button type="button" className="co-backdrop" onClick={() => setSelectedOrder(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer' }} />
          <div className="order-detail-sheet" style={{ position: 'relative', zIndex: 10, width: 'min(540px, 94vw)', maxHeight: '85vh', overflowY: 'auto', background: '#ffffff', color: '#111827', borderRadius: '28px', padding: '24px 28px', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4)' }}>
            <div className="sheet-handle" style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--deep-green)', letterSpacing: '0.15em' }}>ORDER RECEIPT</span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', margin: 0 }}>#{selectedOrder.orderId}</h2>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: '#f3f4f6', color: '#111827', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', fontSize: '1.1rem', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{'\u2715'}</button>
            </div>

            <div style={{ padding: '14px 18px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '16px', marginBottom: '20px', color: '#1f2937' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.88rem', color: '#1f2937' }}><strong style={{ color: '#111827' }}>Customer:</strong> {selectedOrder.customerName || selectedOrder.userName}</p>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.88rem', color: '#1f2937' }}><strong style={{ color: '#111827' }}>Phone:</strong> {selectedOrder.customerPhone || selectedOrder.userPhone}</p>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#1f2937' }}><strong style={{ color: '#111827' }}>Address:</strong> {selectedOrder.deliveryAddress}</p>
            </div>

            <h4 style={{ fontSize: '0.85rem', letterSpacing: '0.1em', color: 'var(--deep-green)', marginBottom: '12px', fontWeight: 800 }}>ORDERED ITEMS</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {selectedOrder.items?.map(item => (
                <div key={item.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.92rem', padding: '12px 16px', background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px', color: '#1f2937' }}>
                  <span style={{ color: '#1f2937' }}>{item.title} <strong style={{ color: 'var(--deep-green)' }}>x{item.qty || item.quantity}</strong></span>
                  <strong style={{ color: '#111827' }}>{'\u20B9'}{((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(0)}</strong>
                </div>
              ))}
            </div>

            {selectedOrder.appliedCoupon && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', marginBottom: '16px', color: '#065f46', fontWeight: 700 }}>
                <span>🏷️ Coupon ({selectedOrder.appliedCoupon})</span>
                <span>-₹{(selectedOrder.discount || 0).toFixed(0)}</span>
              </div>
            )}

            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: '800', color: '#111827' }}>
              <span>Total Paid</span>
              <span style={{ color: 'var(--deep-green)' }}>{'\u20B9'}{(selectedOrder.grandTotal || 0).toFixed(0)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
