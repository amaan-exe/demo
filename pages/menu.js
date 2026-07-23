import { useEffect, useState, useMemo } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { ALL_MENU_ITEMS } from '../data/menuData'
import { useAuth } from '../context/AuthContext'
import UpiPaymentBox from '../components/UpiPaymentBox'

export default function MenuPage() {
  const router = useRouter()
  const { user, openAuthModal, logout } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Order checkout form state
  const [coName, setCoName] = useState('')
  const [coPhone, setCoPhone] = useState('')
  const [coAddress, setCoAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('COD')
  const [coLoading, setCoLoading] = useState(false)

  // Persist cart to localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('biriyani_cart_v1')
      if (raw) setCartItems(JSON.parse(raw))
    } catch (e) {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('biriyani_cart_v1', JSON.stringify(cartItems))
    } catch (e) {}
  }, [cartItems])

  const addToCart = (item) => {
    setCartItems((currentItems) => {
      const existingItem = currentItems.find((entry) => entry.title === item.title)
      if (existingItem) {
        return currentItems.map((entry) => (
          entry.title === item.title ? { ...entry, qty: entry.qty + 1 } : entry
        ))
      }
      return [...currentItems, { ...item, qty: 1 }]
    })
    
    setToast({
      title: item.title,
      image: item.image,
      id: Date.now()
    })
    
    setTimeout(() => {
      setToast(null)
    }, 3000)
  }

  const updateCartQty = (title, delta) => {
    setCartItems((currentItems) =>
      currentItems
        .map((entry) => (
          entry.title === title ? { ...entry, qty: Math.max(0, entry.qty + delta) } : entry
        ))
        .filter((entry) => entry.qty > 0)
    )
  }

  const removeFromCart = (title) => {
    setCartItems((currentItems) => currentItems.filter((entry) => entry.title !== title))
  }

  const cartCount = cartItems.reduce((sum, entry) => sum + entry.qty, 0)
  const cartTotal = cartItems.reduce((sum, entry) => sum + (entry.price * entry.qty), 0)
  const deliveryFee = cartTotal > 0 ? 40 : 0
  const grandTotal = cartTotal + deliveryFee

  const handleProceedToCheckout = () => {
    if (!user) {
      openAuthModal()
      setToast({
        title: 'Authentication Required',
        message: 'Please sign in or create an account to proceed to checkout.',
        id: Date.now()
      })
      setTimeout(() => setToast(null), 3500)
      return
    }
    setCoName(user.displayName || '')
    setCartOpen(false)
    setCheckoutOpen(true)
  }

  const handlePlaceOrder = async (e, utrString = null) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!user) {
      openAuthModal()
      return
    }

    if (!coPhone || !coAddress) {
      alert('Please enter your phone number and delivery address.')
      return
    }

    try {
      setCoLoading(true)
      const isUpi = paymentMethod === 'UPI'
      const orderId = `BS-PATNA-${Math.floor(100000 + Math.random() * 900000)}`

      const payload = {
        orderId,
        userId: user.uid,
        userEmail: user.email,
        customerName: coName || user.displayName || user.email.split('@')[0],
        customerEmail: user.email,
        customerPhone: coPhone,
        deliveryAddress: coAddress,
        items: cartItems.map(i => ({ title: i.title, qty: i.qty, price: i.price, image: i.image })),
        subtotal: cartTotal,
        deliveryCharge: deliveryFee,
        tax: 0,
        discount: 0,
        grandTotal,
        paymentMethod: isUpi ? 'UPI' : 'COD',
        paymentStatus: isUpi ? 'verification_pending' : 'pending',
        orderStatus: isUpi ? 'payment_verification_pending' : 'pending',
        customerMarkedPaid: isUpi ? true : false,
        transactionReference: utrString || null,
        paymentVerifiedBy: null,
        paymentVerifiedAt: null,
        rejectionReason: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }

      // Save to Firestore in Real Time for Admin Desk & Order Tracking (non-blocking race)
      const fsWrite = setDoc(doc(db, 'orders', orderId), payload)
      const fsTimeout = new Promise((resolve) => setTimeout(resolve, 2000))
      await Promise.race([fsWrite, fsTimeout]).catch((e) => console.warn('Firestore Order Notice:', e))

      // Also save to MongoDB in background
      fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch((e) => console.warn('MongoDB sync:', e))

      // WhatsApp redirection
      const message = `🍛 *New Order — Biriyani Station*\n` +
        `*Order ID:* ${orderId}\n` +
        `*Customer:* ${coName || user.displayName || user.email}\n` +
        `*Phone:* ${coPhone}\n` +
        `*Address:* ${coAddress}\n` +
        `*Payment Method:* ${isUpi ? '📲 Pay via UPI (Verification Pending)' : '💵 Cash on Delivery (COD)'}\n\n` +
        `*Items:*\n` +
        cartItems.map(i => `• ${i.title} x${i.qty} — ₹${(i.price * i.qty).toFixed(0)}`).join('\n') +
        `\n\n*Total: ₹${grandTotal.toFixed(0)}*`

      window.open(`https://wa.me/918271301179?text=${encodeURIComponent(message)}`, '_blank')

      setCartItems([])
      setCheckoutOpen(false)
      setCoPhone('')
      setCoAddress('')
      router.push('/my-orders')
    } catch (err) {
      console.error('Order Error:', err)
      alert('Order placed! Redirecting to tracking...')
      router.push('/my-orders')
    } finally {
      setCoLoading(false)
    }
  }

  // Lock body scroll when drawer/modals open
  useEffect(() => {
    const locked = cartOpen || checkoutOpen || Boolean(selectedProduct)
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [cartOpen, checkoutOpen, selectedProduct])

  // Category counts
  const categoryCounts = useMemo(() => {
    return {
      all: ALL_MENU_ITEMS.length,
      kawab: ALL_MENU_ITEMS.filter(d => d.category.includes('kawab') && !d.category.includes('biryani')).length,
      biryani: ALL_MENU_ITEMS.filter(d => d.category.includes('biryani')).length,
      gravy: ALL_MENU_ITEMS.filter(d => d.category.includes('gravy')).length,
      bread: ALL_MENU_ITEMS.filter(d => d.category.includes('bread')).length,
      bestseller: ALL_MENU_ITEMS.filter(d => d.category.includes('bestseller')).length
    }
  }, [])

  // Filtered menu items calculation
  const filteredDishes = useMemo(() => {
    return ALL_MENU_ITEMS.filter((dish) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch = !q || 
                            dish.title.toLowerCase().includes(q) ||
                            dish.description.toLowerCase().includes(q) ||
                            dish.categoryName.toLowerCase().includes(q) ||
                            dish.tags.some(t => t.toLowerCase().includes(q))

      if (!matchesSearch) return false

      if (activeFilter === 'all') return true
      if (activeFilter === 'kawab') return dish.category.includes('kawab') && !dish.category.includes('biryani')
      if (activeFilter === 'biryani') return dish.category.includes('biryani')
      if (activeFilter === 'gravy') return dish.category.includes('gravy')
      if (activeFilter === 'bread') return dish.category.includes('bread')
      if (activeFilter === 'bestseller') return dish.category.includes('bestseller')
      return true
    })
  }, [activeFilter, searchQuery])

  return (
    <>
      <Head>
        <title>The Complete Menu | Biriyani Station Patna</title>
        <meta name="description" content="Explore 19 authentic clay-oven tandoori kawabs, kawab biryanis, gravies, and fresh breads at Biriyani Station." />
      </Head>

      {/* Sticky Header */}
      <header className="site-header scrolled" id="top">
        <nav className="nav container" aria-label="Primary navigation">
          <Link href="/" className="logo" aria-label="Biriyani Station home">
            BIRIYANI <span>STATION</span>
          </Link>

          <button className="nav-toggle" id="navToggle" aria-label="Toggle navigation" aria-expanded={isNavOpen} onClick={() => setIsNavOpen(!isNavOpen)}>
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className={`nav-right ${isNavOpen ? 'open' : ''}`} id="navLinks">
            <Link href="/" onClick={() => setIsNavOpen(false)}>HOME</Link>
            <Link href="/menu" className="active" onClick={() => setIsNavOpen(false)} style={{color: 'var(--yellow)'}}>MENU</Link>
            <Link href="/#about" onClick={() => setIsNavOpen(false)}>ABOUT</Link>
            <Link href="/#order" onClick={() => setIsNavOpen(false)}>ORDER</Link>
            <a href="https://wa.me/918271301179" target="_blank" rel="noopener noreferrer" className="btn cta" onClick={() => setIsNavOpen(false)}>Order on Whatsapp</a>

            {user ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(13,90,58,0.08)',
                    border: '1px solid rgba(13,90,58,0.18)',
                    padding: '6px 14px 6px 6px',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    color: 'var(--deep-green)'
                  }}
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--deep-green)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: '800' }}>
                      {user.displayName?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                  <span>{user.displayName?.split(' ')[0]}</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>▼</span>
                </button>

                {userMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '12px 16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    border: '1px solid rgba(0,0,0,0.08)',
                    minWidth: '200px',
                    zIndex: 2000
                  }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '6px' }}>
                      Logged in as<br/>
                      <strong style={{ color: 'var(--ink)' }}>{user.email}</strong>
                    </div>
                    <Link
                      href="/my-orders"
                      onClick={() => setUserMenuOpen(false)}
                      style={{ display: 'block', padding: '6px 0', fontSize: '0.85rem', fontWeight: '700', color: 'var(--ink)', textDecoration: 'none' }}
                    >
                      📦 My Orders
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      style={{ display: 'block', padding: '6px 0', fontSize: '0.85rem', fontWeight: '700', color: 'var(--ink)', textDecoration: 'none' }}
                    >
                      👤 My Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        style={{ display: 'block', padding: '6px 0', fontSize: '0.85rem', fontWeight: '800', color: 'var(--deep-green)', textDecoration: 'none' }}
                      >
                        🛡️ Admin Portal
                      </Link>
                    )}
                    <button
                      onClick={() => { logout(); setUserMenuOpen(false); }}
                      style={{ width: '100%', background: 'none', border: 'none', color: '#dc3232', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left', padding: '6px 0', borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: '4px', paddingTop: '8px' }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                style={{
                  background: 'var(--yellow)',
                  border: 'none',
                  color: 'var(--ink)',
                  padding: '8px 20px',
                  borderRadius: '999px',
                  fontSize: '0.82rem',
                  fontWeight: '800',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
                }}
              >
                SIGN IN
              </button>
            )}

            <button
              type="button"
              className="nav-logo-button"
              onClick={() => setCartOpen((open) => !open)}
              aria-label={`Open cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            >
              <img className="nav-logo-mark" src="/cart.png" alt="Cart" />
              {cartCount > 0 ? <span className="nav-logo-count">{cartCount}</span> : null}
            </button>
          </div>
        </nav>
      </header>

      <main>
        {/* Luxury Hero Header Section */}
        <section className="menu-hero-seamless" style={{
          paddingTop: '40px',
          paddingBottom: '30px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div className="container">
            {/* Header badges and breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '999px', background: 'rgba(13,90,58,0.08)', border: '1px solid rgba(13,90,58,0.15)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--deep-green)' }}></span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.18em', color: 'var(--deep-green)', textTransform: 'uppercase' }}>
                  EST. 2026 · PATNA SPECIALITY
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
                <Link href="/" style={{ color: 'var(--deep-green)', textDecoration: 'none' }}>Home</Link> / <span style={{ color: 'var(--ink)' }}>Menu</span>
              </div>
            </div>

            {/* Main Headline */}
            <div style={{ textAlign: 'center', maxWidth: '840px', margin: '0 auto' }}>
              <p className="section-label" style={{ marginBottom: '12px', letterSpacing: '0.3em', color: 'var(--deep-green)' }}>
                HANDCRAFTED DUM & TANDOOR
              </p>
              
              <h1 className="display" style={{
                fontSize: 'clamp(2.4rem, 5vw, 4.2rem)',
                lineHeight: '1.05',
                margin: '0 0 20px 0',
                color: 'var(--ink)',
                textTransform: 'uppercase',
                fontWeight: 900
              }}>
                THE COMPLETE <br/>
                <span className="highlight-italic" style={{ color: 'var(--deep-green)' }}>19 DISHES</span> MENU.
              </h1>

              <p style={{
                fontSize: 'clamp(1rem, 1.8vw, 1.18rem)',
                color: 'var(--text-muted)',
                lineHeight: '1.65',
                maxWidth: '680px',
                margin: '0 auto 32px auto'
              }}>
                Smoky clay-oven charcoal kawabs, royal dum kawab biryanis, rich Punjabi butter gravies, and fresh tandoori rotis cooked over live fire.
              </p>

              {/* Quick stats pills */}
              <div style={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '12px',
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(8px)',
                borderRadius: '20px',
                border: '1px solid rgba(13,90,58,0.12)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.04)'
              }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--deep-green)' }}>🔥 5 Kawabs</span>
                <span style={{ color: 'rgba(0,0,0,0.2)' }}>•</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--deep-green)' }}>🍛 5 Kawab Biryanis</span>
                <span style={{ color: 'rgba(0,0,0,0.2)' }}>•</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--deep-green)' }}>🍲 5 Gravies</span>
                <span style={{ color: 'rgba(0,0,0,0.2)' }}>•</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--deep-green)' }}>🫓 4 Breads</span>
              </div>
            </div>
          </div>
        </section>

        {/* Ticker marquee strip */}
        <section className="marquee marquee-one" aria-label="Menu ticker" style={{ marginBlock: '20px' }}>
          <div className="marquee-track reverse">
            <span>TANDOORI KAWABS · DUM KAWAB BIRYANI · CHICKEN DEHATI · PANEER BUTTER MASALA · BUTTER NAAN ·</span>
            <span>TANDOORI KAWABS · DUM KAWAB BIRYANI · CHICKEN DEHATI · PANEER BUTTER MASALA · BUTTER NAAN ·</span>
          </div>
        </section>

        {/* Main Controls & Menu Grid */}
        <section className="menu section-pad" id="menu" style={{ paddingTop: '20px' }}>
          <div className="container">
            
            {/* Search and Category Filter Bar */}
            <div className="menu-controls-wrapper" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              marginBottom: '40px',
              alignItems: 'center'
            }}>
              
              {/* Glassmorphic Search Bar */}
              <div className="search-bar-container" style={{ width: '100%', maxWidth: '580px', position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search kawabs, biryani, chicken dehati, naan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '16px 24px 16px 54px',
                    borderRadius: '999px',
                    border: '2px solid rgba(13,90,58,0.18)',
                    background: '#ffffff',
                    fontSize: '1.02rem',
                    color: 'var(--ink)',
                    outline: 'none',
                    boxShadow: '0 10px 30px rgba(13,90,58,0.06)',
                    transition: 'all 0.25s ease',
                    fontWeight: '500'
                  }}
                />
                <span style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: '1.2rem' }}>🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '18px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(0,0,0,0.06)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: 'var(--ink)'
                    }}
                  >✕</button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="menu-chips" role="tablist" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: '10px' }}>
                {[
                  { id: 'all', label: `All (${categoryCounts.all})` },
                  { id: 'kawab', label: `Kawabs (${categoryCounts.kawab})` },
                  { id: 'biryani', label: `Kawab Biryanis (${categoryCounts.biryani})` },
                  { id: 'gravy', label: `Gravies (${categoryCounts.gravy})` },
                  { id: 'bread', label: `Breads (${categoryCounts.bread})` },
                  { id: 'bestseller', label: `⭐ Bestsellers (${categoryCounts.bestseller})` }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`chip ${activeFilter === tab.id ? 'active' : ''}`}
                    type="button"
                    onClick={() => setActiveFilter(tab.id)}
                    style={{ transition: 'all 0.2s ease' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid rgba(13,90,58,0.1)', paddingBottom: '16px' }}>
              <span style={{ fontSize: '0.92rem', color: 'var(--deep-green)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {activeFilter === 'all' ? 'All Dishes' : activeFilter.toUpperCase()} ({filteredDishes.length})
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
                Click any dish for ingredients & details
              </span>
            </div>

            {/* Menu Grid */}
            {filteredDishes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '70px 20px', background: '#fff', borderRadius: '28px', border: '1px dashed rgba(13,90,58,0.2)', boxShadow: '0 12px 36px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '14px' }}>🍲</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)' }}>No matching dishes found</h3>
                <p style={{ color: 'var(--muted)', marginTop: '8px', maxWidth: '420px', marginInline: 'auto' }}>We couldn't find any dish matching "{searchQuery}". Try selecting another category or resetting filters.</p>
                <button className="btn" onClick={() => { setActiveFilter('all'); setSearchQuery(''); }} style={{ marginTop: '24px' }}>
                  Reset Search & Filters
                </button>
              </div>
            ) : (
              <div className="menu-grid premium-grid">
                {filteredDishes.map((dish) => (
                  <article
                    key={dish.id}
                    className="menu-card"
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedProduct(dish)}
                  >
                    <div className="dish-media" style={{ height: '240px', overflow: 'hidden', position: 'relative' }}>
                      <img
                        src={dish.image}
                        alt={dish.title}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
                      />
                      <span className="dish-tag">{dish.categoryName.toUpperCase()}</span>
                      <span className="price-badge">{dish.priceLabel}</span>
                      <div className="dish-overlay"></div>
                    </div>

                    <div className="menu-body">
                      <div className="menu-head">
                        <h3 className="dish-title">{dish.title.toUpperCase()}</h3>
                        <strong className="dish-price">{dish.priceLabel}</strong>
                      </div>
                      
                      <p className="dish-desc">{dish.description}</p>
                      
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '14px 0 18px 0' }}>
                        <span style={{ fontSize: '0.76rem', background: 'rgba(13,90,58,0.08)', color: 'var(--deep-green)', padding: '4px 10px', borderRadius: '8px', fontWeight: 700 }}>
                          🌶️ {dish.spice}
                        </span>
                        <span style={{ fontSize: '0.76rem', background: 'rgba(0,0,0,0.04)', color: 'var(--ink)', padding: '4px 10px', borderRadius: '8px', fontWeight: 600 }}>
                          ⏱️ {dish.time}
                        </span>
                        <span style={{ fontSize: '0.76rem', background: 'rgba(245, 200, 66, 0.2)', color: '#8a6200', padding: '4px 10px', borderRadius: '8px', fontWeight: 700 }}>
                          {dish.portion}
                        </span>
                      </div>

                      <div className="menu-actions">
                        <button
                          type="button"
                          className="btn-order"
                          onClick={(event) => {
                            event.stopPropagation()
                            addToCart({ title: dish.title, price: dish.price, image: dish.image })
                          }}
                        >
                          ADD TO CART
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Floating Cart Button */}
      <button
        type="button"
        className={`cart-floater ${cartOpen ? 'is-hidden' : ''}`}
        onClick={() => setCartOpen(true)}
        aria-label={`Open cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}
      >
        <img src="/cart.png" alt="Cart" />
        {cartCount > 0 ? <span className="cart-floater-count">{cartCount}</span> : null}
      </button>

      {/* Cart Drawer */}
      <aside className={`cart-drawer ${cartOpen ? 'open' : ''}`} aria-label="Shopping cart" aria-hidden={cartOpen ? 'false' : 'true'}>
        <div className="cart-hd">
          <div className="cart-hd-left">
            <span className="cart-hd-eyebrow">YOUR CART</span>
            <h2 className="cart-hd-title">Fresh from<br/>the Pot 🍲</h2>
          </div>
          <button type="button" className="cart-x" aria-label="Close cart" onClick={() => setCartOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 1l16 16M17 1L1 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="cart-body">
          {cartItems.length === 0 ? (
            <div className="cart-empty-state">
              <div className="cart-empty-icon">🫙</div>
              <p className="cart-empty-title">Nothing here yet</p>
              <p className="cart-empty-sub">Add a dish to get the feast going.</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div className="citem" key={item.title}>
                <div className="citem-img-wrap">
                  <img src={item.image} alt={item.title} className="citem-img" />
                </div>
                <div className="citem-info">
                  <p className="citem-name">{item.title}</p>
                  <p className="citem-unit">₹{item.price.toFixed(0)} each</p>
                  <div className="citem-stepper">
                    <button type="button" className="stepper-btn" onClick={() => updateCartQty(item.title, -1)}>
                      <svg width="10" height="2" viewBox="0 0 10 2"><rect width="10" height="2" rx="1" fill="currentColor"/></svg>
                    </button>
                    <span className="stepper-qty">{item.qty}</span>
                    <button type="button" className="stepper-btn" onClick={() => updateCartQty(item.title, 1)}>
                      <svg width="10" height="10" viewBox="0 0 10 10"><rect x="4" width="2" height="10" rx="1" fill="currentColor"/><rect y="4" width="10" height="2" rx="1" fill="currentColor"/></svg>
                    </button>
                  </div>
                </div>
                <div className="citem-right">
                  <p className="citem-subtotal">₹{(item.price * item.qty).toFixed(0)}</p>
                  <button type="button" className="citem-remove" onClick={() => removeFromCart(item.title)}>
                    <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-foot">
          <div className="cart-foot-row">
            <span>Subtotal</span>
            <strong>₹{cartTotal.toFixed(0)}</strong>
          </div>
          <p className="cart-foot-note">Delivery fee calculated at checkout</p>
          <button
            type="button"
            className="cart-cta"
            onClick={handleProceedToCheckout}
            disabled={cartItems.length === 0}
          >
            <span>Proceed to Checkout</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </aside>

      {cartOpen ? <button type="button" className="cart-backdrop" aria-label="Close cart overlay" onClick={() => setCartOpen(false)} /> : null}

      {/* Detail Modal */}
      {selectedProduct ? (
        <div className="product-modal" aria-hidden="false">
          <button type="button" className="product-modal-backdrop" aria-label="Close product details" onClick={() => setSelectedProduct(null)} />
          <section className="product-modal-panel" role="dialog" aria-modal="true" aria-labelledby="productModalTitle">
            <button type="button" className="modal-close product-modal-close" aria-label="Close product details" onClick={() => setSelectedProduct(null)}>×</button>

            <div className="product-modal-visual">
              <div className="product-modal-ribbon">{selectedProduct.categoryName}</div>
              <img src={selectedProduct.image} alt={selectedProduct.title} className="product-modal-image" />
              <div className="product-modal-glow" aria-hidden="true" />
            </div>

            <div className="product-modal-body">
              <p className="section-label">{selectedProduct.categoryName.toUpperCase()}</p>
              <h2 id="productModalTitle">{selectedProduct.title}</h2>
              <p className="product-modal-copy">{selectedProduct.description}</p>

              <div className="product-modal-tags" aria-label="Dish tags">
                {selectedProduct.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>

              <div className="product-modal-facts">
                <div>
                  <span>PRICE</span>
                  <strong>{selectedProduct.priceLabel}</strong>
                </div>
                <div>
                  <span>SPICE</span>
                  <strong>{selectedProduct.spice || 'Balanced'}</strong>
                </div>
                <div>
                  <span>TIME</span>
                  <strong>{selectedProduct.time || 'Freshly packed'}</strong>
                </div>
                <div>
                  <span>PORTION</span>
                  <strong>{selectedProduct.portion || 'Generous'}</strong>
                </div>
              </div>

              <div className="product-modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    addToCart({ title: selectedProduct.title, price: selectedProduct.price, image: selectedProduct.image })
                    setSelectedProduct(null)
                  }}
                >
                  ADD TO CART
                </button>
                <button type="button" className="btn secondary" onClick={() => setSelectedProduct(null)}>CLOSE</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* Checkout Modal */}
      <div className="co-overlay" aria-hidden={checkoutOpen ? 'false' : 'true'}>
        <button type="button" className="co-backdrop" aria-label="Close checkout" onClick={() => setCheckoutOpen(false)} />
        <div className="co-panel" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
          <button type="button" className="co-close" aria-label="Close checkout" onClick={() => setCheckoutOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 1l14 14M15 1L1 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          
          <div className="co-left">
            <div className="co-left-top">
              <p className="co-eyebrow">Biriyani Station</p>
              <h2 id="checkoutTitle" className="co-headline">Your<br/>Order</h2>
              <p className="co-tagline">We'll cook it fresh. You just tell us where.</p>
            </div>

            <div className="co-items">
              {cartItems.length === 0 ? (
                <p className="co-no-items">Your cart is empty.</p>
              ) : (
                cartItems.map((item) => (
                  <div className="co-item" key={item.title}>
                    <img src={item.image} alt={item.title} className="co-item-img" />
                    <div className="co-item-info">
                      <p className="co-item-name">{item.title}</p>
                      <p className="co-item-qty">x{item.qty}</p>
                    </div>
                    <p className="co-item-price">₹{(item.price * item.qty).toFixed(0)}</p>
                  </div>
                ))
              )}
            </div>

            <div className="co-totals">
              <div className="co-total-row">
                <span>Subtotal</span><span>₹{cartTotal.toFixed(0)}</span>
              </div>
              <div className="co-total-row">
                <span>Delivery</span><span>{deliveryFee > 0 ? `₹${deliveryFee}` : 'Free 🎉'}</span>
              </div>
              <div className="co-total-row co-total-grand">
                <span>Total</span><strong>₹{grandTotal.toFixed(0)}</strong>
              </div>
            </div>
          </div>

          <div className="co-right">
            <p className="co-form-eyebrow">Step 2 of 2</p>
            <h3 className="co-form-title">Delivery Details</h3>
            <p className="co-form-sub">We'll send your order confirmation on WhatsApp.</p>

            <form className="co-form" onSubmit={handlePlaceOrder}>
              <div className="co-field">
                <label htmlFor="co-name">Full Name</label>
                <input
                  id="co-name"
                  type="text"
                  placeholder="Muhammad Amanullah"
                  value={coName}
                  onChange={(e) => setCoName(e.target.value)}
                  required
                />
              </div>
              <div className="co-field">
                <label htmlFor="co-phone">Phone Number</label>
                <input
                  id="co-phone"
                  type="tel"
                  placeholder="+91 82713 01179"
                  value={coPhone}
                  onChange={(e) => setCoPhone(e.target.value)}
                  required
                />
              </div>
              <div className="co-field">
                <label htmlFor="co-address">Delivery Address</label>
                <textarea
                  id="co-address"
                  rows={3}
                  placeholder="House no, Street, Landmark, Patna…"
                  value={coAddress}
                  onChange={(e) => setCoAddress(e.target.value)}
                  required
                />
              </div>

              {/* Payment Method Selector */}
              <div style={{ marginTop: '14px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 800, fontSize: '0.85rem', color: 'var(--ink)' }}>
                  SELECT PAYMENT METHOD
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COD')}
                    style={{
                      padding: '14px 12px',
                      borderRadius: '14px',
                      border: paymentMethod === 'COD' ? '2px solid var(--deep-green)' : '1px solid rgba(0,0,0,0.12)',
                      background: paymentMethod === 'COD' ? 'rgba(13,90,58,0.08)' : '#ffffff',
                      color: paymentMethod === 'COD' ? 'var(--deep-green)' : 'var(--ink)',
                      fontWeight: '800',
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>💵 Cash on Delivery</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    style={{
                      padding: '14px 12px',
                      borderRadius: '14px',
                      border: paymentMethod === 'UPI' ? '2px solid var(--deep-green)' : '1px solid rgba(0,0,0,0.12)',
                      background: paymentMethod === 'UPI' ? 'rgba(13,90,58,0.08)' : '#ffffff',
                      color: paymentMethod === 'UPI' ? 'var(--deep-green)' : 'var(--ink)',
                      fontWeight: '800',
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>📲 Pay via UPI</span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'UPI' ? (
                <UpiPaymentBox
                  grandTotal={grandTotal}
                  orderId={`RK${Date.now().toString().slice(-4)}`}
                  onConfirmPayment={handlePlaceOrder}
                  loading={coLoading}
                />
              ) : (
                <>
                  <div style={{ background: '#faf9f5', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '14px', padding: '12px 14px', marginTop: '12px' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                      💵 <strong>Cash or QR Scan on Delivery</strong>: Pay cash or scan QR code when your food is delivered.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="co-whatsapp"
                    disabled={coLoading}
                    style={{ width: '100%', border: 'none', cursor: coLoading ? 'wait' : 'pointer', marginTop: '16px' }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    {coLoading ? 'Saving Order...' : 'Place Order via WhatsApp'}
                  </button>
                </>
              )}
            </form>

            <button type="button" className="co-cancel" onClick={() => setCheckoutOpen(false)}>Cancel</button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer-brutalist" role="contentinfo">
        <div className="marquee marquee-footer" aria-label="Order ticker">
          <div className="marquee-track">
            <span>HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • </span>
            <span>HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • </span>
          </div>
        </div>
        
        <div className="footer-massive-nav container">
          <nav className="massive-links">
            <Link href="/" data-text="HOME">HOME</Link>
            <Link href="/menu" data-text="MENU">MENU</Link>
            <a href="/#about" data-text="ABOUT">ABOUT</a>
            <a href="/#order" data-text="ORDER">ORDER</a>
          </nav>
          <div className="footer-info-grid">
            <div className="info-block">
              <span>📍 LOCATION</span>
              <p>Phulwari Shareef, Patna, Bihar</p>
            </div>
            <div className="info-block">
              <span>💬 CONTACT</span>
              <p><span className="aman">
          <a href="https://igniusstudios.vercel.app" target="_blank" rel="noopener noreferrer" >   igniusstudios.com</a> </span></p>
            </div>
            <div className="info-block socials-brutalist">
              <a href="https://instagram.com/_.hussain29" target="_blank" rel="noopener noreferrer" >INSTAGRAM</a>
              <a href="https://wa.me/918271301179" target="_blank" rel="noreferrer">WHATSAPP</a>
              <a href="https://github.com/amaan-exe" target="_blank" rel="noopener noreferrer">Github</a>
            </div>
          </div>
        </div>

        <div className="footer-bleeding-edge">
          BIRIYANI STATION
        </div>
        
        <div className="footer-bottom-bar container">
          <p>© 2026 Biriyani Station · Patna, Bihar</p>
          <div className="legal-links">
            <a href="#">COOKIES</a>
            <a href="#">PRIVACY POLICY</a>
          </div>
          <p>Made by 
          <span className="aman">
          <a href="https://instagram.com/_.hussain29" target="_blank" rel="noopener noreferrer" >   Amanullah</a> </span>
          <span> with ❤️ </span></p>
        </div>
      </footer>

      {/* Toast Notification */}
      <div className={`cart-toast ${toast ? 'show' : ''}`} aria-hidden={toast ? 'false' : 'true'}>
        {toast && (
          <>
            <img src={toast.image} alt={toast.title} />
            <div className="cart-toast-text">
              <span>Added to cart</span>
              <p>{toast.title}</p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
