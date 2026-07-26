import { useEffect, useState } from 'react'
import Head from 'next/head'
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/AdminLayout'

export default function AdminRefundsDesk() {
  const { user, isAdmin } = useAuth()
  const [orders, setOrders] = useState([])
  const [filterTab, setFilterTab] = useState('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(true)

  const triggerFeedback = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  useEffect(() => {
    const fetchFallback = async () => {
      try {
        const res = await fetch('/api/orders/admin-all')
        if (res.ok) {
          const data = await res.json()
          if (data.orders) setOrders(data.orders)
        }
      } catch (e) {
      } finally {
        setLoading(false)
      }
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

        return {
          id: d.id,
          ...data,
          dateObj,
          createdAtFormatted: dateObj.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        }
      })

      fetched.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
      setOrders(fetched)
      setLoading(false)
    }, () => {
      fetchFallback()
    })

    return () => unsub()
  }, [])

  if (!user || !isAdmin) return null

  const handleUpdateRefund = async (orderId, targetAction) => {
    try {
      let targetStatus = 'REFUND_PROCESSING'
      if (targetAction === 'COMPLETE_REFUND') targetStatus = 'REFUNDED'

      const cleanDocId = String(orderId).replace(/^#/, '').trim()

      const docRef = doc(db, 'orders', cleanDocId)
      const updatePayload = {
        orderStatus: targetStatus,
        status: targetStatus,
        updatedAt: serverTimestamp(),
        'refund.status': targetStatus,
        'refund.requested': true
      }

      if (targetAction === 'START_PROCESSING') {
        updatePayload['refund.processingAt'] = new Date().toISOString()
      } else if (targetAction === 'COMPLETE_REFUND') {
        updatePayload.paymentStatus = 'refunded'
        updatePayload['refund.refundedAt'] = new Date().toISOString()
        updatePayload['refund.refundedBy'] = user.email || 'Admin'
      }

      await updateDoc(docRef, updatePayload).catch(async () => {
        if (orderId !== cleanDocId) {
          await updateDoc(doc(db, 'orders', orderId), updatePayload).catch(() => {})
        }
      })

      fetch('/api/orders/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: cleanDocId, action: targetAction, adminEmail: user.email })
      }).catch(() => {})

      triggerFeedback(targetAction === 'COMPLETE_REFUND' ? '✅ Refund completed successfully!' : '⏳ Refund marked as Processing!')
    } catch (err) {
      triggerFeedback('Error: ' + err.message)
    }
  }

  // Filter orders with refund activity
  const refundOrders = orders.filter(o => {
    const st = (o.orderStatus || o.status || '').toUpperCase()
    const refSt = (o.refund?.status || '').toUpperCase()
    return (
      st === 'REFUND_PENDING' ||
      st === 'REFUND_PROCESSING' ||
      st === 'REFUNDED' ||
      refSt === 'REFUND_PENDING' ||
      refSt === 'REFUND_PROCESSING' ||
      refSt === 'REFUNDED' ||
      o.refund?.requested === true
    )
  })

  // Financial Metrics Calculation
  const verifiedOrders = orders.filter(o => {
    const paySt = (o.paymentStatus || '').toLowerCase()
    const ordSt = (o.orderStatus || o.status || '').toLowerCase()
    return paySt === 'paid' || paySt === 'verified' || ordSt === 'accepted' || ordSt === 'confirmed' || ordSt === 'delivered' || ordSt === 'refunded'
  })

  const grossRevenue = verifiedOrders.reduce((sum, o) => sum + (o.grandTotal || o.amount || 0), 0)

  const completedRefundsList = refundOrders.filter(o => {
    const st = (o.orderStatus || o.status || '').toUpperCase()
    const refSt = (o.refund?.status || '').toUpperCase()
    return st === 'REFUNDED' || refSt === 'REFUNDED'
  })

  const totalRefundAmount = completedRefundsList.reduce((sum, o) => sum + (o.refund?.amount || o.grandTotal || 0), 0)

  const netRevenue = grossRevenue - totalRefundAmount

  const pendingRefunds = refundOrders.filter(o => {
    const st = (o.orderStatus || o.status || '').toUpperCase()
    const refSt = (o.refund?.status || '').toUpperCase()
    return (st === 'REFUND_PENDING' || refSt === 'REFUND_PENDING') && st !== 'REFUNDED' && refSt !== 'REFUNDED'
  })

  const processingRefunds = refundOrders.filter(o => {
    const st = (o.orderStatus || o.status || '').toUpperCase()
    const refSt = (o.refund?.status || '').toUpperCase()
    return (st === 'REFUND_PROCESSING' || refSt === 'REFUND_PROCESSING') && st !== 'REFUNDED' && refSt !== 'REFUNDED'
  })

  const todayStr = new Date().toDateString()
  const todayRefundAmount = completedRefundsList
    .filter(o => new Date(o.refund?.refundedAt || o.dateObj).toDateString() === todayStr)
    .reduce((sum, o) => sum + (o.refund?.amount || o.grandTotal || 0), 0)

  // Filter queue by current tab & search
  const filteredQueue = refundOrders.filter(o => {
    const st = (o.orderStatus || o.status || '').toUpperCase()
    const refSt = (o.refund?.status || '').toUpperCase()

    if (filterTab === 'pending') {
      if (st !== 'REFUND_PENDING' && refSt !== 'REFUND_PENDING') return false
    } else if (filterTab === 'processing') {
      if (st !== 'REFUND_PROCESSING' && refSt !== 'REFUND_PROCESSING') return false
    } else if (filterTab === 'refunded') {
      if (st !== 'REFUNDED' && refSt !== 'REFUNDED') return false
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

  return (
    <AdminLayout activePage="refunds" title="Refund Management & Accounting">
      <Head>
        <title>Refund Management Desk | Biriyani Station Admin</title>
      </Head>

      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '16px' }}>
        {feedback && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#0d5a3a',
            color: '#ffffff',
            padding: '12px 22px',
            borderRadius: '999px',
            fontWeight: 900,
            zIndex: 9999,
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            fontFamily: "'Outfit', sans-serif"
          }}>
            {feedback}
          </div>
        )}

        {/* Dashboard Accounting Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ background: '#ffffff', border: '1.5px solid rgba(13,90,58,0.12)', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              PENDING REFUNDS
            </span>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#dc2626', fontFamily: "'Outfit', sans-serif", marginTop: '4px' }}>
              {pendingRefunds.length} <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>orders</span>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid rgba(13,90,58,0.12)', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              PROCESSING REFUNDS
            </span>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#d97706', fontFamily: "'Outfit', sans-serif", marginTop: '4px' }}>
              {processingRefunds.length} <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>orders</span>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid rgba(13,90,58,0.12)', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              TOTAL REFUNDED
            </span>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#059669', fontFamily: "'Outfit', sans-serif", marginTop: '4px' }}>
              ₹{totalRefundAmount.toFixed(0)}
            </div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #0d5a3a 0%, #083c27 100%)', color: '#ffffff', borderRadius: '16px', padding: '16px', boxShadow: '0 6px 20px rgba(13,90,58,0.2)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              NET EARNED REVENUE
            </span>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, fontFamily: "'Outfit', sans-serif", marginTop: '4px' }}>
              ₹{netRevenue.toFixed(0)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
              Gross ₹{grossRevenue.toFixed(0)} - Refund ₹{totalRefundAmount.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div style={{ background: '#ffffff', borderRadius: '20px', padding: '16px', border: '1.5px solid rgba(13,90,58,0.12)', marginBottom: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setFilterTab('pending')}
                style={{
                  background: filterTab === 'pending' ? '#dc2626' : 'rgba(220, 38, 38, 0.08)',
                  color: filterTab === 'pending' ? '#ffffff' : '#dc2626',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '999px',
                  fontWeight: 900,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                🔴 Pending Queue ({pendingRefunds.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('processing')}
                style={{
                  background: filterTab === 'processing' ? '#d97706' : 'rgba(217, 119, 6, 0.08)',
                  color: filterTab === 'processing' ? '#ffffff' : '#d97706',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '999px',
                  fontWeight: 900,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                ⏳ Processing ({processingRefunds.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('refunded')}
                style={{
                  background: filterTab === 'refunded' ? '#059669' : 'rgba(5, 150, 105, 0.08)',
                  color: filterTab === 'refunded' ? '#ffffff' : '#059669',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '999px',
                  fontWeight: 900,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                ✅ Refunded ({completedRefundsList.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('all')}
                style={{
                  background: filterTab === 'all' ? '#0d5a3a' : 'rgba(13, 90, 58, 0.08)',
                  color: filterTab === 'all' ? '#ffffff' : '#0d5a3a',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '999px',
                  fontWeight: 900,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                All Refund Records ({refundOrders.length})
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder="🔍 Search by Order ID, Customer Name, Phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1.5px solid rgba(13,90,58,0.2)',
              fontSize: '0.9rem',
              fontWeight: 800,
              outline: 'none'
            }}
          />
        </div>

        {/* Refund Cards Queue */}
        {filteredQueue.length === 0 ? (
          <div style={{ padding: '60px 20px', background: '#ffffff', borderRadius: '24px', textAlign: 'center', border: '2px dashed rgba(13,90,58,0.15)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>💸</div>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.3rem', fontWeight: 900, color: '#0d5a3a', margin: '0 0 6px 0' }}>
              No Refunds in Queue
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', margin: 0, fontWeight: 700 }}>
              {searchQuery ? `No refund records matching "${searchQuery}"` : 'All customer refund requests have been processed successfully!'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {filteredQueue.map(ord => {
              const st = (ord.orderStatus || ord.status || '').toUpperCase()
              const refSt = (ord.refund?.status || '').toUpperCase()
              const isPending = st === 'REFUND_PENDING' || refSt === 'REFUND_PENDING'
              const isProcessing = st === 'REFUND_PROCESSING' || refSt === 'REFUND_PROCESSING'
              const isCompleted = st === 'REFUNDED' || refSt === 'REFUNDED'

              const customerName = ord.customerName || ord.userName || 'Customer'
              const rawPhone = (ord.customerPhone || ord.userPhone || '').replace(/[^0-9]/g, '')
              const requestedAtStr = ord.refund?.requestedAt ? new Date(ord.refund.requestedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ord.createdAtFormatted

              return (
                <div
                  key={ord.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    border: isPending ? '2px solid #dc2626' : isProcessing ? '2px solid #d97706' : '1.5px solid rgba(13,90,58,0.18)',
                    boxShadow: isPending ? '0 8px 24px rgba(220, 38, 38, 0.12)' : '0 4px 16px rgba(0,0,0,0.04)',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    gap: '14px'
                  }}
                >
                  {/* Top Bar: Order ID & Refund Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0d5a3a', fontFamily: "'JetBrains Mono', monospace" }}>
                      #{ord.orderId || ord.id.slice(0, 8)}
                    </span>

                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: isPending ? '#fee2e2' : isProcessing ? '#fef3c7' : '#d1fae5',
                      color: isPending ? '#dc2626' : isProcessing ? '#b45309' : '#059669',
                      fontFamily: "'Outfit', sans-serif"
                    }}>
                      {isPending ? '🔴 REFUND PENDING' : isProcessing ? '⏳ PROCESSING' : '✅ REFUNDED'}
                    </span>
                  </div>

                  {/* Customer Details */}
                  <div style={{ background: '#faf9f5', borderRadius: '12px', padding: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--ink)', fontFamily: "'Outfit', sans-serif" }}>
                      👤 {customerName}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#0284c7', fontWeight: 800, marginTop: '2px' }}>
                      📞 {ord.customerPhone || ord.userPhone || 'No Phone'}
                    </div>
                    {ord.refund?.cancellationReason && (
                      <div style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 800, marginTop: '6px', background: '#fee2e2', padding: '6px 8px', borderRadius: '6px' }}>
                        📝 Reason: {ord.refund.cancellationReason}
                      </div>
                    )}
                  </div>

                  {/* Financial Breakdown */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(13,90,58,0.04)', padding: '10px 12px', borderRadius: '10px' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--muted)', display: 'block', textTransform: 'uppercase' }}>
                        PAYMENT METHOD
                      </span>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>
                        {ord.paymentMethod === 'UPI' ? '💳 UPI Online' : '💵 Cash'}
                      </strong>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--muted)', display: 'block', textTransform: 'uppercase' }}>
                        REFUND AMOUNT
                      </span>
                      <strong style={{ fontSize: '1.35rem', fontWeight: 900, color: '#dc2626', fontFamily: "'Outfit', sans-serif" }}>
                        ₹{(ord.refund?.amount || ord.grandTotal || 0).toFixed(0)}
                      </strong>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700 }}>
                    🕒 Cancellation Requested: {requestedAtStr}
                  </div>

                  {/* Workflow Buttons */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!isCompleted && isPending && (
                      <button
                        type="button"
                        onClick={() => handleUpdateRefund(ord.id, 'START_PROCESSING')}
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: '12px',
                          background: '#d97706',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 900,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          fontFamily: "'Outfit', sans-serif",
                          boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)'
                        }}
                      >
                        Start Refund ⏳
                      </button>
                    )}

                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleUpdateRefund(ord.id, 'COMPLETE_REFUND')}
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: '12px',
                          background: '#059669',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 900,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          fontFamily: "'Outfit', sans-serif",
                          boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                        }}
                      >
                        Mark as Refunded ✅
                      </button>
                    )}

                    {isCompleted && (
                      <div style={{ width: '100%', textAlign: 'center', padding: '8px', background: '#d1fae5', color: '#059669', borderRadius: '10px', fontWeight: 900, fontSize: '0.84rem' }}>
                        ✅ Refund Processed by {ord.refund?.refundedBy || 'Admin'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
