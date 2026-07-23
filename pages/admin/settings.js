import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'

export default function AdminSettingsDesk() {
  const { user, isAdmin } = useAuth()
  const [restaurantName, setRestaurantName] = useState('Biriyani Station Patna')
  const [deliveryCharge, setDeliveryCharge] = useState('40')
  const [gstPercentage, setGstPercentage] = useState('5')
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
          setDeliveryCharge(data.deliveryCharge || '40')
          setGstPercentage(data.gstPercentage || '5')
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
        deliveryCharge: Number(deliveryCharge),
        gstPercentage: Number(gstPercentage),
        openingTime,
        closingTime,
        supportPhone,
        restaurantAddress,
        updatedAt: serverTimestamp()
      }, { merge: true })
      setMessage('Restaurant Settings saved successfully! ✨')
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      alert('Error saving settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user || !isAdmin) return <div style={{ padding: '60px', textAlign: 'center' }}>Admin access required. <Link href="/admin">Go to Portal</Link></div>

  return (
    <>
      <Head><title>Restaurant Settings | Biriyani Station Admin</title></Head>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f5f0' }}>
        <aside style={{ width: '260px', background: '#092419', color: '#ffffff', padding: '32px 20px', position: 'sticky', top: 0, height: '100vh' }}>
          <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ffffff', marginBottom: '24px' }}>Admin Portal</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link href="/admin" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>📊 Dashboard</Link>
            <Link href="/admin/orders" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🛵 Orders Desk</Link>
            <Link href="/admin/menu" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🍲 Menu Items</Link>
            <Link href="/admin/categories" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>📁 Categories</Link>
            <Link href="/admin/coupons" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🏷️ Coupons</Link>
            <Link href="/admin/users" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>👥 Users</Link>
            <Link href="/admin/settings" style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--yellow)', color: 'var(--ink)', fontWeight: 800, textDecoration: 'none' }}>⚙️ Settings</Link>
          </nav>
        </aside>

        <main style={{ flex: 1, padding: '40px' }}>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.4rem', fontWeight: 900, marginBottom: '24px' }}>Restaurant Settings</h1>

          {message && <div style={{ padding: '14px', background: 'rgba(13,90,58,0.1)', color: 'var(--deep-green)', borderRadius: '12px', fontWeight: 800, marginBottom: '20px' }}>{message}</div>}

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '32px', border: '1px solid rgba(13,90,58,0.1)', maxWidth: '640px' }}>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="co-field">
                <label>Restaurant Name</label>
                <input type="text" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="co-field">
                  <label>Delivery Fee (₹)</label>
                  <input type="number" value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} required />
                </div>
                <div className="co-field">
                  <label>GST Percentage (%)</label>
                  <input type="number" value={gstPercentage} onChange={e => setGstPercentage(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="co-field">
                  <label>Opening Time</label>
                  <input type="text" value={openingTime} onChange={e => setOpeningTime(e.target.value)} required />
                </div>
                <div className="co-field">
                  <label>Closing Time</label>
                  <input type="text" value={closingTime} onChange={e => setClosingTime(e.target.value)} required />
                </div>
              </div>

              <div className="co-field">
                <label>Support Phone Number</label>
                <input type="text" value={supportPhone} onChange={e => setSupportPhone(e.target.value)} required />
              </div>

              <div className="co-field">
                <label>Restaurant Address</label>
                <textarea rows={3} value={restaurantAddress} onChange={e => setRestaurantAddress(e.target.value)} required />
              </div>

              <button type="submit" className="btn" disabled={saving} style={{ padding: '16px', marginTop: '10px' }}>
                {saving ? 'SAVING SETTINGS...' : 'SAVE RESTAURANT SETTINGS'}
              </button>
            </form>
          </div>
        </main>
      </div>
    </>
  )
}
