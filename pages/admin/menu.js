import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/AdminLayout'
import { ALL_MENU_ITEMS } from '../../data/menuData'

export default function AdminMenuDesk() {
  const { user, isAdmin } = useAuth()
  const [menuItems, setMenuItems] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('kawab')
  const [image, setImage] = useState('')
  const [vegNonVeg, setVegNonVeg] = useState('non-veg')
  const [preparationTime, setPreparationTime] = useState('20-25 mins')
  const [spice, setSpice] = useState('Medium')
  const [available, setAvailable] = useState(true)
  const [popular, setPopular] = useState(false)
  
  // Image Upload State
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setUploadProgress(20)

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        // Create canvas and resize image
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 600
        const scaleSize = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scaleSize

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Convert to WebP base64
        const dataUrl = canvas.toDataURL('image/webp', 0.8)
        
        setImage(dataUrl)
        setUploadProgress(100)
        setTimeout(() => setUploading(false), 500)
      }
      img.src = event.target.result
    }
    
    reader.onerror = (error) => {
      alert('Error reading file: ' + error)
      setUploading(false)
    }
    
    reader.readAsDataURL(file)
  }

  // Real-time Firestore sync
  useEffect(() => {
    if (!user) return

    const unsub = onSnapshot(collection(db, 'menu'), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setMenuItems(docs)
    })

    return () => unsub()
  }, [user])

  // Seed default 19 dishes into Firestore if collection is empty
  const handleSeedMenu = async () => {
    try {
      for (const item of ALL_MENU_ITEMS) {
        await addDoc(collection(db, 'menu'), {
          name: item.title,
          description: item.description,
          price: item.price,
          category: item.category,
          categoryName: item.categoryName,
          image: item.image,
          available: true,
          rating: item.rating || 4.8,
          preparationTime: item.time || '20-25 mins',
          popular: item.category.includes('bestseller'),
          vegNonVeg: (item.title.toLowerCase().includes('paneer') || item.title.toLowerCase().includes('mushroom') || item.title.toLowerCase().includes('mashroom') || item.title.toLowerCase().includes('matar') || item.title.toLowerCase().includes('mix veg') || item.title.toLowerCase().includes('palak') || item.category.toLowerCase().includes('bread') || item.category.toLowerCase().includes('veg') || item.title.toLowerCase().includes('roti') || item.title.toLowerCase().includes('naan') || item.title.toLowerCase().includes('kulcha') || item.title.toLowerCase().includes('paratha')) ? 'veg' : 'non-veg',
          ingredients: ['Spices', 'Marination', 'Ghee'],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      }
      alert(`${ALL_MENU_ITEMS.length} menu items seeded successfully into Firestore!`)
    } catch (err) {
      alert('Error seeding menu: ' + err.message)
    }
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    setName('')
    setDescription('')
    setPrice('')
    setCategory('kawab')
    setImage('/menu/Chicken tandoori kawab.jpeg')
    setVegNonVeg('non-veg')
    setPreparationTime('20-25 mins')
    setSpice('Medium')
    setAvailable(true)
    setPopular(false)
    setShowModal(true)
  }

  const handleOpenEdit = (item) => {
    setEditingItem(item)
    setName(item.name || '')
    setDescription(item.description || '')
    setPrice(item.price || '')
    setCategory(item.category || 'kawab')
    setImage(item.image || '')
    setVegNonVeg(item.vegNonVeg || 'non-veg')
    setPreparationTime(item.preparationTime || '20-25 mins')
    setSpice(item.spice || 'Medium')
    setAvailable(item.available ?? true)
    setPopular(item.popular ?? false)
    setShowModal(true)
  }

  const handleSaveItem = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        name,
        description,
        price: Number(price) || 0,
        category,
        image: image || '/menu/Chicken tandoori kawab.jpeg',
        vegNonVeg,
        preparationTime,
        spice,
        available,
        popular,
        updatedAt: serverTimestamp()
      }

      if (editingItem) {
        await updateDoc(doc(db, 'menu', editingItem.id), payload)
      } else {
        await addDoc(collection(db, 'menu'), { ...payload, createdAt: serverTimestamp() })
      }

      setShowModal(false)
    } catch (err) {
      alert('Error saving menu item: ' + err.message)
    }
  }

  const handleDeleteItem = async (id) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return
    try {
      await deleteDoc(doc(db, 'menu', id))
    } catch (err) {
      alert('Error deleting item: ' + err.message)
    }
  }

  const handleToggleAvailability = async (item) => {
    try {
      await updateDoc(doc(db, 'menu', item.id), { available: !item.available })
    } catch (err) {
      console.error(err)
    }
  }

  if (!user || !isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ink)', color: '#ffffff' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Admin Access Required</h2>
          <Link href="/admin" className="btn" style={{ marginTop: '16px' }}>GO TO ADMIN PORTAL</Link>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout activePage="menu" title="Dish Menu Management" itemCount={menuItems.length}>
      <div className="admin-page-container">
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.18em', color: 'var(--deep-green)', textTransform: 'uppercase' }}>
                FOOD CATALOG CONTROL
              </span>
              <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                Menu Management
              </h1>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {menuItems.length === 0 && (
                <button onClick={handleSeedMenu} className="btn secondary" style={{ padding: '10px 18px', fontSize: '0.82rem', borderRadius: '12px' }}>
                  ⚡ SEED INITIAL 19 DISHES
                </button>
              )}
              <button onClick={handleOpenAdd} className="btn" style={{ padding: '10px 20px', fontSize: '0.82rem', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                + ADD NEW FOOD ITEM
              </button>
            </div>
          </header>

          {/* Menu Items Table Container */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '20px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 6px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid rgba(0,0,0,0.08)', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 14px', width: '38%' }}>ITEM</th>
                    <th style={{ padding: '12px 14px' }}>CATEGORY</th>
                    <th style={{ padding: '12px 14px' }}>PRICE</th>
                    <th style={{ padding: '12px 14px' }}>TYPE</th>
                    <th style={{ padding: '12px 14px' }}>STATUS</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {(menuItems.length > 0 ? menuItems : ALL_MENU_ITEMS).map((item) => (
                    <tr key={item.id || item.title} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img src={item.image} alt={item.name || item.title} style={{ width: '46px', height: '46px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                          <div>
                            <strong style={{ color: 'var(--ink)', display: 'block', fontSize: '0.92rem' }}>{item.name || item.title}</strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{item.preparationTime || item.time || '20 mins'}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textTransform: 'capitalize', fontWeight: 600 }}>{item.category}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 900, color: 'var(--deep-green)', fontSize: '0.95rem' }}>₹{item.price}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 900, padding: '4px 10px', borderRadius: '6px', whiteSpace: 'nowrap', background: (item.vegNonVeg === 'veg' || (item.title || item.name || '').toLowerCase().includes('paneer') || (item.category || '').toLowerCase().includes('bread')) ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: (item.vegNonVeg === 'veg' || (item.title || item.name || '').toLowerCase().includes('paneer') || (item.category || '').toLowerCase().includes('bread')) ? '#16a34a' : '#dc2626' }}>
                          {(item.vegNonVeg === 'veg' || (item.title || item.name || '').toLowerCase().includes('paneer') || (item.category || '').toLowerCase().includes('bread')) ? '🟢 VEG' : '🔴 NON-VEG'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          onClick={() => item.id && handleToggleAvailability(item)}
                          style={{
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '999px',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            background: item.available !== false ? 'rgba(13,90,58,0.12)' : 'rgba(0,0,0,0.08)',
                            color: item.available !== false ? 'var(--deep-green)' : '#888'
                          }}
                        >
                          {item.available !== false ? '● Available' : '○ Unavailable'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => item.id ? handleOpenEdit(item) : alert('Click SEED INITIAL 19 DISHES to manage in Firestore')} style={{ background: 'none', border: 'none', color: '#1a73e8', fontWeight: 800, cursor: 'pointer', marginRight: '12px' }}>Edit</button>
                        {item.id && <button onClick={() => handleDeleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 800, cursor: 'pointer' }}>Delete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Add / Edit Food Modal */}
      {showModal && (
        <div className="co-overlay" aria-hidden="false" style={{ opacity: 1, visibility: 'visible', zIndex: 3000 }}>
          <button type="button" className="co-backdrop" onClick={() => setShowModal(false)} />
          <div className="auth-modal-panel" style={{ width: 'min(560px, 94vw)', background: '#ffffff', borderRadius: '28px', padding: '32px', position: 'relative', zIndex: 100, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
                {editingItem ? 'Edit Food Item' : 'Add New Food Item'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="co-field">
                <label>Food Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Chicken Tandoori Kawab" required />
              </div>

              <div className="co-field">
                <label>Description</label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Char-grilled at 500°C..." required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="co-field">
                  <label>Price (₹)</label>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="299" required />
                </div>
                <div className="co-field">
                  <label>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '0.9rem' }}>
                    <option value="kawab">Kawab</option>
                    <option value="biryani">Biryani</option>
                    <option value="gravy">Gravy</option>
                    <option value="bread">Bread</option>
                  </select>
                </div>
              </div>

              <div className="co-field">
                <label>Food Image</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {image && (
                    <img src={image} alt="Preview" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', border: '1px solid rgba(0,0,0,0.1)' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{
                        padding: '10px',
                        border: '1px dashed rgba(0,0,0,0.2)',
                        borderRadius: '12px',
                        width: '100%',
                        cursor: 'pointer',
                        background: '#f9f9f9'
                      }}
                    />
                    {uploading && (
                      <div style={{ marginTop: '8px', background: 'rgba(13,90,58,0.1)', height: '6px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--deep-green)', transition: 'width 0.2s ease' }}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="co-field">
                  <label>Type</label>
                  <select value={vegNonVeg} onChange={e => setVegNonVeg(e.target.value)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '0.9rem' }}>
                    <option value="non-veg">Non-Veg 🔴</option>
                    <option value="veg">Veg 🟢</option>
                  </select>
                </div>
                <div className="co-field">
                  <label>Preparation Time</label>
                  <input type="text" value={preparationTime} onChange={e => setPreparationTime(e.target.value)} placeholder="20-25 mins" />
                </div>
              </div>

              <button type="submit" className="btn" style={{ marginTop: '10px', width: '100%', padding: '16px' }}>
                {editingItem ? 'SAVE CHANGES' : 'CREATE FOOD ITEM'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
