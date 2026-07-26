import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import RouteGuard from '../components/RouteGuard'

export default function DeliveryPortal() {
  const { user, userRole, logout } = useAuth()
  const [orders, setOrders] = useState([])
  const [filterTab, setFilterTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedback, setFeedback] = useState(null)

  const triggerFeedback = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }

  // Real-time listener for Delivery Partner Orders
  useEffect(() => {
    const fetchFallback = async () => {
      try {
        const res = await fetch('/api/orders/admin-all')
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
        if (data.updatedAt?.toDate) {
          dateObj = data.updatedAt.toDate()
        } else if (data.createdAt?.toDate) {
          dateObj = data.createdAt.toDate()
        } else if (data.createdAtSeconds) {
          dateObj = new Date(data.createdAtSeconds * 1000)
        } else if (data.createdAt) {
          dateObj = new Date(data.createdAt)
        }

        const elapsedMinutes = Math.max(0, Math.floor((Date.now() - dateObj.getTime()) / 60000))

        return {
          id: d.id,
          ...data,
          dateObj,
          elapsedMinutes
        }
      })

      fetched.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
      setOrders(fetched)
    }, () => {
      fetchFallback()
    })

    return () => unsub()
  }, [])

  const handleUpdateStatus = async (orderId, newStatus) => {
    let paymentStatus = undefined
    if (newStatus === 'Delivered') paymentStatus = 'paid'

    try {
      const targetDoc = doc(db, 'orders', orderId)
      const updateData = {
        orderStatus: newStatus,
        updatedAt: serverTimestamp()
      }
      if (paymentStatus) updateData.paymentStatus = paymentStatus

      await updateDoc(targetDoc, updateData)

      fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderStatus: newStatus, paymentStatus })
      }).catch(() => {})

      triggerFeedback(`Order status updated to ${newStatus}`)
    } catch (e) {
      triggerFeedback(`Update error: ${e.message}`)
    }
  }

  // Filter Delivery Orders
  const readyOrders = orders.filter(o => {
    const st = (o.orderStatus || '').toLowerCase()
    return st === 'ready' || st === 'ready_for_delivery'
  })

  const outOrders = orders.filter(o => {
    const st = (o.orderStatus || '').toLowerCase()
    return st === 'out for delivery' || st === 'out_for_delivery'
  })

  const deliveredTodayCount = orders.filter(o => {
    const st = (o.orderStatus || '').toLowerCase()
    if (st !== 'delivered') return false
    const d = o.dateObj || new Date()
    return d.toDateString() === new Date().toDateString()
  }).length

  const activeDeliveryOrders = orders.filter(o => {
    const st = (o.orderStatus || o.status || '').toLowerCase()
    const refSt = (o.refund?.status || '').toLowerCase()

    if (st.includes('refund') || refSt.includes('refund') || o.refund?.requested === true) {
      return false
    }

    return st === 'ready' || st === 'ready_for_delivery' || st === 'out for delivery' || st === 'out_for_delivery'
  })

  const filteredOrders = activeDeliveryOrders.filter(o => {
    const st = (o.orderStatus || '').toLowerCase()
    if (filterTab === 'ready') {
      if (!(st === 'ready' || st === 'ready_for_delivery')) return false
    } else if (filterTab === 'out') {
      if (!(st === 'out for delivery' || st === 'out_for_delivery')) return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const nameMatch = (o.customerName || o.userName || '').toLowerCase().includes(q)
      const phoneMatch = (o.customerPhone || o.userPhone || '').toLowerCase().includes(q)
      const idMatch = (o.orderId || o.id || '').toLowerCase().includes(q)
      const addrMatch = (o.deliveryAddress || '').toLowerCase().includes(q)
      return nameMatch || phoneMatch || idMatch || addrMatch
    }

    return true
  })

  return (
    <RouteGuard allowedRoles={['delivery', 'admin']}>
      <Head>
        <title>Delivery Dispatch Desk | Biriyani Station</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#fcfaf4', color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: '40px' }}>
        {/* Toast Feedback */}
        {feedback && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0284c7',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '999px',
            fontSize: '0.9rem',
            fontWeight: 900,
            zIndex: 9999,
            boxShadow: '0 8px 30px rgba(2, 132, 199, 0.3)',
            fontFamily: "'Outfit', sans-serif"
          }}>
            🛵 {feedback}
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
          borderBottom: '3px solid #0284c7'
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#ffffff', color: '#0284c7', display: 'grid', placeItems: 'center', fontSize: '1.5rem', fontWeight: 900, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                🛵
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 900, letterSpacing: '0.04em', color: '#ffffff' }}>
                    BIRIYANI <span style={{ color: '#38bdf8' }}>STATION</span>
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, background: '#0284c7', color: '#ffffff', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Outfit', sans-serif" }}>
                    DISPATCH DESK
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                  Logistics & Transit • Delivery Role: <strong style={{ color: '#38bdf8' }}>{userRole.toUpperCase()}</strong>
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
          {/* Dashboard Interactive Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => setFilterTab('ready')}
              style={{
                background: filterTab === 'ready' ? '#7e22ce' : '#ffffff',
                color: filterTab === 'ready' ? '#ffffff' : '#7e22ce',
                border: '2px solid #7e22ce',
                borderRadius: '16px',
                padding: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 900, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
                🍱 WAITING PICKUP
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, fontFamily: "'Outfit', sans-serif", marginTop: '2px' }}>
                {readyOrders.length} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>ready</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('out')}
              style={{
                background: filterTab === 'out' ? '#0284c7' : '#ffffff',
                color: filterTab === 'out' ? '#ffffff' : '#0284c7',
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
                🛵 OUT FOR DELIVERY
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, fontFamily: "'Outfit', sans-serif", marginTop: '2px' }}>
                {outOrders.length} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>in transit</span>
              </div>
            </button>

            <div style={{ background: '#ffffff', border: '1.5px solid rgba(13,90,58,0.15)', borderRadius: '16px', padding: '14px', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#0d5a3a', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ✅ DELIVERED TODAY
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0d5a3a', fontFamily: "'Outfit', sans-serif", marginTop: '2px' }}>
                {deliveredTodayCount} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' }}>completed</span>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="🔍 Search Order ID, Customer, Address, Phone..."
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
              <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🛵</div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', fontWeight: 900, color: '#0284c7', margin: '0 0 6px 0' }}>
                No Active Deliveries
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'var(--muted)', margin: 0, fontWeight: 700 }}>
                {searchQuery ? `No active delivery orders matching "${searchQuery}"` : 'All prepared orders have been picked up and delivered!'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {filteredOrders.map(ord => {
                const st = (ord.orderStatus || '').toLowerCase()
                const isReady = st === 'ready' || st === 'ready_for_delivery'
                const isOut = st === 'out for delivery' || st === 'out_for_delivery'

                const customerName = ord.customerName || ord.userName || 'Customer'
                const rawPhone = (ord.customerPhone || ord.userPhone || '').replace(/[^0-9]/g, '')
                const waMessage = encodeURIComponent(`Hi ${customerName}, your Biriyani Station Patna order #${ord.orderId || ord.id.slice(0, 8)} is out for delivery!`)
                const addressQuery = encodeURIComponent(ord.deliveryAddress || 'Patna')

                return (
                  <div
                    key={ord.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '20px',
                      border: isOut ? '2.5px solid #0284c7' : '2px solid #7e22ce',
                      boxShadow: isOut ? '0 10px 30px rgba(2, 132, 199, 0.15)' : '0 6px 20px rgba(0,0,0,0.04)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justify: 'space-between',
                      position: 'relative'
                    }}
                  >
                    {/* Status Top Accent Bar */}
                    <div style={{ height: '6px', width: '100%', background: isOut ? '#0284c7' : '#7e22ce' }} />

                    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Header Row: Order ID & Timer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: isOut ? 'rgba(2, 132, 199, 0.06)' : 'rgba(126, 34, 206, 0.06)',
                          border: isOut ? '1.5px solid #0284c7' : '1.5px solid #7e22ce',
                          padding: '4px 12px',
                          borderRadius: '10px'
                        }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif" }}>ORDER ID:</span>
                          <span style={{ fontSize: '1rem', fontWeight: 900, color: isOut ? '#0284c7' : '#7e22ce', letterSpacing: '0.06em', fontFamily: "'JetBrains Mono', monospace" }}>
                            #{ord.orderId || ord.id.slice(0, 8)}
                          </span>
                        </div>

                        {/* Live Delivery Timer Ticker */}
                        <span style={{
                          fontSize: '0.78rem',
                          fontWeight: 900,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          background: isOut ? '#e0f2fe' : '#f3e8ff',
                          color: isOut ? '#0284c7' : '#7e22ce',
                          border: isOut ? '1px solid #0284c7' : '1px solid #7e22ce',
                          fontFamily: "'Outfit', sans-serif"
                        }}>
                          {isReady ? `⏱ Ready ${ord.elapsedMinutes}m ago` : `🛵 In Transit ${ord.elapsedMinutes}m`}
                        </span>
                      </div>

                      {/* HERO CUSTOMER & LOCATION BOX */}
                      <div style={{ background: '#faf9f5', borderRadius: '16px', padding: '14px', border: '1.5px solid rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--ink)', fontFamily: "'Outfit', sans-serif", marginBottom: '4px' }}>
                          👤 {customerName}
                        </div>

                        <div style={{ fontSize: '0.86rem', color: '#0284c7', fontWeight: 800, marginBottom: '8px' }}>
                          📞 {ord.customerPhone || ord.userPhone || 'No Phone'}
                        </div>

                        <div style={{ background: '#ffffff', borderRadius: '10px', padding: '10px', fontSize: '0.84rem', color: 'var(--ink)', fontWeight: 700, lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: '8px', border: '1px solid rgba(0,0,0,0.06)' }}>
                          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📍</span>
                          <span>{ord.deliveryAddress || 'Patna Delivery Address'}</span>
                        </div>
                      </div>

                      {/* PACKAGED ITEMS & PAYMENT METHOD */}
                      <div style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f6fbf8 100%)', borderRadius: '14px', padding: '12px 14px', border: '1px solid rgba(13,90,58,0.12)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', fontFamily: "'Outfit', sans-serif" }}>
                          PACKAGED ITEMS SUMMARY
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                          {ord.items?.map((item, idx) => (
                            <div key={idx} style={{ fontSize: '0.86rem', color: 'var(--ink)', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                              <span><strong style={{ color: '#0d5a3a' }}>{item.qty || item.quantity}x</strong> {item.title || item.name}</span>
                            </div>
                          ))}
                        </div>

                        <div style={{ borderTop: '2px dashed rgba(13,90,58,0.2)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 900, color: ord.paymentMethod === 'UPI' ? '#047857' : '#b45309', background: ord.paymentMethod === 'UPI' ? '#e6f4ea' : '#fef3c7', padding: '3px 9px', borderRadius: '6px' }}>
                            💳 {ord.paymentMethod === 'UPI' ? 'UPI Paid' : '💵 Cash on Delivery'}
                          </span>
                          <strong style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0d5a3a', fontFamily: "'Outfit', sans-serif" }}>
                            ₹{(ord.grandTotal || 0).toFixed(0)}
                          </strong>
                        </div>
                      </div>

                      {/* ONE-TOUCH QUICK LOGISTICS UTILITIES (Call, WhatsApp, Maps) */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        {rawPhone ? (
                          <a
                            href={`tel:+91${rawPhone}`}
                            style={{
                              background: '#0284c7',
                              color: '#ffffff',
                              padding: '10px 4px',
                              borderRadius: '10px',
                              fontSize: '0.8rem',
                              fontWeight: 900,
                              textAlign: 'center',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justify: 'center',
                              gap: '4px',
                              fontFamily: "'Outfit', sans-serif",
                              boxShadow: '0 2px 8px rgba(2,132,199,0.2)'
                            }}
                          >
                            📞 Call
                          </a>
                        ) : (
                          <div style={{ opacity: 0.5, textAlign: 'center', fontSize: '0.78rem', padding: '10px 4px' }}>No Phone</div>
                        )}

                        {rawPhone ? (
                          <a
                            href={`https://wa.me/91${rawPhone}?text=${waMessage}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: '#25d366',
                              color: '#ffffff',
                              padding: '10px 4px',
                              borderRadius: '10px',
                              fontSize: '0.8rem',
                              fontWeight: 900,
                              textAlign: 'center',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justify: 'center',
                              gap: '4px',
                              fontFamily: "'Outfit', sans-serif",
                              boxShadow: '0 2px 8px rgba(37,211,102,0.2)'
                            }}
                          >
                            💬 WhatsApp
                          </a>
                        ) : null}

                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${addressQuery}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: '#ea580c',
                            color: '#ffffff',
                            padding: '10px 4px',
                            borderRadius: '10px',
                            fontSize: '0.8rem',
                            fontWeight: 900,
                            textAlign: 'center',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justify: 'center',
                            gap: '4px',
                            fontFamily: "'Outfit', sans-serif",
                            boxShadow: '0 2px 8px rgba(234,88,12,0.2)'
                          }}
                        >
                          🧭 Maps
                        </a>
                      </div>

                      {/* ONE-TOUCH DELIVERY WORKFLOW ACTIONS */}
                      <div>
                        {isReady ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(ord.id, 'Out For Delivery')}
                            style={{
                              width: '100%',
                              padding: '14px',
                              borderRadius: '14px',
                              background: '#0284c7',
                              color: '#ffffff',
                              border: 'none',
                              fontWeight: 900,
                              fontSize: '0.98rem',
                              cursor: 'pointer',
                              fontFamily: "'Outfit', sans-serif",
                              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)'
                            }}
                          >
                            Pick Up & Start Delivery 🛵 ➔
                          </button>
                        ) : isOut ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(ord.id, 'Delivered')}
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
                            Mark as Delivered ✅
                          </button>
                        ) : null}
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
