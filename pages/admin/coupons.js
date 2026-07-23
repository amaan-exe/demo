import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'

export default function AdminCouponsDesk() {
  const { user, isAdmin } = useAuth()
  const [coupons, setCoupons] = useState([])
  const [code, setCode] = useState('')
  const [discountValue, setDiscountValue] = useState('')
  const [minimumOrder, setMinimumOrder] = useState('499')

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(collection(db, 'coupons'), (snapshot) => {
      setCoupons(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user])

  const handleAddCoupon = async (e) => {
    e.preventDefault()
    if (!code || !discountValue) return
    try {
      await addDoc(collection(db, 'coupons'), {
        couponCode: code.toUpperCase().trim(),
        discountType: 'flat',
        discountValue: Number(discountValue),
        minimumOrder: Number(minimumOrder) || 0,
        active: true,
        createdAt: serverTimestamp()
      })
      setCode('')
      setDiscountValue('')
    } catch (err) {
      alert('Error creating coupon: ' + err.message)
    }
  }

  const handleToggleCoupon = async (coupon) => {
    try {
      await updateDoc(doc(db, 'coupons', coupon.id), { active: !coupon.active })
    } catch (e) {}
  }

  const handleDeleteCoupon = async (id) => {
    if (!confirm('Delete coupon?')) return
    try {
      await deleteDoc(doc(db, 'coupons', id))
    } catch (e) {}
  }

  if (!user || !isAdmin) return <div style={{ padding: '60px', textAlign: 'center' }}>Admin access required. <Link href="/admin">Go to Portal</Link></div>

  return (
    <>
      <Head><title>Coupon Management | Biriyani Station Admin</title></Head>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f5f0' }}>
        <aside style={{ width: '260px', background: '#092419', color: '#ffffff', padding: '32px 20px', position: 'sticky', top: 0, height: '100vh' }}>
          <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ffffff', marginBottom: '24px' }}>Admin Portal</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link href="/admin" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>📊 Dashboard</Link>
            <Link href="/admin/orders" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🛵 Orders Desk</Link>
            <Link href="/admin/menu" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🍲 Menu Items</Link>
            <Link href="/admin/coupons" style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--yellow)', color: 'var(--ink)', fontWeight: 800, textDecoration: 'none' }}>🏷️ Coupons</Link>
            <Link href="/admin/users" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>👥 Users</Link>
            <Link href="/admin/settings" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>⚙️ Settings</Link>
          </nav>
        </aside>

        <main style={{ flex: 1, padding: '40px' }}>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.4rem', fontWeight: 900, marginBottom: '24px' }}>Coupon Management</h1>

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', marginBottom: '24px', border: '1px solid rgba(13,90,58,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Create New Coupon</h3>
            <form onSubmit={handleAddCoupon} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '14px' }}>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="CODE (e.g. PATNA100)" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #ccc' }} required />
              <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="Discount (₹)" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #ccc' }} required />
              <input type="number" value={minimumOrder} onChange={e => setMinimumOrder(e.target.value)} placeholder="Min Order (₹)" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #ccc' }} required />
              <button type="submit" className="btn" style={{ padding: '12px 24px' }}>CREATE COUPON</button>
            </form>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', border: '1px solid rgba(13,90,58,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Active & Past Coupons</h3>
            {coupons.length === 0 ? <p style={{ color: 'var(--muted)' }}>No coupons created yet.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #eee', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px' }}>COUPON CODE</th>
                    <th style={{ padding: '12px' }}>DISCOUNT</th>
                    <th style={{ padding: '12px' }}>MIN ORDER</th>
                    <th style={{ padding: '12px' }}>STATUS</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map(cp => (
                    <tr key={cp.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '12px', fontWeight: 800, color: 'var(--deep-green)' }}>{cp.couponCode}</td>
                      <td style={{ padding: '12px' }}>₹{cp.discountValue} Off</td>
                      <td style={{ padding: '12px' }}>₹{cp.minimumOrder}</td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={() => handleToggleCoupon(cp)} style={{ border: 'none', padding: '4px 10px', borderRadius: '999px', fontWeight: 800, cursor: 'pointer', background: cp.active ? 'rgba(13,90,58,0.1)' : '#eee', color: cp.active ? 'var(--deep-green)' : '#666' }}>
                          {cp.active ? '● Active' : '○ Inactive'}
                        </button>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button onClick={() => handleDeleteCoupon(cp.id)} style={{ color: '#dc2626', background: 'none', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
