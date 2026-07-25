import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import AdminLayout from '../../components/AdminLayout'
import { useAuth } from '../../context/AuthContext'

export default function AdminCouponsDesk() {
  const { user, isAdmin } = useAuth()
  const [coupons, setCoupons] = useState([])
  const [code, setCode] = useState('')
  const [discountValue, setDiscountValue] = useState('')
  const [minimumOrder, setMinimumOrder] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'coupons'), (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const handleAddCoupon = async (e) => {
    e.preventDefault()
    if (!code.trim() || !discountValue || !minimumOrder) return
    setLoading(true)

    try {
      await addDoc(collection(db, 'coupons'), {
        couponCode: code.toUpperCase().trim(),
        discountValue: Number(discountValue),
        minimumOrder: Number(minimumOrder),
        active: true,
        createdAt: serverTimestamp()
      })
      setCode('')
      setDiscountValue('')
      setMinimumOrder('')
    } catch (err) {
      alert('Failed to add coupon: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleCoupon = async (coupon) => {
    try {
      await updateDoc(doc(db, 'coupons', coupon.id), {
        active: !coupon.active
      })
    } catch (e) {}
  }

  const handleDeleteCoupon = async (id) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return
    try {
      await deleteDoc(doc(db, 'coupons', id))
    } catch (e) {}
  }

  if (!user || !isAdmin) return null

  return (
    <AdminLayout activePage="coupons" title="Coupons Management">
      <div className="admin-page-container">
        <header className="admin-page-header">
          <div>
            <span className="admin-sub-tag">PATNA DISCOUNTS</span>
            <h1 className="admin-page-h1">Coupons Management</h1>
          </div>
        </header>

        {/* Create New Coupon Form */}
        <div className="adm-section-card" style={{ marginBottom: '24px' }}>
          <h3>Create New Coupon</h3>
          <form onSubmit={handleAddCoupon} className="coupon-form-grid">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="CODE (e.g. PATNA100)"
              className="adm-input"
              required
            />
            <input
              type="number"
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              placeholder="Discount (₹)"
              className="adm-input"
              required
            />
            <input
              type="number"
              value={minimumOrder}
              onChange={e => setMinimumOrder(e.target.value)}
              placeholder="Min Order (₹)"
              className="adm-input"
              required
            />
            <button type="submit" className="btn adm-btn-submit" disabled={loading}>
              {loading ? 'CREATING...' : 'CREATE COUPON'}
            </button>
          </form>
        </div>

        {/* Active & Past Coupons */}
        <div className="adm-section-card">
          <h3>Active & Past Coupons</h3>
          {coupons.length === 0 ? (
            <p className="empty-msg">No coupons created yet.</p>
          ) : (
            <div className="coupon-cards-grid">
              {coupons.map(cp => (
                <div key={cp.id} className="adm-coupon-card">
                  <div className="coupon-card-top">
                    <span className="coupon-code-tag">{cp.couponCode}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleCoupon(cp)}
                      className={`coupon-status-btn ${cp.active ? 'active' : 'inactive'}`}
                    >
                      {cp.active ? '● Active' : '○ Inactive'}
                    </button>
                  </div>

                  <div className="coupon-card-mid">
                    <div>
                      <span className="coupon-disc-val">₹{cp.discountValue} OFF</span>
                      <p className="coupon-min-ord">Min Order: ₹{cp.minimumOrder}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(cp.id)}
                      className="coupon-del-btn"
                    >
                      🗑️ Delete
                    </button>
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
