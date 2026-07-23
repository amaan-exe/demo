import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import AuthModal from '../../components/AuthModal'

export default function AdminDashboard() {
  const { user, userProfile, isAdmin, openAuthModal, updateUserProfileData } = useAuth()
  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Real-time Firestore sync
  useEffect(() => {
    setMounted(true)
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

  if (!mounted) return null

  if (!user || !isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ink)', color: '#ffffff', padding: '20px' }}>
        <div style={{ background: '#182820', padding: '48px 36px', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🛡️</div>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.2rem', color: 'var(--yellow)', margin: '0 0 8px 0' }}>
            Admin Access Required
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.92rem', marginBottom: '24px', lineHeight: 1.6 }}>
            {user ? `Logged in as ${user.email}. This email is not registered as an authorized Admin account.` : 'Please sign in with an authorized Admin account (e.g. amaanullah2607@gmail.com) to access the dashboard.'}
          </p>

          {!user && (
            <button
              onClick={openAuthModal}
              className="btn"
              style={{ width: '100%', padding: '14px', background: 'var(--yellow)', color: 'var(--ink)', fontWeight: 800 }}
            >
              🔑 SIGN IN WITH ADMIN GOOGLE ACCOUNT
            </button>
          )}

          <div style={{ marginTop: '16px' }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', textDecoration: 'underline' }}>
              ← Return to Main Storefront
            </Link>
          </div>
        </div>
        <AuthModal />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard | Biriyani Station Patna</title>
      </Head>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f5f0' }}>
        {/* Admin Sidebar Navigation */}
        <aside style={{ width: '260px', background: '#092419', color: '#ffffff', padding: '32px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'sticky', top: 0, height: '100vh' }}>
          <div>
            <div style={{ paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.22em', color: 'var(--yellow)', textTransform: 'uppercase' }}>
                PATNA DESK
              </span>
              <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ffffff', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                Admin Portal
              </h2>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href="/admin" style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--yellow)', color: 'var(--ink)', fontWeight: 800, textDecoration: 'none' }}>
                📊 Dashboard
              </Link>
              <Link href="/admin/orders" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
                🛵 Orders Desk ({pendingCount})
              </Link>
              <Link href="/admin/menu" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
                🍲 Menu Items ({menuItems.length})
              </Link>
              <Link href="/admin/coupons" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
                🏷️ Coupons
              </Link>
              <Link href="/admin/users" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
                👥 Users ({usersList.length})
              </Link>
              <Link href="/admin/settings" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700 }}>
                ⚙️ Settings
              </Link>
            </nav>
          </div>

          <div>
            <Link href="/" style={{ display: 'block', textAlignment: 'center', textAlign: 'center', color: 'var(--yellow)', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem' }}>
              ← Return to Main Website
            </Link>
          </div>
        </aside>

        {/* Dashboard Content */}
        <main style={{ flex: 1, padding: '40px' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.2em', color: 'var(--deep-green)', textTransform: 'uppercase' }}>
                OVERVIEW METRICS
              </span>
              <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.4rem', fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                Dashboard Summary
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--deep-green)' }}>● Real-Time Sync Active</span>
            </div>
          </header>

          {/* Metric Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.15em' }}>TOTAL ORDERS</span>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--ink)', margin: '4px 0 0 0' }}>{orders.length}</h2>
            </div>

            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#d97706', letterSpacing: '0.15em' }}>PENDING / ACTIVE</span>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#d97706', margin: '4px 0 0 0' }}>{pendingCount}</h2>
            </div>

            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--deep-green)', letterSpacing: '0.15em' }}>COMPLETED ORDERS</span>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--deep-green)', margin: '4px 0 0 0' }}>{completedCount}</h2>
            </div>

            <div style={{ background: '#092419', color: '#ffffff', padding: '24px', borderRadius: '20px', boxShadow: '0 8px 24px rgba(9,36,25,0.2)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--yellow)', letterSpacing: '0.15em' }}>REVENUE TOTAL</span>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff', margin: '4px 0 0 0' }}>₹{totalRevenue.toFixed(0)}</h2>
            </div>
          </div>

          {/* Recent Orders Preview */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 6px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Recent Orders</h3>
              <Link href="/admin/orders" style={{ color: 'var(--deep-green)', fontWeight: 800, fontSize: '0.88rem', textDecoration: 'none' }}>
                View Full Order Desk →
              </Link>
            </div>

            {orders.length === 0 ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '30px' }}>No orders placed yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid rgba(0,0,0,0.08)', color: 'var(--muted)' }}>
                      <th style={{ padding: '12px' }}>ORDER ID</th>
                      <th style={{ padding: '12px' }}>CUSTOMER</th>
                      <th style={{ padding: '12px' }}>ITEMS</th>
                      <th style={{ padding: '12px' }}>TOTAL</th>
                      <th style={{ padding: '12px' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map((ord) => (
                      <tr key={ord.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding: '12px', fontWeight: 800 }}>#{ord.orderId || ord.id.slice(0, 6)}</td>
                        <td style={{ padding: '12px' }}>{ord.customerName || ord.userName}</td>
                        <td style={{ padding: '12px' }}>{ord.items?.length || 0} items</td>
                        <td style={{ padding: '12px', fontWeight: 800 }}>₹{(ord.grandTotal || 0).toFixed(0)}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: 'rgba(13,90,58,0.1)', color: 'var(--deep-green)', padding: '4px 10px', borderRadius: '999px', fontWeight: 800, fontSize: '0.75rem' }}>
                            {ord.orderStatus || 'Confirmed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
