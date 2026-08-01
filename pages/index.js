import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import dynamic from 'next/dynamic'
import { db } from '../lib/firebase'
import { FEATURED_DISHES, ALL_MENU_ITEMS } from '../data/menuData'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

import SiteNav from '../components/SiteNav'
import CartDrawer from '../components/CartDrawer'
import MobileBottomBar from '../components/MobileBottomBar'
import ToastNotification from '../components/ToastNotification'

const CheckoutModal = dynamic(() => import('../components/CheckoutModal'), { ssr: false })
const AnnouncementBanner = dynamic(() => import('../components/AnnouncementBanner'), { ssr: false })

export default function Home() {
  const router = useRouter()
  const { user, userProfile, isAdmin, isStaffOnly, isDeliveryOnly, openAuthModal, logout, accessToken } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [frontPhoto, setFrontPhoto] = useState(2)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [showFloater, setShowFloater] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Order checkout form state
  const [coName, setCoName] = useState('')
  const [coPhone, setCoPhone] = useState('')
  const [coAddress, setCoAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [coLoading, setCoLoading] = useState(false)

  // Persist cart to localStorage so it survives reloads
  useEffect(() => {
    try {
      const raw = localStorage.getItem('biriyani_cart_v1')
      if (raw) setCartItems(JSON.parse(raw))
    } catch (e) { }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('biriyani_cart_v1', JSON.stringify(cartItems))
    } catch (e) { }
  }, [cartItems])

  // Scroll Reveal Animations
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -50px 0px" });

    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach((reveal) => observer.observe(reveal));

    return () => {
      reveals.forEach((reveal) => observer.unobserve(reveal));
    };
  }, []);

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

  const openProduct = (product) => {
    setSelectedProduct(product)
  }

  const closeProduct = () => {
    setSelectedProduct(null)
  }

  const { settings } = useSettings()
  const cartCount = cartItems.reduce((sum, entry) => sum + entry.qty, 0)
  const cartTotal = cartItems.reduce((sum, entry) => sum + (entry.price * entry.qty), 0)
  const deliveryFee = cartTotal > 0 ? (settings?.deliveryCharge ?? 40) : 0
  const grandTotal = cartTotal + deliveryFee

  const handleProceedToCheckout = () => {
    if (settings?.isStoreOpen === false) {
      alert('🔴 Restaurant is currently closed. We are not accepting online orders right now.')
      return
    }
    if (!user) {
      openAuthModal()
      setToast({
        type: 'warning',
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

  const handlePlaceOrder = async (orderData = {}, utrString = null) => {
    if (settings?.isStoreOpen === false) {
      alert('🔴 Restaurant is currently closed. We are not accepting online orders right now.')
      return
    }

    const finalName = orderData.name || coName || user?.displayName || user?.email?.split('@')[0]
    const finalPhone = orderData.phone || coPhone
    const finalAddress = orderData.address || coAddress
    const isUpi = orderData.isUpi !== undefined ? orderData.isUpi : paymentMethod === 'UPI'

    if (!user) {
      openAuthModal()
      return
    }

    if (!finalPhone || !finalAddress) {
      alert('Please enter your phone number and delivery address.')
      return
    }

    try {
      setCoLoading(true)
      // Collision-resistant Order ID (Timestamp base-36 + 4-digit random)
      const ts = Date.now().toString(36).toUpperCase()
      const rnd = Math.floor(1000 + Math.random() * 9000).toString()
      const orderId = `BS-PATNA-${ts}-${rnd}`

      const discountValue = orderData.coupon ? orderData.coupon.discount : 0
      const finalGrandTotal = Math.max(0, grandTotal - discountValue)

      const payload = {
        orderId,
        userId: user.uid,
        userEmail: user.email,
        customerName: finalName,
        customerEmail: user.email,
        customerPhone: finalPhone,
        deliveryAddress: finalAddress,
        items: cartItems.map(i => ({ title: i.title, qty: i.qty, price: i.price, image: i.image })),
        subtotal: cartTotal,
        deliveryCharge: deliveryFee,
        tax: 0,
        discount: discountValue,
        appliedCoupon: orderData.coupon ? orderData.coupon.code : null,
        grandTotal: finalGrandTotal,
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

      // Save to Firestore with proper wait and error handling
      await setDoc(doc(db, 'orders', orderId), payload)

      // MongoDB background sync with retry logic
      const syncWithMongo = async (attempts = 3) => {
        for (let i = 0; i < attempts; i++) {
          try {
            const res = await fetch('/api/orders/create', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify(payload)
            })
            if (res.ok) return // Success
          } catch (e) {
            if (i === attempts - 1) console.warn('MongoDB sync failed after retries:', e)
            await new Promise(r => setTimeout(r, 1000 * (i + 1))) // Backoff
          }
        }
      }
      syncWithMongo()

      // WhatsApp redirection
      const message = `🍛 *New Order — Biriyani Station*\n` +
        `*Order ID:* ${orderId}\n` +
        `*Customer:* ${finalName || user.displayName || user.email}\n` +
        `*Phone:* ${finalPhone}\n` +
        `*Address:* ${finalAddress}\n` +
        `*Payment Method:* ${isUpi ? '📲 Pay via UPI (Verification Pending)' : '💵 Cash on Delivery (COD)'}\n\n` +
        `*Items:*\n` +
        cartItems.map(i => `• ${i.title} x${i.qty} — ₹${(i.price * i.qty).toFixed(0)}`).join('\n') +
        (orderData.coupon ? `\n\n*Coupon Applied:* ${orderData.coupon.code} (-₹${orderData.coupon.discount})` : '') +
        `\n\n*Total: ₹${finalGrandTotal.toFixed(0)}*`

      window.open(`https://wa.me/919102985148?text=${encodeURIComponent(message)}`, '_blank')

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

  useEffect(() => {
    const header = document.querySelector('.site-header')
    const onScroll = () => {
      if (window.scrollY > 32) header?.classList.add('scrolled')
      else header?.classList.remove('scrolled')
    }
    window.addEventListener('scroll', onScroll)
    onScroll()

    const words = document.querySelectorAll('.hero-title .word')
    words.forEach((w, i) => setTimeout(() => w.classList.add('pop'), 120 + i * 140))

    const plate = document.querySelector('#heroPlate')
    let onPlateScroll = null
    if (plate) {
      plate.classList.add('served')
      onPlateScroll = () => {
        const scrollY = window.scrollY
        const rotateX = Math.max(-45, Math.min(scrollY * 0.15, 60))
        const rotateZ = scrollY * 0.05
        const scale = 1 + (scrollY * 0.0005)
        plate.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale(${scale})`
      }
      window.addEventListener('scroll', onPlateScroll)
    }

    const onEscapeProduct = (event) => {
      if (event.key === 'Escape') closeProduct()
    }

    document.addEventListener('keydown', onEscapeProduct)

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (onPlateScroll) window.removeEventListener('scroll', onPlateScroll)
      document.removeEventListener('keydown', onEscapeProduct)
    }
  }, [])

  useEffect(() => {
    const footer = document.querySelector('.footer-brutalist')
    if (!footer) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setShowFloater(!entry.isIntersecting))
      },
      { threshold: 0, rootMargin: '0px 0px 180px 0px' }
    )
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const locked = cartOpen || checkoutOpen || Boolean(selectedProduct)
    document.body.style.overflow = locked ? 'hidden' : ''
    document.body.classList.toggle('cart-locked', locked)
    return () => {
      document.body.style.overflow = ''
      document.body.classList.remove('cart-locked')
    }
  }, [cartOpen, checkoutOpen, selectedProduct])

  return (
    <>
      <Head>
        <title>Best Biryani in Phulwari Sharif | Chicken & Mutton Dum Biryani | Biriyani Station</title>
        <meta name="description" content="Enjoy authentic Chicken & Mutton Dum Biryani at Biriyani Station, Phulwari Sharif, Patna. Order online for fast delivery or dine in with family. Fresh ingredients, rich flavors, and affordable prices." />
        <meta name="keywords" content="Best biryani in Phulwari Sharif, Chicken biryani Phulwari Sharif, Mutton biryani Phulwari Sharif, Biryani near Phulwari Sharif, Order biryani online Phulwari Sharif, Biryani delivery Phulwari Sharif, Best restaurant in Phulwari Sharif, Dum biryani Phulwari Sharif, Restaurant near AIIMS Patna, Best biryani in Patna, Food delivery Patna, Chicken Dum Biryani, Mutton Dum Biryani, Tandoori Chicken, Biriyani Station Phulwari Sharif" />
        <link rel="canonical" href="https://www.biriyanistation.in/" />
        <link rel="preload" as="image" href="/photo-1633945274309-2c16c9682a8c.webp" fetchpriority="high" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.biriyanistation.in/" />
        <meta property="og:title" content="Best Biryani in Phulwari Sharif | Chicken & Mutton Dum Biryani | Biriyani Station" />
        <meta property="og:description" content="Enjoy authentic Chicken & Mutton Dum Biryani at Biriyani Station, Phulwari Sharif, Patna. Order online for fast delivery or dine in with family. Fresh ingredients, rich flavors, and affordable prices." />
        <meta property="og:image" content="https://www.biriyanistation.in/images/og-image.jpg" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://www.biriyanistation.in/" />
        <meta property="twitter:title" content="Best Biryani in Phulwari Sharif | Chicken & Mutton Dum Biryani | Biriyani Station" />
        <meta property="twitter:description" content="Enjoy authentic Chicken & Mutton Dum Biryani at Biriyani Station, Phulwari Sharif, Patna. Order online for fast delivery or dine in with family. Fresh ingredients, rich flavors, and affordable prices." />
        <meta property="twitter:image" content="https://www.biriyanistation.in/images/og-image.jpg" />

        {/* JSON-LD Schema.org for LocalBusiness/Restaurant */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Restaurant",
              "name": "Biriyani Station",
              "image": "https://www.biriyanistation.in/images/og-image.jpg",
              "url": "https://www.biriyanistation.in",
              "telephone": "+919102985148",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Phulwari Sharif, Patna",
                "addressRegion": "Bihar",
                "addressCountry": "IN"
              },
              "servesCuisine": "Indian, Mughlai, Dum Biryani",
              "priceRange": "₹₹",
              "menu": "https://www.biriyanistation.in/menu"
            })
          }}
        />
      </Head>

      <SiteNav activePage="home" />

      <AnnouncementBanner placement="hero" />

      <main>
        {/* Semantic SEO Keywords Structure */}
        <div style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
          <h1>Best Biryani in Phulwari Sharif, Patna</h1>
          <h2>Authentic Dum Biryani</h2>
          <h2>Chicken & Mutton Biryani</h2>
          <h2>Order Biryani Online</h2>
          <h2>Fast Home Delivery in Phulwari Sharif</h2>
          <h2>Family Restaurant in Phulwari Sharif</h2>
          <h2>Freshly Prepared Mughlai Cuisine</h2>
        </div>
        <section className="hero-clean-split" id="hero">
          {/* Optimized background video element */}
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="none"
            ref={(el) => {
              if (el) {
                el.muted = true
                // Delay play slightly after page load to avoid blocking LCP render
                setTimeout(() => {
                  el.play().catch(() => { })
                }, 1000)
              }
            }}
            poster="/photo-1633945274309-2c16c9682a8c.webp"
            className="hero-video-bg"
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>

          {/* Dark gradient overlay for crystal clear text readability */}
          <div className="hero-video-overlay" />

          <div className="hcs-inner container">
            <div className="hcs-left">
              <span className="hcs-eyebrow mobile-only">AUTHENTIC DUM & KAWABS</span>
              <div className="hcs-heading">
                <span className="hcs-word outline">ZAIQA</span>
                <span className="hcs-word outline">LAZEEZ</span>
              </div>
            </div>

            <div className="hcs-center">
              <p className="hcs-sub desktop-only">ORDER NOW.<br />EAT NOW.</p>
              <div className="hcs-divider-pill mobile-only">
                <span>🔥 SLOW DUM OVER HARDWOOD COALS</span>
              </div>
            </div>

            <div className="hcs-right">
              <span className="hcs-eyebrow right-eyebrow mobile-only">TRADITIONAL CLAY OVEN</span>
              <div className="hcs-heading">
                <span className="hcs-word solid">SLOW</span>
                <span className="hcs-word solid">FIRE</span>
              </div>
            </div>
          </div>

          <div className="hcs-bottom container">
            <hr className="subtle-divider" />
            <div className="hcs-bottom-content">
              <span className="hcs-badge">EST. 2026 · PATNA</span>
              <Link href="/menu" className="btn hcs-btn">EXPLORE MENU</Link>
            </div>
          </div>
        </section>

        <section className="marquee marquee-one" aria-label="Announcement ticker">
          <div className="marquee-track reverse">
            <span>BIRIYANI STATION · TANDOORI KAWABS · DUM BIRYANI · GRAVIES & BREADS · PATNA · ORDER NOW ·</span>
            <span>BIRIYANI STATION · TANDOORI KAWABS · DUM BIRYANI · GRAVIES & BREADS · PATNA · ORDER NOW ·</span>
          </div>
        </section>

        <section className="about section-pad reveal" id="about">
          <div className="container about-grid">
            <div className="about-copy">
              <span className="about-eyebrow">THE PHILOSOPHY · CRAFT & FIRE</span>

              <h2 className="about-display">
                BIRYANI EK <br />
                <span className="gold-italic">IBADAT HAI</span> <br />
                <span className="green-italic">SHIDDAT HAI</span>
              </h2>

              <p className="about-lead">
                Biriyani Station started with one obsession — the perfect dum biryani and smoky clay-oven tandoori kawabs.
                Every piece marinated for 12 hours. Every spice measured by hand. Every pot sealed with dough and slow-cooked over live hardwood coals. We don't rush it. We never will.
              </p>

              <div className="about-pillars">
                <div className="about-pillar-card">
                  <span className="pillar-icon">🪵</span>
                  <div>
                    <strong>Slow Coal Dum</strong>
                    <p>Sealed in traditional heavy pots over live charcoal</p>
                  </div>
                </div>
                <div className="about-pillar-card">
                  <span className="pillar-icon">🔥</span>
                  <div>
                    <strong>Clay Tandoor</strong>
                    <p>Char-grilled at 500°C for intense smoky aroma</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="about-media-wrap">
              <div className="about-gallery-redesigned">
                <figure
                  className={`about-photo-card card-primary ${frontPhoto === 1 ? 'is-front' : 'is-back'}`}
                  onClick={() => setFrontPhoto(prev => prev === 1 ? 2 : 1)}
                >
                  <img src="/menu/Chicken tandoori kawab biryani.webp" alt="Tandoori Kawab Biryani" loading="lazy" decoding="async" />
                  <figcaption className="photo-card-caption">
                    <span className="caption-tag">SIGNATURE DUM</span>
                    <strong>Tandoori Kawab Biryani</strong>
                  </figcaption>
                </figure>

                <figure
                  className={`about-photo-card card-secondary ${frontPhoto === 2 ? 'is-front' : 'is-back'}`}
                  onClick={() => setFrontPhoto(prev => prev === 1 ? 2 : 1)}
                >
                  <img src="/menu/Chicken tandoori kawab.webp" alt="Clay Oven Tandoori Kawab" loading="lazy" decoding="async" />
                  <figcaption className="photo-card-caption">
                    <span className="caption-tag">CHAR-GRILLED</span>
                    <strong>Chicken Tandoori Kawab</strong>
                  </figcaption>
                </figure>
              </div>

              <div className="about-signature-badge">
                <span className="signature-sub">PATNA SPECIALITY</span>
                <a href="https://www.instagram.com/ibn_ishfaq" target="_blank" rel="noopener noreferrer" className="about-signature">
                  @ibn_ishfaq
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURED 6 BEST DISHES HOME MENU SECTION ──────────────── */}
        <section className="menu section-pad reveal" id="menu">
          <div className="container">
            <div className="menu-header-flex">
              <div className="menu-header-titles">
                <p className="section-label menu-label">CHEF'S SPECIAL SELECTION</p>
                <h2 className="display menu-title">FEATURED <span className="highlight-italic">SELECTION.</span></h2>
              </div>
              <div style={{ alignSelf: 'center' }}>
                <Link href="/menu" className="chip active" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                  VIEW FULL MENU →
                </Link>
              </div>
            </div>

            <div className="menu-grid premium-grid">
              {FEATURED_DISHES.slice(0, 8).map((dish) => (
                <article
                  key={dish.id}
                  className="menu-card"
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${dish.title} details`}
                  onClick={() => openProduct(dish)}
                >
                  <div className="dish-media">
                    <img src={dish.image} alt={dish.title} loading="lazy" decoding="async" />
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

            {/* Explore Full Menu CTA */}
            <div style={{ textAlign: 'center', marginTop: '48px' }}>
              <Link href="/menu" className="btn" style={{
                display: 'inline-flex',
                fontSize: '1rem',
                padding: '16px 36px',
                background: 'var(--deep-green)',
                color: '#fff',
                borderRadius: '999px',
                boxShadow: '0 8px 24px rgba(13,90,58,0.2)'
              }}>
                EXPLORE FULL MENU →
              </Link>
            </div>
          </div>
        </section>

        {/* ── CUSTOMER REVIEWS & RATINGS (AFTER FEATURED MENU) ───────── */}
        <section className="social-proof section-pad reveal" aria-label="Customer highlights">
          <div className="container">
            <div className="proof-header-center">
              <span className="proof-badge-pill">PATNA'S TOP RATED BIRYANI & KAWAB HOUSE</span>
              <h2 className="proof-headline-display">
                BUILT FOR REPEAT ORDERS.<br />
                <span className="gold-italic">MADE FOR MEMORY.</span>
              </h2>
              <p className="proof-headline-sub">
                A sharper spice balance, charcoal smoky clay-oven kawabs, and delivery that still feels like the kitchen packed it moments ago.
              </p>
            </div>

            <div className="proof-stats-row">
              <div className="proof-stat-card">
                <div className="stat-top">
                  <span className="stat-num">4.9</span>
                  <span className="stat-stars">⭐⭐⭐⭐⭐</span>
                </div>
                <strong>Spice Balance Rating</strong>
                <p>Loved for the smoky kawab aroma & authentic whole spices</p>
              </div>

              <div className="proof-stat-card highlight">
                <div className="stat-top">
                  <span className="stat-num">1.5K+</span>
                  <span className="stat-pill-tag">DAILY VOLUME</span>
                </div>
                <strong>Pots Cooked Daily</strong>
                <p>Served fresh across Patna with 82% repeat customer rate</p>
              </div>

              <div className="proof-stat-card">
                <div className="stat-top">
                  <span className="stat-num">25m</span>
                  <span className="stat-stars">🛵 FAST DELIVERY</span>
                </div>
                <strong>Average Delivery Time</strong>
                <p>Piping hot tandoori kawabs & biryanis delivered to your door</p>
              </div>
            </div>

            <div className="proof-reviews-grid">
              <article className="review-card">
                <div className="review-card-header">
                  <div className="review-avatar">AV</div>
                  <div>
                    <strong>Aman Verma</strong>
                    <span className="review-meta">Patna Foodie Guide · ⭐⭐⭐⭐⭐</span>
                  </div>
                </div>
                <p className="review-text">
                  “The Tandoori Kawab Biryani & Reshmi Kawabs are unmatched in Patna! Every single grain of rice is fragrant with ghee and star anise.”
                </p>
                <span className="review-dish-tag">Ordered: Tandoori Kawab Biryani</span>
              </article>

              <article className="review-card featured-review">
                <div className="review-card-header">
                  <div className="review-avatar gold">SZ</div>
                  <div>
                    <strong>Syed Zain</strong>
                    <span className="review-meta">Verified Order · ⭐⭐⭐⭐⭐</span>
                  </div>
                </div>
                <p className="review-text">
                  “Ordered 10 plates for a family dinner. The Chicken Dehati and Butter Naans arrived sizzling hot. Best clay-oven tandoori in Phulwari Shareef!”
                </p>
                <span className="review-dish-tag gold">Ordered: Chicken Dehati & Naan</span>
              </article>

              <article className="review-card">
                <div className="review-card-header">
                  <div className="review-avatar">RR</div>
                  <div>
                    <strong>Ritu Raj</strong>
                    <span className="review-meta">Zomato Reviewer · ⭐⭐⭐⭐⭐</span>
                  </div>
                </div>
                <p className="review-text">
                  “The smoky charcoal aroma in the Patyala Leg Kawab Biryani is authentic dum pukht perfection. Generous portions and incredible flavor!”
                </p>
                <span className="review-dish-tag">Ordered: Patyala Leg Biryani</span>
              </article>
            </div>
          </div>
        </section>

        <section className="marquee marquee-two" aria-label="Cuisine ticker">
          <div className="marquee-track">
            <span>TANDOORI KAWAB · KAWAB BIRYANI · BUTTER MASALA · DEHATI CHICKEN · FRESH TANDOORI NAAN ·</span>
            <span>TANDOORI KAWAB · KAWAB BIRYANI · BUTTER MASALA · DEHATI CHICKEN · FRESH TANDOORI NAAN ·</span>
          </div>
        </section>

        <section className="find-us-section reveal" id="order">
          <div className="find-us-ticker">
            <div className="find-us-ticker-track">
              <span>📍 ALBA COLONY , PHULWARI SHAREEF · PATNA · BIHAR · 📍 ALBA COLONY , PHULWARI SHAREEF · PATNA · BIHAR ·</span>
              <span>📍 ALBA COLONY , PHULWARI SHAREEF · PATNA · BIHAR · 📍 ALBA COLONY , PHULWARI SHAREEF · PATNA · BIHAR ·</span>
            </div>
          </div>

          <div className="find-us-hero">
            <p className="section-label" style={{ color: 'var(--yellow)' }}>FIND US</p>
            <h2 className="find-us-headline">
              DINE IN.<br />
              <em>OR BRING</em><br />
              THE FIRE HOME.
            </h2>
          </div>

          <div className="find-us-cards" id="contact">
            <article className="fuc-card fuc-dine stagger">
              <div className="fuc-number">01</div>
              <div className="fuc-content">
                <h3 className="fuc-title">DINE IN</h3>
                <div className="fuc-divider" />
                <p className="fuc-address">Alba Colony, Phulwari Shareef<br />Patna, Bihar</p>
                <p className="fuc-hours">🕐 Mon–Sun: 11:00 AM – 11:00 PM</p>
                <a href="https://maps.app.goo.gl/edZ9PRNyhbUr4Que6" target="_blank" rel="noreferrer" className="fuc-cta">GET DIRECTIONS →</a>
              </div>
              <div className="fuc-bg-text" aria-hidden="true">EAT</div>
            </article>

            <article className="fuc-card fuc-delivery stagger" style={{ transitionDelay: '0.2s' }}>
              <div className="fuc-number">02</div>
              <div className="fuc-content">
                <h3 className="fuc-title">DELIVERY</h3>
                <div className="fuc-divider" />
                <p className="fuc-address">Zomato · Swiggy<br />Direct WhatsApp Order</p>
                <p className="fuc-hours">🛵 Free over ₹499 · ~30 min avg</p>
                <a href="https://wa.me/919102985148" target="_blank" rel="noreferrer" className="fuc-cta">ORDER NOW →</a>
              </div>
              <div className="fuc-bg-text" aria-hidden="true">GO</div>
            </article>
          </div>

          <div className="find-us-note">
            <p className="contact-sub">For large orders & catering — <a href="mailto:hello@biriyanistation.in">hello@biriyanistation.in</a></p>
          </div>
        </section>
      </main>

      <button
        type="button"
        className={`cart-floater ${cartOpen || !showFloater ? 'is-hidden' : ''}`}
        onClick={() => setCartOpen(true)}
        aria-label={`Open cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}
      >
        <img src="/cart.webp" width="34" height="34" alt="Cart" loading="lazy" decoding="async" />
        {cartCount > 0 ? <span className="cart-floater-count">{cartCount}</span> : null}
      </button>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        cartTotal={cartTotal}
        updateCartQty={updateCartQty}
        removeFromCart={removeFromCart}
        onProceedToCheckout={handleProceedToCheckout}
      />

      {/* Product Detail Modal */}
      {selectedProduct ? (
        <div className="product-modal" aria-hidden="false">
          <button type="button" className="product-modal-backdrop" aria-label="Close product details" onClick={closeProduct} />
          <section className="product-modal-panel" role="dialog" aria-modal="true" aria-labelledby="productModalTitle">
            <button type="button" className="modal-close product-modal-close" aria-label="Close product details" onClick={closeProduct}>×</button>

            <div className="product-modal-visual">
              <div className="product-modal-ribbon">{selectedProduct.categoryName || 'Signature dish'}</div>
              <img src={selectedProduct.image} alt={selectedProduct.title} className="product-modal-image" />
              <div className="product-modal-glow" aria-hidden="true" />
            </div>

            <div className="product-modal-body">
              <p className="section-label">CHEF'S SPECIAL</p>
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
                <button type="button" className="btn" onClick={() => { addToCart({ title: selectedProduct.title, price: selectedProduct.price, image: selectedProduct.image }); closeProduct() }}>ADD TO CART</button>
                <button type="button" className="btn secondary" onClick={closeProduct}>CLOSE</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cartItems={cartItems}
        cartTotal={cartTotal}
        deliveryFee={deliveryFee}
        grandTotal={grandTotal}
        user={user}
        userProfile={userProfile}
        openAuthModal={openAuthModal}
        onPlaceOrder={handlePlaceOrder}
        coLoading={coLoading}
      />

      {/* Mobile Bottom Bar */}
      <MobileBottomBar activeTab="home" cartCount={cartCount} onOpenCart={() => setCartOpen(true)} />

      <footer className="footer-brutalist" role="contentinfo">
        <div className="marquee marquee-footer" aria-label="Order ticker">
          <div className="marquee-track">
            <span>HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • </span>
            <span>HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • </span>
          </div>
        </div>

        <div className="footer-massive-nav container">
          <nav className="massive-links">
            <Link href="/menu" data-text="MENU">MENU</Link>
            <a href="#about" data-text="ABOUT">ABOUT</a>
            <a href="#order" data-text="ORDER">ORDER</a>
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
              <a href="https://www.instagram.com/ibn_ishfaq" target="_blank" rel="noopener noreferrer" >INSTAGRAM</a>
              <a href="https://wa.me/919102985148" target="_blank" rel="noreferrer">WHATSAPP</a>
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
              <a href="https://www.instagram.com/ibn_ishfaq" target="_blank" rel="noopener noreferrer" >   Amanullah</a> </span>
            <span> with ❤️ </span></p>
        </div>
      </footer>

      {/* Toast Notification */}
      <ToastNotification toast={toast} />
    </>
  )
}
