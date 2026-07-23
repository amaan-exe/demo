import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

export default function MyOrdersPage() {
  const { user, openAuthModal } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)

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
      // Simple query — no orderBy to avoid composite index requirement
      const q = query(ordersRef, where('userId', '==', user.uid))

      unsubscribe = onSnapshot(q, (snapshot) => {
        const orderList = snapshot.docs.map(docSnap => {
          const data = docSnap.data()
          // Safe date parsing — handle pending serverTimestamp()
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

        // Sort by orderId descending (more recent = higher number) since we can't use orderBy
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
        setOrders(data.orders || [])
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

  return (
    <>
      <Head>
        <title>My Orders | Biriyani Station Patna</title>
      </Head>

      <header className="site-header scrolled" id="top">
        <nav className="nav container">
          <Link href="/" className="logo">BIRIYANI <span>STATION</span></Link>
          <div className="nav-right">
            <Link href="/">HOME</Link>
            <Link href="/menu">MENU</Link>
            <Link href="/my-orders" className="active" style={{ color: 'var(--yellow)' }}>MY ORDERS</Link>
          </div>
        </nav>
      </header>

      <main style={{ minHeight: '80vh', padding: '120px 0 80px 0', background: 'var(--cream)' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.22em', color: 'var(--deep-green)', textTransform: 'uppercase' }}>
              REAL-TIME TRACKING
            </span>
            <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.8rem', fontWeight: 900, color: 'var(--ink)', margin: '6px 0' }}>
              My Orders
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
              Track live updates as our chefs prepare your dum pukht biryani & clay-oven tandoori kawabs.
            </p>
          </div>

          {!user ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '8px' }}>Please Sign In</h2>
              <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>You must be logged in to view your orders.</p>
              <button onClick={openAuthModal} className="btn" style={{ padding: '12px 28px' }}>SIGN IN NOW</button>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--muted)', fontWeight: 600 }}>Syncing live orders with Firestore...</p>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🍲</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '8px' }}>No Orders Placed Yet</h2>
              <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>Explore our authentic charcoal kawabs and dum biryanis to place your first order!</p>
              <Link href="/menu" className="btn" style={{ padding: '14px 32px' }}>EXPLORE MENU</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {orders.map((order) => {
                const statusStyle = getStatusColor(order.orderStatus || 'Confirmed')
                const currentStepIdx = statusSteps.indexOf(order.orderStatus)
                
                return (
                  <div
                    key={order.id || order.orderId}
                    style={{
                      background: '#ffffff',
                      borderRadius: '24px',
                      padding: '28px',
                      border: '1px solid rgba(13,90,58,0.1)',
                      boxShadow: '0 6px 24px rgba(0,0,0,0.04)',
                      transition: 'transform 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                          ORDER ID
                        </span>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
                          #{order.orderId || order.id?.slice(0, 8)}
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{order.createdAt}</span>
                      </div>

                      <span
                        style={{
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`,
                          padding: '6px 16px',
                          borderRadius: '999px',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase'
                        }}
                      >
                        ● {order.orderStatus || 'Confirmed'}
                      </span>
                    </div>

                    {/* UPI Verification Banner */}
                    {(order.paymentStatus === 'verification_pending' || order.orderStatus === 'payment_verification_pending' || order.orderStatus === 'Awaiting Payment Verification') && (
                      <div style={{ background: 'rgba(245, 200, 66, 0.14)', border: '1px solid rgba(245, 200, 66, 0.4)', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px' }}>
                        <p style={{ margin: 0, color: '#8a6200', fontWeight: 800, fontSize: '0.88rem' }}>
                          🟡 Payment Verification Pending
                        </p>
                        <p style={{ margin: '4px 0 0 0', color: '#665000', fontSize: '0.82rem', lineHeight: 1.5 }}>
                          Your payment has been submitted successfully. The restaurant is verifying your payment. Your order will automatically begin once the payment has been confirmed.
                          <br/>
                          <span style={{ fontWeight: 700, opacity: 0.9 }}>Estimated verification time: 1–5 minutes.</span>
                        </p>
                        {order.transactionReference && (
                          <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#8a6200', fontWeight: 700 }}>
                            UTR Reference: <code>{order.transactionReference}</code>
                          </div>
                        )}
                      </div>
                    )}

                    {(order.paymentStatus === 'paid' || order.paymentStatus === 'Paid') && (
                      <div style={{ background: 'rgba(13, 90, 58, 0.12)', border: '1px solid rgba(13, 90, 58, 0.3)', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px' }}>
                        <p style={{ margin: 0, color: 'var(--deep-green)', fontWeight: 800, fontSize: '0.88rem' }}>
                          🟢 Payment Verified
                        </p>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--ink)', fontSize: '0.82rem' }}>
                          Your payment has been verified. The restaurant has accepted your order and will begin preparation shortly!
                        </p>
                      </div>
                    )}

                    {(order.paymentStatus === 'rejected' || order.orderStatus === 'cancelled' || order.orderStatus === 'Payment Failed') && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px' }}>
                        <p style={{ margin: 0, color: '#dc2626', fontWeight: 800, fontSize: '0.88rem' }}>
                          ❌ Payment Verification Failed
                        </p>
                        <p style={{ margin: '4px 0 0 0', color: '#991b1b', fontSize: '0.82rem' }}>
                          We could not verify your UPI payment. Reason: <strong>{order.rejectionReason || 'Payment Not Received'}</strong>.
                          <br/>
                          Please contact the restaurant at <strong>+91 82713 01179</strong> if you believe this is an error.
                        </p>
                      </div>
                    )}

                    {/* Progress Tracker Bar */}
                    <div style={{ margin: '20px 0', padding: '16px', background: '#faf9f6', borderRadius: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', margin: '0 10px' }}>
                        {statusSteps.map((step, idx) => {
                          const isDone = currentStepIdx >= idx
                          const isCurrent = currentStepIdx === idx
                          return (
                            <div key={step} style={{ textAlign: 'center', zIndex: 1, flex: 1 }}>
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: isDone ? 'var(--deep-green)' : '#e0e0e0',
                                  color: isDone ? '#ffffff' : '#888888',
                                  display: 'grid',
                                  placeItems: 'center',
                                  margin: '0 auto 6px',
                                  fontSize: '0.75rem',
                                  fontWeight: '800',
                                  border: isCurrent ? '3px solid var(--yellow)' : 'none'
                                }}
                              >
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

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                        {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? '' : 's'} · Total Amount
                      </span>
                      <strong style={{ fontSize: '1.3rem', color: 'var(--deep-green)' }}>
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

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="co-overlay" aria-hidden="false" style={{ opacity: 1, visibility: 'visible', zIndex: 3000 }}>
          <button type="button" className="co-backdrop" onClick={() => setSelectedOrder(null)} />
          <div className="auth-modal-panel" style={{ width: 'min(540px, 94vw)', background: '#ffffff', borderRadius: '28px', padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--deep-green)', letterSpacing: '0.2em' }}>ORDER RECEIPT</span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--ink)', margin: 0 }}>#{selectedOrder.orderId}</h2>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '14px 18px', background: '#f9f8f5', borderRadius: '16px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem' }}><strong>Customer:</strong> {selectedOrder.customerName || selectedOrder.userName}</p>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem' }}><strong>Phone:</strong> {selectedOrder.customerPhone || selectedOrder.userPhone}</p>
              <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>Address:</strong> {selectedOrder.deliveryAddress}</p>
            </div>

            <h4 style={{ fontSize: '0.9rem', letterSpacing: '0.1em', color: 'var(--deep-green)', marginBottom: '12px' }}>ORDERED ITEMS</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {selectedOrder.items?.map(item => (
                <div key={item.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>{item.title} <strong>x{item.qty || item.quantity}</strong></span>
                  <strong>₹{((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(0)}</strong>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: '800' }}>
              <span>Total Paid</span>
              <span style={{ color: 'var(--deep-green)' }}>₹{(selectedOrder.grandTotal || 0).toFixed(0)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
