import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthContext'
import { useOrdersContext } from '../context/OrdersContext'
import AuthModal from './AuthModal'

export default function AdminLayout({ children, activePage = 'dashboard', title = 'Admin Portal' }) {
  const router = useRouter()
  const { user, isAdmin, logout, openAuthModal } = useAuth()
  const { pendingRefundCount = 0 } = useOrdersContext()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (!user || !isAdmin) {
    return (
      <div className="admin-access-screen">
        <div className="admin-access-card">
          <div className="access-icon">🛡️</div>
          <h1>Admin Access Required</h1>
          <p>
            {user
              ? `Logged in as ${user.email}. This account is not authorized for Patna Admin privileges.`
              : 'Please sign in with an authorized Admin account to access the Patna Admin Desk.'}
          </p>

          {!user ? (
            <button type="button" onClick={openAuthModal} className="btn admin-signin-btn">
              🔑 SIGN IN WITH ADMIN ACCOUNT
            </button>
          ) : (
            <button type="button" onClick={logout} className="btn admin-logout-btn">
              LOG OUT & SWITCH ACCOUNT
            </button>
          )}

          <div style={{ marginTop: '20px' }}>
            <Link href="/" className="back-link">
              ← Return to Main Storefront
            </Link>
          </div>
        </div>
        <AuthModal />
      </div>
    )
  }

  const navItems = [
    { key: 'dashboard', label: 'Overview', href: '/admin', icon: '📊' },
    { key: 'orders', label: 'Live Orders', href: '/admin/orders', icon: '📦' },
    { key: 'payments', label: 'Razorpay Payments', href: '/admin/payments', icon: '💳' },
    { key: 'all-orders', label: 'All Orders', href: '/admin/all-orders', icon: '📋' },
    { key: 'refunds', label: 'Refunds Desk', href: '/admin/refunds', icon: '💸' },
    { key: 'menu', label: 'Dish Menu', href: '/admin/menu', icon: '🍛' },
    { key: 'coupons', label: 'Coupons', href: '/admin/coupons', icon: '🎟️' },
    { key: 'users', label: 'Customers', href: '/admin/users', icon: '👤' },
    { key: 'settings', label: 'Settings', href: '/admin/settings', icon: '⚙️' },
  ]

  return (
    <div className="admin-root-shell">
      <Head>
        <title>{title} | Biriyani Station Patna Admin</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      {/* --- MOBILE TOP HEADER BAR (< 1024px) --- */}
      <header className="admin-mobile-header">
        <div className="header-brand-wrap">
          <span className="brand-badge">PATNA ADMIN</span>
          <h1 className="header-page-title">{title}</h1>
        </div>

        <button
          type="button"
          className="admin-menu-toggle"
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          aria-label="Toggle Navigation Drawer"
        >
          {mobileDrawerOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* --- MOBILE SLIDE DRAWER (< 1024px) --- */}
      <div className={`admin-drawer-overlay ${mobileDrawerOpen ? 'open' : ''}`} onClick={() => setMobileDrawerOpen(false)}>
        <aside className="admin-drawer-panel" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-header">
            <span className="drawer-sub">PATNA DESK CONTROL</span>
            <h2>Biriyani Station</h2>
            <p className="admin-user-email">{user.email}</p>
          </div>

          <nav className="drawer-nav">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`drawer-link ${activePage === item.key ? 'active' : ''}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <span className="link-icon">{item.icon}</span>
                <span className="link-label">{item.label}</span>
              </Link>
            ))}

            <Link href="/" className="drawer-link store-link">
              <span className="link-icon">🏪</span>
              <span className="link-label">View Live Storefront</span>
            </Link>

            <button type="button" onClick={logout} className="drawer-link logout-link">
              <span className="link-icon">🚪</span>
              <span className="link-label">Log Out</span>
            </button>
          </nav>
        </aside>
      </div>

      {/* --- DESKTOP SIDEBAR (>= 1024px) --- */}
      <aside className="admin-desktop-sidebar">
        <div>
          <div className="sidebar-brand">
            <span className="sidebar-tag">PATNA DESK</span>
            <h2 className="sidebar-logo">Biriyani Station</h2>
            <span className="sidebar-role">Admin Control Panel</span>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`sidebar-link ${activePage === item.key ? 'active' : ''}`}
                style={{ position: 'relative' }}
              >
                <span className="link-icon">{item.icon}</span>
                <span className="link-label">{item.label}</span>
                {item.key === 'refunds' && pendingRefundCount > 0 && (
                  <span style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    marginLeft: 'auto',
                    boxShadow: '0 2px 6px rgba(220,38,38,0.4)'
                  }}>
                    {pendingRefundCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="admin-profile-chip">
            <div className="avatar-dot">👑</div>
            <div className="profile-text">
              <strong>{user.displayName || 'Admin'}</strong>
              <span>{user.email}</span>
            </div>
          </div>

          <div className="sidebar-bottom-actions">
            <Link href="/" className="sidebar-btn store-btn">
              🏪 Storefront
            </Link>
            <button type="button" onClick={logout} className="sidebar-btn logout-btn">
              🚪 Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT VIEWPORT --- */}
      <main className="admin-main-viewport">
        {children}
      </main>

      {/* --- MOBILE BOTTOM QUICK TAB BAR (< 1024px) --- */}
      <nav className="admin-mobile-bottom-bar">
        <Link href="/admin" className={`adm-tab ${activePage === 'dashboard' ? 'active' : ''}`}>
          <span className="adm-icon">📊</span>
          <span className="adm-label">Overview</span>
        </Link>
        <Link href="/admin/orders" className={`adm-tab ${activePage === 'orders' ? 'active' : ''}`}>
          <span className="adm-icon">📦</span>
          <span className="adm-label">Orders</span>
        </Link>
        <Link href="/admin/refunds" className={`adm-tab ${activePage === 'refunds' ? 'active' : ''}`}>
          <span className="adm-icon">💸</span>
          <span className="adm-label">Refunds</span>
        </Link>
        <Link href="/admin/menu" className={`adm-tab ${activePage === 'menu' ? 'active' : ''}`}>
          <span className="adm-icon">🍛</span>
          <span className="adm-label">Menu</span>
        </Link>
      </nav>
    </div>
  )
}
