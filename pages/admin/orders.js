import { useEffect, useState, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'

export default function AdminOrdersDesk() {
  const { user, isAdmin } = useAuth()
  const [orders, setOrders] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [mounted, setMounted] = useState(false)
  const [firestoreError, setFirestoreError] = useState(null)
  const [newOrderIds, setNewOrderIds] = useState(new Set())
  const [actionFeedback, setActionFeedback] = useState(null)
  const prevOrderCount = useRef(0)
  const isFirstLoad = useRef(true)

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
            dateFormatted = data.createdAt.toDate().toLocaleString()
          } else if (data.createdAt) {
            dateFormatted = new Date(data.createdAt).toLocaleString()
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
        setActionFeedback('🔔 New Order Arrived!')
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
      showToast(`⚡ Order Status set to ${newStatus}`)
    } catch (err) {
      console.error('Update Status Error:', err)
    }
  }

  const handleApprovePayment = async (orderId) => {
    try {
      const orderRef = doc(db, 'orders', orderId)
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        orderStatus: 'accepted',
        paymentVerifiedBy: user?.uid || 'admin',
        paymentVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(() => {})

      fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentStatus: 'paid', orderStatus: 'accepted' })
      }).catch(() => {})

      setOrders(prev => prev.map(o => (o.orderId === orderId || o.id === orderId) ? { ...o, paymentStatus: 'paid', orderStatus: 'accepted' } : o))
      showToast('✅ Payment Approved! Order Moved to Accepted')
    } catch (err) {
      alert('Error approving payment: ' + err.message)
    }
  }

  const handleRejectPayment = async (orderId) => {
    if (!window.confirm('Are you sure you want to reject this payment?\nReason: Payment Not Received')) return
    try {
      const orderRef = doc(db, 'orders', orderId)
      await updateDoc(orderRef, {
        paymentStatus: 'rejected',
        orderStatus: 'cancelled',
        rejectionReason: 'Payment Not Received',
        updatedAt: serverTimestamp()
      }).catch(() => {})

      fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentStatus: 'rejected', orderStatus: 'cancelled', rejectionReason: 'Payment Not Received' })
      }).catch(() => {})

      setOrders(prev => prev.map(o => (o.orderId === orderId || o.id === orderId) ? { ...o, paymentStatus: 'rejected', orderStatus: 'cancelled' } : o))
      showToast('❌ Payment Rejected & Order Cancelled')
    } catch (err) {
      alert('Error rejecting payment: ' + err.message)
    }
  }

  const filteredOrders = orders.filter(o => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'UPI Verification Pending') return o.paymentMethod === 'UPI' && (o.paymentStatus === 'Verification Pending' || o.paymentStatus === 'verification_pending' || o.orderStatus === 'payment_verification_pending' || o.orderStatus === 'Awaiting Payment Verification')
    return o.orderStatus === filterStatus
  })

  if (!mounted) return null

  if (!user || !isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ink)', color: '#ffffff', padding: '20px' }}>
        <div style={{ background: '#182820', padding: '48px 36px', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🛡️</div>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2rem', color: 'var(--yellow)', margin: '0 0 8px 0' }}>
            Admin Access Required
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.92rem', marginBottom: '24px', lineHeight: 1.6 }}>
            {user ? `Logged in as ${user.email}. This account does not have Admin verification permissions.` : 'Please sign in with an authorized Admin account to access the orders desk.'}
          </p>
          <Link href="/" className="btn" style={{ width: '100%', background: 'var(--yellow)', color: 'var(--ink)', padding: '12px', fontWeight: 800 }}>
            ← Return to Customer Storefront
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Real-Time Orders Desk | Biriyani Station Admin</title>
      </Head>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f5f0' }}>
        {/* Sidebar */}
        <aside style={{ width: '260px', background: '#092419', color: '#ffffff', padding: '32px 20px', sticky: 'top', position: 'sticky', top: 0, height: '100vh' }}>
          <div style={{ paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--yellow)', textTransform: 'uppercase' }}>PATNA DESK</span>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ffffff', margin: 0 }}>Admin Portal</h2>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link href="/admin" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
              📊 Dashboard
            </Link>
            <Link href="/admin/orders" style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--yellow)', color: 'var(--ink)', fontWeight: 800, textDecoration: 'none' }}>
              🛵 Orders Desk ({orders.length})
            </Link>
            <Link href="/admin/menu" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
              🍲 Menu Items
            </Link>
            <Link href="/admin/categories" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
              📁 Categories
            </Link>
            <Link href="/admin/coupons" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
              🏷️ Coupons
            </Link>
            <Link href="/admin/users" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
              👥 Users
            </Link>
            <Link href="/admin/settings" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
              ⚙️ Settings
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, padding: '40px' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.2em', color: 'var(--deep-green)', textTransform: 'uppercase' }}>
                REAL-TIME FIRESTORE LISTENER
              </span>
              <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.4rem', fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                Orders Management Desk
              </h1>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', background: '#ffffff', padding: '6px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.08)', flexWrap: 'wrap' }}>
              {['all', 'UPI Verification Pending', 'Pending', 'Accepted', 'Preparing', 'Ready', 'Out For Delivery', 'Delivered', 'Cancelled'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: filterStatus === status ? 'var(--deep-green)' : 'transparent',
                    color: filterStatus === status ? '#ffffff' : 'var(--ink)',
                    fontWeight: '700',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  {status === 'UPI Verification Pending' ? '💳 UPI Verification' : status.toUpperCase()}
                </button>
              ))}
            </div>
          </header>

          {/* Action Feedback Floating Notification */}
          {actionFeedback && (
            <div style={{
              position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
              background: '#092419', color: 'var(--yellow)', border: '1px solid rgba(245,200,66,0.3)',
              padding: '14px 22px', borderRadius: '16px', fontWeight: 800, fontSize: '0.9rem',
              boxShadow: '0 8px 30px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* Firestore Error Banner */}
          {firestoreError && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '16px',
              padding: '20px 24px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '12px'
            }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div>
                <h4 style={{ margin: '0 0 6px 0', color: '#991b1b', fontSize: '0.95rem', fontWeight: 800 }}>
                  Firestore Real-Time Listener Error
                </h4>
                <p style={{ margin: '0 0 8px 0', color: '#7f1d1d', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {firestoreError}
                </p>
                <p style={{ margin: 0, color: '#991b1b', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  <strong>Most likely fix:</strong> Update your{' '}
                  <a href="https://console.firebase.google.com/project/biriyani-station-patna/firestore/rules"
                     target="_blank" rel="noopener noreferrer"
                     style={{ color: '#1d4ed8', textDecoration: 'underline' }}>
                    Firestore Security Rules
                  </a>
                  {' '}to allow authenticated admin users to read all orders.
                </p>
              </div>
            </div>
          )}

          {/* Orders Cards Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {filteredOrders.length === 0 ? (
              <div style={{ textAlignment: 'center', padding: '60px', background: '#ffffff', borderRadius: '24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>No orders found for this filter status.</p>
              </div>
            ) : (
              filteredOrders.map((ord) => (
                <div key={ord.id} style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 4px 18px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--deep-green)', letterSpacing: '0.15em' }}>ORDER #{ord.orderId || ord.id.slice(0, 8)}</span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', margin: '4px 0' }}>{ord.customerName || ord.userName}</h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>📞 {ord.customerPhone || ord.userPhone} · 📍 {ord.deliveryAddress}</p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '999px', background: 'rgba(13,90,58,0.1)', color: 'var(--deep-green)', fontWeight: '800', fontSize: '0.85rem', marginBottom: '4px' }}>
                        ● {ord.orderStatus || 'Confirmed'}
                      </span>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>{ord.createdAtFormatted}</p>
                    </div>
                  </div>

                  {/* UPI Payment Verification Box */}
                  {ord.paymentMethod === 'UPI' && (
                    <div style={{ background: (ord.paymentStatus === 'paid' || ord.paymentStatus === 'Paid') ? 'rgba(13,90,58,0.08)' : (ord.paymentStatus === 'rejected' || ord.paymentStatus === 'Rejected') ? 'rgba(239,68,68,0.08)' : 'rgba(245,200,66,0.14)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase' }}>
                            📲 PAYMENT METHOD: UPI ONLINE
                          </span>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', fontWeight: 800, color: (ord.paymentStatus === 'paid' || ord.paymentStatus === 'Paid') ? 'var(--deep-green)' : (ord.paymentStatus === 'rejected' || ord.paymentStatus === 'Rejected') ? '#dc2626' : '#d97706' }}>
                            PAYMENT STATUS: {ord.paymentStatus === 'verification_pending' ? 'Verification Pending' : ord.paymentStatus || 'Verification Pending'}
                          </p>
                          {ord.transactionReference && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)' }}>
                              💳 UTR / Reference: <code style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)' }}>{ord.transactionReference}</code>
                            </p>
                          )}
                        </div>

                        {(ord.paymentStatus === 'verification_pending' || ord.paymentStatus === 'Verification Pending' || ord.orderStatus === 'payment_verification_pending' || ord.orderStatus === 'Awaiting Payment Verification') && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => handleApprovePayment(ord.id)}
                              style={{ background: 'var(--deep-green)', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(13,90,58,0.2)' }}
                            >
                              Approve Payment
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectPayment(ord.id)}
                              style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(220,38,38,0.2)' }}
                            >
                              Reject Payment
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Items List */}
                  <div style={{ background: '#fcfcf9', padding: '16px', borderRadius: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                      {ord.items?.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 800, background: 'var(--yellow)', color: 'var(--ink)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem' }}>
                            {item.qty || item.quantity}x
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>{item.title || item.name}</span>
                          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>₹{((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: '12px', paddingTop: '10px', textAlign: 'right', fontWeight: 900, fontSize: '1.1rem', color: 'var(--deep-green)' }}>
                      Total: ₹{(ord.grandTotal || 0).toFixed(0)}
                    </div>
                  </div>

                  {/* Live Status Control Action Stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.1em' }}>UPDATE STATUS:</span>
                    <button onClick={() => handleUpdateStatus(ord.id, 'Accepted')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #1a73e8', background: ord.orderStatus === 'Accepted' ? '#1a73e8' : '#ffffff', color: ord.orderStatus === 'Accepted' ? '#ffffff' : '#1a73e8', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem' }}>Accept</button>
                    <button onClick={() => handleUpdateStatus(ord.id, 'Preparing')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #d97706', background: ord.orderStatus === 'Preparing' ? '#d97706' : '#ffffff', color: ord.orderStatus === 'Preparing' ? '#ffffff' : '#d97706', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem' }}>Preparing</button>
                    <button onClick={() => handleUpdateStatus(ord.id, 'Ready')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #7e22ce', background: ord.orderStatus === 'Ready' ? '#7e22ce' : '#ffffff', color: ord.orderStatus === 'Ready' ? '#ffffff' : '#7e22ce', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem' }}>Ready</button>
                    <button onClick={() => handleUpdateStatus(ord.id, 'Out For Delivery')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #0891b2', background: ord.orderStatus === 'Out For Delivery' ? '#0891b2' : '#ffffff', color: ord.orderStatus === 'Out For Delivery' ? '#ffffff' : '#0891b2', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem' }}>Out For Delivery</button>
                    <button onClick={() => handleUpdateStatus(ord.id, 'Delivered')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--deep-green)', background: ord.orderStatus === 'Delivered' ? 'var(--deep-green)' : '#ffffff', color: ord.orderStatus === 'Delivered' ? '#ffffff' : 'var(--deep-green)', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem' }}>Delivered</button>
                    <button onClick={() => handleUpdateStatus(ord.id, 'Cancelled')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #dc2626', background: ord.orderStatus === 'Cancelled' ? '#dc2626' : '#ffffff', color: ord.orderStatus === 'Cancelled' ? '#ffffff' : '#dc2626', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem' }}>Cancel</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </>
  )
}
