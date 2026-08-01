import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/AdminLayout'
import AnnouncementBanner from '../../components/AnnouncementBanner'

export default function AdminSettingsDesk() {
  const { user, isAdmin } = useAuth()
  const [restaurantName, setRestaurantName] = useState('Biriyani Station Patna')
  const [isStoreOpen, setIsStoreOpen] = useState(true)
  const [deliveryCharge, setDeliveryCharge] = useState('40')
  const [gstPercentage, setGstPercentage] = useState('18')
  const [openingTime, setOpeningTime] = useState('11:00 AM')
  const [closingTime, setClosingTime] = useState('11:30 PM')
  const [supportPhone, setSupportPhone] = useState('+91 91029 85148')
  const [storeUpiId, setStoreUpiId] = useState('electrohousejsr@okicici')
  const [restaurantAddress, setRestaurantAddress] = useState('Exhibition Road, Opposite Big Bazaar, Patna, Bihar 800001')
  
  // Announcement Banner State
  const [announcementEnabled, setAnnouncementEnabled] = useState(false)
  const [announcementText, setAnnouncementText] = useState('')
  const [announcementType, setAnnouncementType] = useState('info')
  const [announcementError, setAnnouncementError] = useState('')

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
          setSupportPhone(data.supportPhone || '+91 91029 85148')
          setStoreUpiId((data.storeUpiId && !data.storeUpiId.includes('8271301179') && !data.storeUpiId.includes('Q441280679')) ? data.storeUpiId : 'electrohousejsr@okicici')
          setRestaurantAddress(data.restaurantAddress || 'Exhibition Road, Opposite Big Bazaar, Patna, Bihar 800001')

          setAnnouncementEnabled(Boolean(data.announcementEnabled))
          setAnnouncementText(data.announcementText || '')
          setAnnouncementType(data.announcementType || 'info')
        }
      } catch (e) {
        console.warn('Load settings notice:', e.message)
      }
    }
    loadSettings()
  }, [user])

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setAnnouncementError('')

    // Validation Rules for Global Announcement Banner
    if (announcementEnabled) {
      const trimmedText = announcementText.trim()
      if (!trimmedText) {
        setAnnouncementError('⚠️ Announcement text cannot be empty when the banner is enabled.')
        return
      }
      if (trimmedText.length > 5000) {
        setAnnouncementError(`⚠️ Announcement text exceeds maximum allowed length of 5000 characters (${trimmedText.length}/5000).`)
        return
      }
    }

    try {
      setSaving(true)
      const cleanAnnouncementText = announcementText.trim()

      await setDoc(doc(db, 'settings', 'restaurant'), {
        restaurantName,
        isStoreOpen,
        deliveryCharge: Number(deliveryCharge) || 0,
        gstPercentage: Number(gstPercentage) || 0,
        openingTime,
        closingTime,
        supportPhone,
        storeUpiId,
        restaurantAddress,
        announcementEnabled,
        announcementText: cleanAnnouncementText,
        announcementType,
        updatedAt: serverTimestamp()
      }, { merge: true })

      setMessage('✨ All Settings & Announcement published successfully! Changes are live across the website.')
      setTimeout(() => setMessage(''), 4500)
    } catch (err) {
      alert('Error saving settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user || !isAdmin) return null

  return (
    <AdminLayout activePage="settings" title="Restaurant Settings">
      <div className="admin-page-container" style={{ maxWidth: '840px' }}>
        <header className="admin-page-header">
          <div>
            <span className="admin-sub-tag">LIVE CONFIGURATION ENGINE</span>
            <h1 className="admin-page-h1">Restaurant Settings & Announcements</h1>
          </div>
        </header>

        {message && (
          <div className="adm-msg-toast">
            {message}
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="settings-form">
          {/* GLOBAL ANNOUNCEMENT BANNER CONTROL PANEL */}
          <div className="adm-section-card" style={{ border: '2px solid var(--deep-green, #0d5a3a)', borderRadius: '20px', padding: '24px', marginBottom: '28px', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <span className="admin-sub-tag" style={{ color: 'var(--deep-green, #0d5a3a)' }}>CUSTOMER BROWSER SYNC</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '4px 0 0 0', color: 'var(--ink)' }}>
                  📢 Global Announcement Banner
                </h3>
              </div>

              {/* Master Enable/Disable Toggle */}
              <button
                type="button"
                onClick={() => setAnnouncementEnabled(!announcementEnabled)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '999px',
                  border: 'none',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  transition: 'all 0.2s ease',
                  background: announcementEnabled ? '#047857' : '#9ca3af',
                  color: '#ffffff',
                  boxShadow: announcementEnabled ? '0 4px 14px rgba(4,120,87,0.3)' : 'none'
                }}
              >
                {announcementEnabled ? '🟢 BANNER ACTIVE (ENABLED)' : '⚪ BANNER OFF (DISABLED)'}
              </button>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--muted)', marginBottom: '20px', lineHeight: '1.5' }}>
              Publish live announcement banners across customer pages (Homepage, Menu, Cart). Toggling OFF removes the banner instantly without leaving empty whitespace gaps.
            </p>

            {announcementError && (
              <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontWeight: 800, fontSize: '0.84rem', marginBottom: '18px' }}>
                {announcementError}
              </div>
            )}

            {/* Announcement Type Selection */}
            <div className="adm-field" style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.08em', display: 'block', marginBottom: '8px' }}>
                ANNOUNCEMENT TYPE & THEME
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                {[
                  { id: 'info', label: '📢 Info (Royal Teal)', bg: '#0d5a3a' },
                  { id: 'warning', label: '⚠️ Notice (Amber Flame)', bg: '#b45309' },
                  { id: 'success', label: '🎉 Offer (Emerald Green)', bg: '#047857' },
                  { id: 'urgent', label: '🚨 Urgent (Crimson Red)', bg: '#dc2626' }
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setAnnouncementType(type.id)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: announcementType === type.id ? '2px solid #000000' : '1px solid rgba(0,0,0,0.12)',
                      background: type.bg,
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      opacity: announcementType === type.id ? 1 : 0.7,
                      transform: announcementType === type.id ? 'scale(1.02)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Announcement Text Input */}
            <div className="adm-field" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.08em' }}>
                  ANNOUNCEMENT MESSAGE
                </label>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: announcementText.length > 5000 ? '#dc2626' : 'var(--muted)' }}>
                  {announcementText.length} / 5000 chars
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={5000}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="e.g. Store closes at 9 PM today for private catering | Free Delivery on orders above ₹399!"
                className="adm-input textarea"
                style={{ width: '100%', resize: 'vertical', fontSize: '0.92rem', padding: '12px' }}
              />
            </div>

            {/* Live Customer Preview */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed rgba(0,0,0,0.12)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
                LIVE CUSTOMER BANNER PREVIEW:
              </span>
              {announcementEnabled && announcementText.trim() ? (
                <AnnouncementBanner
                  overrideSettings={{
                    announcementEnabled: true,
                    announcementText: announcementText.trim(),
                    announcementType
                  }}
                  placement="preview"
                />
              ) : (
                <div style={{ padding: '12px', textAlign: 'center', background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '12px', color: '#6b7280', fontSize: '0.82rem', fontWeight: 600 }}>
                  Banner is currently OFF or empty. It will be hidden on customer pages without leaving empty space.
                </div>
              )}
            </div>
          </div>

          {/* MASTER STORE OPEN / CLOSED TOGGLE */}
          <div className="adm-section-card" style={{ padding: '24px', marginBottom: '24px', background: '#ffffff', borderRadius: '20px' }}>
            <div className={`store-toggle-box ${isStoreOpen ? 'open' : 'closed'}`}>
              <div className="store-toggle-info">
                <span className="toggle-tag">ONLINE ORDERING CONTROL</span>
                <h3>
                  {isStoreOpen ? '🟢 STORE IS OPEN — Accepting Online Orders' : '🔴 STORE IS CLOSED — Orders Suspended'}
                </h3>
                <p>
                  {isStoreOpen ? 'Customers can browse dishes and place orders normally.' : 'Customers CANNOT place orders. Checkout is locked.'}
                </p>
              </div>

              <button
                type="button"
                className={`btn store-toggle-btn ${isStoreOpen ? 'btn-close-store' : 'btn-open-store'}`}
                onClick={() => setIsStoreOpen(!isStoreOpen)}
              >
                {isStoreOpen ? 'CLOSE STORE NOW' : 'OPEN STORE NOW'}
              </button>
            </div>

            <div className="adm-grid-2" style={{ marginTop: '20px' }}>
              <div className="adm-field">
                <label>RESTAURANT DISPLAY NAME</label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={e => setRestaurantName(e.target.value)}
                  className="adm-input"
                  required
                />
              </div>

              <div className="adm-field">
                <label>STORE UPI ID FOR PAYMENTS</label>
                <input
                  type="text"
                  value={storeUpiId}
                  onChange={e => setStoreUpiId(e.target.value)}
                  className="adm-input"
                  required
                />
              </div>
            </div>

            <div className="adm-grid-2">
              <div className="adm-field">
                <label>FLAT DELIVERY CHARGE (₹)</label>
                <input
                  type="number"
                  value={deliveryCharge}
                  onChange={e => setDeliveryCharge(e.target.value)}
                  className="adm-input"
                  required
                />
              </div>
              <div className="adm-field">
                <label>GST / TAX PERCENTAGE (%)</label>
                <input
                  type="number"
                  value={gstPercentage}
                  onChange={e => setGstPercentage(e.target.value)}
                  className="adm-input"
                  required
                />
              </div>
            </div>

            <div className="adm-grid-2">
              <div className="adm-field">
                <label>OPENING TIME</label>
                <input
                  type="text"
                  value={openingTime}
                  onChange={e => setOpeningTime(e.target.value)}
                  className="adm-input"
                  required
                />
              </div>
              <div className="adm-field">
                <label>CLOSING TIME</label>
                <input
                  type="text"
                  value={closingTime}
                  onChange={e => setClosingTime(e.target.value)}
                  className="adm-input"
                  required
                />
              </div>
            </div>

            <div className="adm-field">
              <label>SUPPORT PHONE NUMBER</label>
              <input
                type="text"
                value={supportPhone}
                onChange={e => setSupportPhone(e.target.value)}
                className="adm-input"
                required
              />
            </div>

            <div className="adm-field">
              <label>RESTAURANT ADDRESS</label>
              <textarea
                rows={3}
                value={restaurantAddress}
                onChange={e => setRestaurantAddress(e.target.value)}
                className="adm-input textarea"
                required
              />
            </div>

            <button
              type="submit"
              className="btn adm-btn-submit"
              disabled={saving}
              style={{ marginTop: '12px' }}
            >
              {saving ? 'SAVING ALL SETTINGS & ANNOUNCEMENTS...' : 'SAVE ALL SETTINGS & PUBLISH ANNOUNCEMENT'}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}
