import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'

export default function AdminSettingsDesk() {
  const { user, isAdmin } = useAuth()
  const [restaurantName, setRestaurantName] = useState('Biriyani Station Patna')
  const [isStoreOpen, setIsStoreOpen] = useState(true)
  const [deliveryCharge, setDeliveryCharge] = useState('40')
  const [gstPercentage, setGstPercentage] = useState('18')
  const [openingTime, setOpeningTime] = useState('11:00 AM')
  const [closingTime, setClosingTime] = useState('11:30 PM')
  const [supportPhone, setSupportPhone] = useState('+91 82713 01179')
  const [restaurantAddress, setRestaurantAddress] = useState('Exhibition Road, Opposite Big Bazaar, Patna, Bihar 800001')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'restaurant'))
        if (snap.exists()) {
          const data = snap.data()
          setRestaurantName(data.restaurantName || 'Biriyani Station Patna')
          setIsStoreOpen(data.isStoreOpen ?? true)
          setDeliveryCharge(data.deliveryCharge !== undefined ? String(data.deliveryCharge) : '40')
          setGstPercentage(data.gstPercentage !== undefined ? String(data.gstPercentage) : '18')
          setOpeningTime(data.openingTime || '11:00 AM')
          setClosingTime(data.closingTime || '11:30 PM')
          setSupportPhone(data.supportPhone || '+91 82713 01179')
          setRestaurantAddress(data.restaurantAddress || 'Exhibition Road, Opposite Big Bazaar, Patna, Bihar 800001')
        }
      } catch (e) {}
    }
    loadSettings()
  }, [user])

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      await setDoc(doc(db, 'settings', 'restaurant'), {
        restaurantName,
        isStoreOpen,
        deliveryCharge: Number(deliveryCharge) || 0,
        gstPercentage: Number(gstPercentage) || 0,
        openingTime,
        closingTime,
        supportPhone,
        restaurantAddress,
        updatedAt: serverTimestamp()
      }, { merge: true })

      setMessage('✨ Restaurant Settings saved successfully! Changes are live across the website.')
      setTimeout(() => setMessage(''), 4500)
    } catch (err) {
      alert('Error saving settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user || !isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ink)', color: '#ffffff', padding: '20px' }}>
        <div style={{ background: '#182820', padding: '48px 36px', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🛡️</div>
          <h1 style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '2rem', color: 'var(--yellow)', margin: '0 0 8px 0', fontWeight: 900 }}>
            Admin Access Required
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.92rem', marginBottom: '24px' }}>
            Please sign in with an authorized Admin account to manage store settings.
          </p>
          <Link href="/" className="btn" style={{ width: '100%', background: 'var(--yellow)', color: 'var(--ink)', padding: '12px', fontWeight: 800 }}>
            ← Return to Main Storefront
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Restaurant Settings | Biriyani Station Admin</title>
      </Head>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f5f0' }}>
        {/* Sidebar */}
        <aside style={{ width: '240px', background: '#092419', color: '#ffffff', padding: '28px 18px', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--yellow)', letterSpacing: '0.2em' }}>PATNA DESK</span>
              <h2 style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '1.3rem', color: '#ffffff', margin: '4px 0 0 0', fontWeight: 900 }}>Admin Desk</h2>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Link href="/admin" style={{ padding: '10px 14px', borderRadius: '10px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                📊 Dashboard
              </Link>
              <Link href="/admin/orders" style={{ padding: '10px 14px', borderRadius: '10px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                🛵 Orders Desk
              </Link>
              <Link href="/admin/menu" style={{ padding: '10px 14px', borderRadius: '10px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                🍲 Menu Items
              </Link>
              <Link href="/admin/coupons" style={{ padding: '10px 14px', borderRadius: '10px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                🏷️ Coupons
              </Link>
              <Link href="/admin/users" style={{ padding: '10px 14px', borderRadius: '10px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                👥 Users
              </Link>
              <Link href="/admin/settings" style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--yellow)', color: 'var(--ink)', fontWeight: 800, textDecoration: 'none', fontSize: '0.9rem' }}>
                ⚙️ Settings
              </Link>
            </nav>
          </div>

          <div>
            <Link href="/" style={{ color: 'var(--yellow)', textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem' }}>
              ← Main Storefront
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, padding: '36px 40px', maxWidth: '800px' }}>
          <header style={{ marginBottom: '28px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--deep-green)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              LIVE CONFIGURATION ENGINE
            </span>
            <h1 style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '2.2rem', fontWeight: 900, color: 'var(--ink)', margin: '4px 0 0 0' }}>
              Restaurant Settings
            </h1>
          </header>

          {message && (
            <div style={{ padding: '16px 20px', background: 'rgba(13,90,58,0.1)', color: 'var(--deep-green)', border: '1px solid rgba(13,90,58,0.3)', borderRadius: '16px', fontWeight: 800, fontSize: '0.9rem', marginBottom: '24px' }}>
              {message}
            </div>
          )}

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '32px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 6px 24px rgba(0,0,0,0.03)' }}>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* MASTER STORE OPEN / CLOSED TOGGLE */}
              <div style={{
                background: isStoreOpen ? 'rgba(13,90,58,0.08)' : 'rgba(239,68,68,0.08)',
                border: isStoreOpen ? '1.5px solid rgba(13,90,58,0.3)' : '1.5px solid rgba(239,68,68,0.3)',
                borderRadius: '20px',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isStoreOpen ? 'var(--deep-green)' : '#dc2626', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    ONLINE ORDERING CONTROL
                  </span>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: 'var(--ink)' }}>
                    {isStoreOpen ? '🟢 STORE IS OPEN — Accepting Online Orders' : '🔴 STORE IS CLOSED — Orders Suspended'}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                    {isStoreOpen ? 'Customers can browse dishes and place orders normally.' : 'Customers CANNOT place orders. Checkout is locked with store opening hours banner.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsStoreOpen(!isStoreOpen)}
                  style={{
                    background: isStoreOpen ? 'var(--deep-green)' : '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px 22px',
                    borderRadius: '999px',
                    fontWeight: 900,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: isStoreOpen ? '0 4px 14px rgba(13,90,58,0.25)' : '0 4px 14px rgba(239,68,68,0.25)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isStoreOpen ? 'CLOSE STORE NOW 🔴' : 'OPEN STORE NOW 🟢'}
                </button>
              </div>

              <div className="co-field">
                <label style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  RESTAURANT NAME
                </label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={e => setRestaurantName(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.95rem', fontWeight: 700, outline: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="co-field">
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                    DELIVERY FEE (₹)
                  </label>
                  <input
                    type="number"
                    value={deliveryCharge}
                    onChange={e => setDeliveryCharge(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.95rem', fontWeight: 700, outline: 'none' }}
                    required
                  />
                </div>
                <div className="co-field">
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                    GST PERCENTAGE (%)
                  </label>
                  <input
                    type="number"
                    value={gstPercentage}
                    onChange={e => setGstPercentage(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.95rem', fontWeight: 700, outline: 'none' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="co-field">
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                    OPENING TIME
                  </label>
                  <input
                    type="text"
                    value={openingTime}
                    onChange={e => setOpeningTime(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.95rem', fontWeight: 700, outline: 'none' }}
                    required
                  />
                </div>
                <div className="co-field">
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                    CLOSING TIME
                  </label>
                  <input
                    type="text"
                    value={closingTime}
                    onChange={e => setClosingTime(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.95rem', fontWeight: 700, outline: 'none' }}
                    required
                  />
                </div>
              </div>

              <div className="co-field">
                <label style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  SUPPORT PHONE NUMBER
                </label>
                <input
                  type="text"
                  value={supportPhone}
                  onChange={e => setSupportPhone(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.95rem', fontWeight: 700, outline: 'none' }}
                  required
                />
              </div>

              <div className="co-field">
                <label style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  RESTAURANT ADDRESS
                </label>
                <textarea
                  rows={3}
                  value={restaurantAddress}
                  onChange={e => setRestaurantAddress(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.95rem', fontWeight: 700, outline: 'none', resize: 'none' }}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn"
                disabled={saving}
                style={{ padding: '16px', marginTop: '12px', borderRadius: '999px', fontSize: '0.88rem', fontWeight: 800, letterSpacing: '0.05em' }}
              >
                {saving ? 'SAVING SETTINGS...' : 'SAVE RESTAURANT SETTINGS'}
              </button>
            </form>
          </div>
        </main>
      </div>
    </>
  )
}
