import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/AdminLayout'

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

  if (!user || !isAdmin) return null

  return (
    <AdminLayout activePage="settings" title="Restaurant Settings">
      <div className="admin-page-container" style={{ maxWidth: '840px' }}>
        <header className="admin-page-header">
          <div>
            <span className="admin-sub-tag">LIVE CONFIGURATION ENGINE</span>
            <h1 className="admin-page-h1">Restaurant Settings</h1>
          </div>
        </header>

        {message && (
          <div className="adm-msg-toast">
            {message}
          </div>
        )}

        <div className="adm-section-card">
          <form onSubmit={handleSaveSettings} className="settings-form">
            {/* MASTER STORE OPEN / CLOSED TOGGLE */}
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
                onClick={() => setIsStoreOpen(!isStoreOpen)}
                className={`store-action-btn ${isStoreOpen ? 'open' : 'closed'}`}
              >
                {isStoreOpen ? 'CLOSE STORE NOW 🔴' : 'OPEN STORE NOW 🟢'}
              </button>
            </div>

            <div className="adm-field">
              <label>RESTAURANT NAME</label>
              <input
                type="text"
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                className="adm-input"
                required
              />
            </div>

            <div className="adm-grid-2">
              <div className="adm-field">
                <label>DELIVERY FEE (₹)</label>
                <input
                  type="number"
                  value={deliveryCharge}
                  onChange={e => setDeliveryCharge(e.target.value)}
                  className="adm-input"
                  required
                />
              </div>
              <div className="adm-field">
                <label>GST PERCENTAGE (%)</label>
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
            >
              {saving ? 'SAVING SETTINGS...' : 'SAVE RESTAURANT SETTINGS'}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  )
}
