import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'

export default function AdminCategoriesDesk() {
  const { user, isAdmin } = useAuth()
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🍲')

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user])

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!name) return
    try {
      await addDoc(collection(db, 'categories'), {
        name,
        icon: icon || '🍲',
        displayOrder: categories.length + 1,
        createdAt: serverTimestamp()
      })
      setName('')
    } catch (err) {
      alert('Error adding category: ' + err.message)
    }
  }

  const handleDeleteCategory = async (id) => {
    if (!confirm('Delete category?')) return
    try {
      await deleteDoc(doc(db, 'categories', id))
    } catch (err) {
      console.error(err)
    }
  }

  if (!user || !isAdmin) return <div style={{ padding: '60px', textAlign: 'center' }}>Admin access required. <Link href="/admin">Go to Portal</Link></div>

  return (
    <>
      <Head><title>Categories Management | Biriyani Station Admin</title></Head>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f5f0' }}>
        <aside style={{ width: '260px', background: '#092419', color: '#ffffff', padding: '32px 20px', position: 'sticky', top: 0, height: '100vh' }}>
          <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ffffff', marginBottom: '24px' }}>Admin Portal</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link href="/admin" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>📊 Dashboard</Link>
            <Link href="/admin/orders" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🛵 Orders Desk</Link>
            <Link href="/admin/menu" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🍲 Menu Items</Link>
            <Link href="/admin/categories" style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--yellow)', color: 'var(--ink)', fontWeight: 800, textDecoration: 'none' }}>📁 Categories</Link>
            <Link href="/admin/coupons" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🏷️ Coupons</Link>
            <Link href="/admin/users" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>👥 Users</Link>
            <Link href="/admin/settings" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>⚙️ Settings</Link>
          </nav>
        </aside>

        <main style={{ flex: 1, padding: '40px' }}>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.4rem', fontWeight: 900, marginBottom: '24px' }}>Category Management</h1>

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', marginBottom: '24px', border: '1px solid rgba(13,90,58,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Add Category</h3>
            <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '14px' }}>
              <input type="text" value={icon} onChange={e => setIcon(e.target.value)} placeholder="Icon (e.g. 🍢)" style={{ width: '80px', padding: '12px', borderRadius: '12px', border: '1px solid #ccc' }} />
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Category Name (e.g. Charcoal Kawabs)" style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #ccc' }} required />
              <button type="submit" className="btn" style={{ padding: '12px 24px' }}>ADD CATEGORY</button>
            </form>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', border: '1px solid rgba(13,90,58,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Active Categories</h3>
            {categories.length === 0 ? <p style={{ color: 'var(--muted)' }}>No categories added yet.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {categories.map(cat => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#f9f8f5', borderRadius: '14px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem' }}>{cat.icon} {cat.name}</span>
                    <button onClick={() => handleDeleteCategory(cat.id)} style={{ color: '#dc2626', background: 'none', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
