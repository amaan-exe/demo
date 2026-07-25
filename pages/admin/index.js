import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import AdminLayout from '../../components/AdminLayout'

export default function AdminDashboard() {
  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)

  // Real-time Firestore sync
  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, (err) => console.warn('Orders snap notice:', err.message))

    const unsubMenu = onSnapshot(collection(db, 'menu'), (snap) => {
      setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, (err) => console.warn('Menu snap notice:', err.message))

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, (err) => console.warn('Users snap notice:', err.message))

    return () => {
      unsubOrders()
      unsubMenu()
      unsubUsers()
    }
  }, [])

  // Calculate Metrics
  const pendingCount = orders.filter(o =>
    o.orderStatus === 'payment_verification_pending' ||
    o.orderStatus === 'verification_pending' ||
    o.orderStatus === 'Awaiting Payment Verification' ||
    o.orderStatus === 'Pending' ||
    o.orderStatus === 'Accepted' ||
    o.orderStatus === 'Preparing'
  ).length
  const completedCount = orders.filter(o => o.orderStatus === 'Delivered' || o.orderStatus === 'delivered').length
  const totalRevenue = orders.filter(o => o.orderStatus === 'Delivered' || o.orderStatus === 'delivered').reduce((sum, o) => sum + (o.grandTotal || 0), 0)

  return (
    <AdminLayout activePage="dashboard" title="Dashboard Summary">
      <div className="admin-page-container">
        {/* Header Bar */}
        <header className="admin-page-header">
          <div>
            <span className="admin-sub-tag">PATNA METRICS · OVERVIEW</span>
            <h1 className="admin-page-h1">Dashboard Summary</h1>
          </div>

          <div className="sync-badge">
            <span className="live-pulse" /> Live Firestore Sync
          </div>
        </header>

        {/* Metric Cards Grid */}
        <div className="adm-metrics-grid">
          <div className="adm-metric-card">
            <span className="metric-label">TOTAL ORDERS</span>
            <h2 className="metric-value">{orders.length}</h2>
          </div>

          <div className="adm-metric-card pending">
            <span className="metric-label">PENDING / ACTIVE</span>
            <h2 className="metric-value">{pendingCount}</h2>
          </div>

          <div className="adm-metric-card completed">
            <span className="metric-label">COMPLETED ORDERS</span>
            <h2 className="metric-value">{completedCount}</h2>
          </div>

          <div className="adm-metric-card revenue">
            <span className="metric-label">TOTAL REVENUE</span>
            <h2 className="metric-value">₹{totalRevenue.toFixed(0)}</h2>
          </div>
        </div>

        {/* Recent Orders Cards */}
        <div className="adm-section-card">
          <div className="section-card-header">
            <h3>Recent Orders</h3>
            <Link href="/admin/orders" className="adm-link-btn">
              View Full Order Desk →
            </Link>
          </div>

          {orders.length === 0 ? (
            <p className="empty-msg">No orders placed yet.</p>
          ) : (
            <div className="adm-order-cards-stack">
              {orders.slice(0, 6).map((ord) => (
                <div key={ord.id} className="adm-mini-order-card">
                  <div className="card-top">
                    <span className="order-id">#{ord.orderId || ord.id.slice(0, 6)}</span>
                    <span className={`status-pill ${ord.orderStatus?.toLowerCase() || 'pending'}`}>
                      {ord.orderStatus || 'Confirmed'}
                    </span>
                  </div>

                  <div className="card-mid">
                    <strong>{ord.customerName || ord.userName || 'Foodie Customer'}</strong>
                    <span>{ord.items?.length || 0} items</span>
                  </div>

                  <div className="card-bot">
                    <span className="payment-type">{ord.isUpi || ord.paymentMethod === 'UPI' ? '📲 UPI' : '💵 COD'}</span>
                    <strong className="order-total">₹{(ord.grandTotal || 0).toFixed(0)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
