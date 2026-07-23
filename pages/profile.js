import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {
  const { user, userProfile, updateUserProfileData, logout, openAuthModal } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || user?.displayName || '')
      setPhone(userProfile.phone || '')
      setAddress(userProfile.defaultAddress || '')
    }
  }, [userProfile, user])

  if (!user) {
    return (
      <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', background: 'var(--cream)', padding: '120px 20px' }}>
        <div style={{ textAlignment: 'center', background: '#ffffff', padding: '40px 32px', borderRadius: '24px', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>👤</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)' }}>Authentication Required</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>Please sign in to view and edit your profile.</p>
          <button onClick={openAuthModal} className="btn">SIGN IN</button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setMessage('')
      await updateUserProfileData({
        name,
        phone,
        defaultAddress: address,
      })
      setMessage('Profile updated successfully! ✨')
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      console.error(err)
      setMessage('Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>My Profile | Biriyani Station Patna</title>
      </Head>

      <header className="site-header scrolled" id="top">
        <nav className="nav container">
          <Link href="/" className="logo">BIRIYANI <span>STATION</span></Link>
          <div className="nav-right">
            <Link href="/">HOME</Link>
            <Link href="/menu">MENU</Link>
            <Link href="/my-orders">MY ORDERS</Link>
            <Link href="/profile" className="active" style={{ color: 'var(--yellow)' }}>PROFILE</Link>
          </div>
        </nav>
      </header>

      <main style={{ minHeight: '80vh', padding: '120px 0 80px 0', background: 'var(--cream)' }}>
        <div className="container" style={{ maxWidth: '640px' }}>
          <div style={{ background: '#ffffff', borderRadius: '28px', padding: '36px 32px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--deep-green)', color: '#ffffff', fontSize: '2rem', fontWeight: 800, display: 'grid', placeItems: 'center' }}>
                  {user.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--ink)', margin: '0 0 4px 0' }}>
                  {userProfile?.name || user.displayName}
                </h1>
                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{user.email}</span>
                <div style={{ marginTop: '6px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, background: 'rgba(13,90,58,0.1)', color: 'var(--deep-green)', padding: '4px 10px', borderRadius: '999px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    ROLE: {userProfile?.role || 'Customer'}
                  </span>
                </div>
              </div>
            </div>

            {message && (
              <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(13,90,58,0.1)', border: '1px solid rgba(13,90,58,0.2)', color: 'var(--deep-green)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '20px', textAlign: 'center' }}>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="co-field">
                <label htmlFor="prof-name">Full Name</label>
                <input
                  id="prof-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  required
                />
              </div>

              <div className="co-field">
                <label htmlFor="prof-email">Email Address (Read-only)</label>
                <input
                  id="prof-email"
                  type="email"
                  value={user.email}
                  disabled
                  style={{ background: '#f5f5f5', cursor: 'not-allowed', opacity: 0.7 }}
                />
              </div>

              <div className="co-field">
                <label htmlFor="prof-phone">Phone Number</label>
                <input
                  id="prof-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 82713 01179"
                />
              </div>

              <div className="co-field">
                <label htmlFor="prof-address">Default Delivery Address</label>
                <textarea
                  id="prof-address"
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House no, Street, Landmark, Patna..."
                />
              </div>

              <button
                type="submit"
                className="btn"
                disabled={saving}
                style={{ marginTop: '10px', width: '100%', padding: '16px' }}
              >
                {saving ? 'SAVING CHANGES...' : 'UPDATE PROFILE'}
              </button>
            </form>

            <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <button
                type="button"
                onClick={logout}
                style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Sign Out of Account
              </button>
            </div>

          </div>
        </div>
      </main>
    </>
  )
}
