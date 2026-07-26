import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import AdminLayout from '../../components/AdminLayout'
import { useAuth } from '../../context/AuthContext'

export default function AdminCouponsDesk() {
  const { user, isAdmin } = useAuth()
  const [coupons, setCoupons] = useState([])
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [code, setCode] = useState('')
  const [discountValue, setDiscountValue] = useState('')
  const [discountType, setDiscountType] = useState('fixed') // 'fixed' | 'percent'
  const [minimumOrder, setMinimumOrder] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [perUserLimit, setPerUserLimit] = useState('1')
  const [applicableCategory, setApplicableCategory] = useState('all')
  const [isStackable, setIsStackable] = useState(false)
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
        discountType,
        minimumOrder: Number(minimumOrder),
        usageLimit: usageLimit ? Number(usageLimit) : 0, // 0 = unlimited
        usedCount: 0,
        expiryDate: expiryDate || null,
        perUserLimit: Number(perUserLimit) || 1,
        applicableCategory: applicableCategory || 'all',
        isStackable: Boolean(isStackable),
        active: true,
        createdAt: serverTimestamp()
      })
      setCode('')
      setDiscountValue('')
      setDiscountType('fixed')
      setMinimumOrder('')
      setUsageLimit('')
      setExpiryDate('')
      setPerUserLimit('1')
      setApplicableCategory('all')
      setIsStackable(false)
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
            <span className="admin-sub-tag">PATNA DISCOUNTS & PROMOS</span>
            <h1 className="admin-page-h1">Coupons & Offer Engine</h1>
          </div>
        </header>

        {/* Create New Coupon Form */}
        <div className="adm-section-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 800 }}>Create Rules-Based Coupon</h3>
          <form onSubmit={handleAddCoupon} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>COUPON CODE</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. BIRIYANI50"
                className="adm-input"
                style={{ width: '100%', marginTop: '4px' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>DISCOUNT VALUE</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input
                  type="number"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  placeholder="e.g. 50 or 20"
                  className="adm-input"
                  style={{ flex: 1, minWidth: 0 }}
                  required
                />
                <select
                  value={discountType}
                  onChange={e => setDiscountType(e.target.value)}
                  className="adm-input"
                  style={{ width: '110px', flexShrink: 0, padding: '12px 12px', cursor: 'pointer' }}
                >
                  <option value="fixed">₹ OFF</option>
                  <option value="percent">% OFF</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>MIN ORDER (₹)</label>
              <input
                type="number"
                value={minimumOrder}
                onChange={e => setMinimumOrder(e.target.value)}
                placeholder="e.g. 299"
                className="adm-input"
                style={{ width: '100%', marginTop: '4px' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL USAGE LIMIT (0 = Unlimited)</label>
              <input
                type="number"
                value={usageLimit}
                onChange={e => setUsageLimit(e.target.value)}
                placeholder="e.g. 100"
                className="adm-input"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>EXPIRY DATE</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="adm-input"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PER-USER LIMIT</label>
              <input
                type="number"
                value={perUserLimit}
                onChange={e => setPerUserLimit(e.target.value)}
                placeholder="e.g. 1"
                className="adm-input"
                style={{ width: '100%', marginTop: '4px' }}
                min="1"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>APPLICABLE CATEGORY</label>
              <select
                value={applicableCategory}
                onChange={e => setApplicableCategory(e.target.value)}
                className="adm-input"
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="all">All Categories</option>
                <option value="Biriyani">Biriyani Special</option>
                <option value="Starters">Starters & Kebabs</option>
                <option value="Combos">Family Combos</option>
                <option value="Desserts">Desserts & Beverages</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>STACKABILITY RULE</label>
              <select
                value={isStackable ? 'true' : 'false'}
                onChange={e => setIsStackable(e.target.value === 'true')}
                className="adm-input"
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="false">Exclusive (Non-Stackable)</option>
                <option value="true">Stackable with Auto-Promos</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
              <button type="submit" className="btn adm-btn-submit" disabled={loading} style={{ width: '100%', padding: '14px', fontWeight: 800 }}>
                {loading ? 'CREATING COUPON...' : '➕ PUBLISH PROMO COUPON'}
              </button>
            </div>
          </form>
        </div>

        {/* Active & Configured Offers */}
        <div className="adm-section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Active & Configured Offers ({coupons.length})</h3>

            {/* Filter controls */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="admin-search-box" style={{ minWidth: '220px', maxWidth: '320px' }}>
                <span className="admin-search-icon">🔍</span>
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Search promo code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ padding: '8px 32px 8px 36px', fontSize: '0.84rem' }}
                />
                {searchQuery && (
                  <button type="button" className="admin-search-clear" onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    background: statusFilter === 'all' ? 'var(--deep-green)' : '#f4f3ed',
                    color: statusFilter === 'all' ? '#fff' : 'var(--ink)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  All ({coupons.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    background: statusFilter === 'active' ? '#047857' : '#f4f3ed',
                    color: statusFilter === 'active' ? '#fff' : 'var(--ink)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  🟢 Active ({coupons.filter(c => c.active).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('inactive')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    background: statusFilter === 'inactive' ? '#6b7280' : '#f4f3ed',
                    color: statusFilter === 'inactive' ? '#fff' : 'var(--ink)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  ⚪ Inactive ({coupons.filter(c => !c.active).length})
                </button>
              </div>
            </div>
          </div>

          {coupons.length === 0 ? (
            <p className="empty-msg">No coupons created yet.</p>
          ) : (
            <div className="coupon-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {coupons
                .filter(cp => {
                  if (statusFilter === 'active' && !cp.active) return false
                  if (statusFilter === 'inactive' && cp.active) return false
                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim()
                    return (cp.couponCode || '').toLowerCase().includes(q) || (cp.applicableCategory || '').toLowerCase().includes(q)
                  }
                  return true
                })
                .map(cp => (
                <div key={cp.id} className="adm-coupon-card" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'var(--card-bg)' }}>
                  <div className="coupon-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="coupon-code-tag" style={{ background: 'var(--deep-green-subtle)', color: 'var(--deep-green)', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '0.95rem' }}>
                      🏷️ {cp.couponCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleCoupon(cp)}
                      className={`coupon-status-btn ${cp.active ? 'active' : 'inactive'}`}
                      style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: 'none' }}
                    >
                      {cp.active ? '● Active' : '○ Inactive'}
                    </button>
                  </div>

                  <div className="coupon-card-mid">
                    <div style={{ marginBottom: '12px' }}>
                      <span className="coupon-disc-val" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e63946' }}>
                        {cp.discountType === 'percent' ? `${cp.discountValue}% OFF` : `₹${cp.discountValue} OFF`}
                      </span>
                      <p className="coupon-min-ord" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Min Order: <strong>₹{cp.minimumOrder}</strong>
                      </p>
                    </div>

                    <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '10px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>🎟️ Limit: <strong>{cp.usageLimit > 0 ? `${cp.usedCount || 0}/${cp.usageLimit} used` : 'Unlimited'}</strong></div>
                      <div>👤 Max per User: <strong>{cp.perUserLimit || 1} time(s)</strong></div>
                      <div>📅 Expires: <strong>{cp.expiryDate || 'No Expiry'}</strong></div>
                      <div>📂 Category: <strong>{cp.applicableCategory || 'All'}</strong></div>
                      <div>⚡ Stackable: <strong>{cp.isStackable ? 'Yes' : 'No (Exclusive)'}</strong></div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(cp.id)}
                      className="coupon-del-btn"
                      style={{ marginTop: '14px', width: '100%', padding: '8px', background: '#fff0f0', color: '#d90429', border: '1px solid #ffccd5', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      🗑️ Delete Coupon
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
