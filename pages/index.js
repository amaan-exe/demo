import { useEffect, useState } from 'react'
import Head from 'next/head'

export default function Home() {
  const [cartItems, setCartItems] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Persist cart to localStorage so it survives reloads
  useEffect(() => {
    try {
      const raw = localStorage.getItem('biriyani_cart_v1')
      if (raw) setCartItems(JSON.parse(raw))
    } catch (e) {
      // ignore parse errors
      // console.warn('Failed to load cart from localStorage', e)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('biriyani_cart_v1', JSON.stringify(cartItems))
    } catch (e) {
      // ignore write errors (quota/privacy)
    }
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
    setCartOpen(true)
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

  const cartCount = cartItems.reduce((sum, entry) => sum + entry.qty, 0)
  const cartTotal = cartItems.reduce((sum, entry) => sum + (entry.price * entry.qty), 0)
  const deliveryFee = cartTotal > 0 ? 29 : 0
  const grandTotal = cartTotal + deliveryFee

  useEffect(() => {
    // This port of the original script keeps the UI interactions intact.
    const header = document.querySelector('.site-header')
    const navToggle = document.getElementById('navToggle')
    const navLinks = document.getElementById('navLinks')
    const onScroll = () => {
      if (window.scrollY > 32) header?.classList.add('scrolled')
      else header?.classList.remove('scrolled')
    }
    window.addEventListener('scroll', onScroll)
    onScroll()

    function setBodyScrollLocked(locked) {
      document.body.style.overflow = locked ? 'hidden' : ''
    }

    navToggle?.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true'
      const opening = !expanded
      navToggle.setAttribute('aria-expanded', String(opening))
      navLinks?.classList.toggle('open', opening)
      setBodyScrollLocked(opening)
    })

    navLinks?.querySelectorAll('a')?.forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open')
        navToggle.setAttribute('aria-expanded', 'false')
        setBodyScrollLocked(false)
      })
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks?.classList.contains('open')) {
        navLinks.classList.remove('open')
        navToggle.setAttribute('aria-expanded', 'false')
        setBodyScrollLocked(false)
      }
    })

    navLinks?.addEventListener('click', (e) => {
      if (e.target === navLinks) {
        navLinks.classList.remove('open')
        navToggle.setAttribute('aria-expanded', 'false')
        setBodyScrollLocked(false)
      }
    })

    const revealElements = document.querySelectorAll('.reveal')
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.2, rootMargin: '0px 0px -40px 0px' }
    )
    revealElements.forEach((el) => revealObserver.observe(el))

    // DOMContentLoaded style initialisation
    const words = document.querySelectorAll('.hero-title .word')
    words.forEach((w, i) => setTimeout(() => w.classList.add('pop'), 120 + i * 140))

    const plate = document.querySelector('.plate')
    if (plate) plate.classList.add('animate')

    const heroBtn = document.querySelector('#hero .btn')
    if (heroBtn) heroBtn.classList.add('pulse')

    document.querySelectorAll('.menu-card').forEach((card) => {
      const price = card.querySelector('.menu-head strong')
      const media = card.querySelector('.dish-media')
      if (price && media && !media.querySelector('.price-badge')) {
        const s = document.createElement('span')
        s.className = 'price-badge'
        s.textContent = price.textContent.trim()
        media.appendChild(s)
      }
    })

    const chips = document.querySelectorAll('.chip[data-filter]')
    const cards = document.querySelectorAll('.menu-card')
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'))
        chip.classList.add('active')
        const filter = chip.dataset.filter
        cards.forEach((card) => {
          const categories = (card.dataset.category || '').split(/\s+/)
          const show = filter === 'all' || categories.includes(filter)
          card.classList.toggle('is-hidden', !show)
        })
      })
    })

    const statNumbers = document.querySelectorAll('.stat-number[data-count]')
    const statObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const el = entry.target
        const target = Number(el.dataset.count || 0)
        const label = el.dataset.label || ''
        let current = 0
        const duration = 1100
        const step = Math.max(16, Math.round(duration / Math.max(target, 1)))
        const tick = () => {
          current += Math.max(1, Math.ceil(target / 24))
          if (current >= target) {
            el.textContent = `${target}${label}`
            observer.unobserve(el)
            return
          }
          el.textContent = `${current}${label}`
          window.setTimeout(tick, step)
        }
        tick()
      })
    }, { threshold: 0.4 })
    statNumbers.forEach((el) => statObserver.observe(el))

    const productCards = document.querySelectorAll('.menu-card')
    const productFromCard = (card) => ({
      title: card.dataset.title || '',
      priceLabel: card.dataset.price || '',
      price: Number((card.dataset.price || '').replace(/[^\d]/g, '')) || 0,
      category: card.dataset.category || '',
      tags: (card.dataset.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      spice: card.dataset.spice || '',
      time: card.dataset.time || '',
      portion: card.dataset.portion || '',
      description: card.dataset.description || '',
      image: card.dataset.image || card.querySelector('img')?.src || '',
    })

    const openCard = (event) => {
      const card = event.currentTarget
      if (!card) return
      openProduct(productFromCard(card))
    }

    const openCardFromKey = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openCard(event)
      }
    }

    productCards.forEach((card) => {
      card.addEventListener('click', openCard)
      card.addEventListener('keydown', openCardFromKey)
    })

    const onEscapeProduct = (event) => {
      if (event.key === 'Escape') closeProduct()
    }

    document.addEventListener('keydown', onEscapeProduct)

    // cleanup
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('keydown', onEscapeProduct)
      productCards.forEach((card) => {
        card.removeEventListener('click', openCard)
        card.removeEventListener('keydown', openCardFromKey)
      })
    }
    }, [])

  // Lock body scroll when cart or checkout is open
  useEffect(() => {
    if (cartOpen || checkoutOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [cartOpen, checkoutOpen, selectedProduct])

  return (
    <>
      <header className="site-header" id="top">
        <nav className="nav container" aria-label="Primary navigation">
          <a href="#top" className="logo" aria-label="Biriyani Express home">BIRIYANI <span>EXPRESS</span></a>

          <button className="nav-toggle" id="navToggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="navLinks">
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className="nav-right" id="navLinks">
            <a href="#menu">MENU</a>
            <a href="#about">ABOUT</a>
            <a href="#order">ORDER</a>
            <a href="#contact">CONTACT</a>
            <a href="https://wa.me/910000000000" target="_blank" rel="noopener noreferrer" className="btn cta" aria-label="Hacer pedido">HACER PEDIDO</a>
            <button type="button" className="btn cart-cta" onClick={() => setCartOpen((open) => !open)} aria-label={`Open cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}>
              CART {cartCount > 0 ? `(${cartCount})` : ''}
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero section-pad" id="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="meta">EST. 2024 · BHUBANESWAR</p>
              <h1 className="hero-title" aria-label="DUM PUKHT. SLOW FIRE.">
                <span className="line line-one">
                  <span className="word">DUM</span>
                  <span className="word">PUKHT.</span>
                </span>
                <span className="line line-two">
                  <span className="word">SLOW</span>
                  <span className="word">FIRE.</span>
                </span>
              </h1>
              <p className="hero-sub">Hyderabadi Biryani. Cooked the old way.</p>
              <div className="hero-actions">
                <a href="#order" className="btn">ORDER NOW</a>
                <span className="hero-badge">30 MIN AVG DELIVERY</span>
              </div>
            </div>

            <div className="hero-media">
              <div className="hero-plate plate" role="img" aria-label="Hyderabadi Biryani">
                <img src="/photo-1563379091339-03b21ab4a4f8.avif" alt="Hyderabadi Biryani" loading="eager" />
              </div>
            </div>

          </div>
        </section>

        <section className="marquee marquee-one" aria-label="Announcement ticker">
          <div className="marquee-track reverse">
            <span>BIRIYANI EXPRESS · DUM PUKHT · HYDERABADI · EST. 2024 · FREE DELIVERY · ORDER NOW ·</span>
            <span>BIRIYANI EXPRESS · DUM PUKHT · HYDERABADI · EST. 2024 · FREE DELIVERY · ORDER NOW ·</span>
          </div>
        </section>

        <section className="about section-pad reveal" id="about">
          <div className="container about-grid">
            <div className="about-copy">
              <p className="section-label">THE PHILOSOPHY</p>
              <h3 className="display">BIRYANI EK
<span>IBADAT HAI</span> <br/> <span>Shiddat hai</span></h3>
              <p className="about-lead">Biriyani Express started with one obsession — 
the perfect dum biryani. Every grain sealed. 
Every spice measured. Every pot slow-cooked 
the way it's been done for four hundred years. 
We don't rush it. We never will. Our speciality : <strong>Biriyani.</strong></p>
            </div>

            <div className="about-media-wrap">
              <div className="about-gallery">
                <figure className="about-photo">
                  <img src="/photo-1633945274309-2c16c9682a8c.avif" alt="Paput sign" loading="lazy" />
                </figure>
                <figure className="about-photo">
                  <img src="/photo-1631515243349-e0cb75fb8d3a.avif" alt="Paput terrace" loading="lazy" />
                </figure>
              </div>
              <a className="about-signature" href="https://instagram.com/_.amanullah" target="_blank" rel="noopener noreferrer">@_.amanullah</a>
            </div>
          </div>
        </section>

        <section className="social-proof section-pad reveal" aria-label="Customer highlights">
          <div className="container proof-shell">
            <div className="proof-intro">
              <p className="section-label">WHY PEOPLE RETURN</p>
              <div className="proof-mark">Since 2024</div>
              <h2 className="display proof-title">BUILT FOR REPEAT ORDERS. <span>MADE FOR MEMORY.</span></h2>
              <p className="proof-lead">A sharper spice balance, generous portions, and delivery that still feels like the kitchen packed it moments ago.</p>
              <div className="proof-pills" aria-label="Highlights">
                <span>Fresh daily</span>
                <span>Repeat favorites</span>
                <span>Clean spice profile</span>
              </div>
            </div>

            <div className="proof-stage">
              <div className="proof-orbit" aria-hidden="true"></div>
              <article className="proof-card proof-card-stat proof-card-tilt-left">
                <span className="proof-label">Spice balance</span>
                <p className="proof-rating">4.8/5</p>
                <p className="proof-copy">Loved for the aroma, portion size, and the clean spice balance.</p>
              </article>
              <article className="proof-card proof-card-stat proof-card-tilt-right">
                <span className="proof-label">Daily volume</span>
                <p className="proof-rating">1.2K+</p>
                <p className="proof-copy">Orders served across Bhubaneswar with repeat customers every day.</p>
              </article>
              <article className="proof-card quote-card">
                <span className="proof-label quote-label">What they say</span>
                <p className="proof-quote">“The closest thing to a proper dum pot I’ve had in the city.”</p>
                <p className="proof-author">Local foodie review</p>
              </article>
            </div>
          </div>
        </section>

        <section className="menu section-pad reveal" id="menu">
          <div className="container">
            <p className="section-label menu-label">OUR MENU</p>
            <h2 className="display menu-title">THE BIRYANI <span>BOARD.</span></h2>

            <div className="menu-chips" role="tablist" aria-label="Filter menu items">
              <button className="chip active" type="button" data-filter="all">All</button>
              <button className="chip" type="button" data-filter="chicken">Chicken</button>
              <button className="chip" type="button" data-filter="mutton">Mutton</button>
              <button className="chip" type="button" data-filter="veg">Veg</button>
              <button className="chip" type="button" data-filter="seafood">Seafood</button>
              <button className="chip" type="button" data-filter="bestseller">Bestseller</button>
            </div>

            <div className="menu-grid">
              <article className="menu-card" tabIndex={0} role="button" aria-label="Open Hyderabadi Chicken Dum Biryani details" data-title="Hyderabadi Chicken Dum Biryani" data-price="₹249" data-category="chicken bestseller" data-tags="Bestseller, Chicken, Signature" data-spice="Medium" data-time="25-30 min" data-portion="1-2 people" data-description="The original. Slow-cooked, sealed, and smoky." data-image="/photo-1633945274309-2c16c9682a8c.avif">
                <div className="dish-media">
                  <div className="price-badge">₹249</div>
                  <img src="/photo-1633945274309-2c16c9682a8c.avif" alt="Hyderabadi Chicken Dum Biryani" loading="lazy" />
                  <span>HYDERABADI CHICKEN</span>
                </div>
                <div className="menu-body">
                  <div className="menu-head"><h3>Hyderabadi Chicken Dum Biryani</h3><strong>₹249</strong></div>
                  <p>The original. Slow-cooked, sealed, and smoky.</p>
                  <div className="menu-actions">
                    <button type="button" className="add-to-cart" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Hyderabadi Chicken Dum Biryani', price: 249, image: '/photo-1633945274309-2c16c9682a8c.avif' }) }}>ORDER</button>
                  </div>
                </div>
              </article>

              <article className="menu-card" tabIndex={0} role="button" aria-label="Open Mutton Dum Biryani details" data-title="Mutton Dum Biryani" data-price="₹329" data-category="mutton bestseller" data-tags="Bestseller, Mutton, Slow Cooked" data-spice="High" data-time="35-40 min" data-portion="1-2 people" data-description="Tender cuts, whole spices, and 3 hours of patience." data-image="/photo-1631515243349-e0cb75fb8d3a.avif">
                <div className="dish-media">
                  <div className="price-badge">₹329</div>
                  <img src="/photo-1631515243349-e0cb75fb8d3a.avif" alt="Mutton Dum Biryani" loading="lazy" />
                  <span>MUTTON DUM</span>
                </div>
                <div className="menu-body">
                  <div className="menu-head"><h3>Mutton Dum Biryani</h3><strong>₹329</strong></div>
                  <p>Tender cuts, whole spices, and 3 hours of patience.</p>
                  <div className="menu-actions">
                    <button type="button" className="add-to-cart" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Mutton Dum Biryani', price: 329, image: '/photo-1631515243349-e0cb75fb8d3a.avif' }) }}>ORDER</button>
                  </div>
                </div>
              </article>

              <article className="menu-card" tabIndex={0} role="button" aria-label="Open Egg Biryani details" data-title="Egg Biryani" data-price="₹179" data-category="veg bestseller" data-tags="Bestseller, Quick Pick" data-spice="Low" data-time="20-25 min" data-portion="1 person" data-description="Perfectly spiced basmati with golden fried eggs." data-image="/photo-1599043513900-ed6fe01d3833.avif">
                <div className="dish-media">
                  <div className="price-badge">₹179</div>
                  <img src="/photo-1599043513900-ed6fe01d3833.avif" alt="Egg Biryani" loading="lazy" />
                  <span>EGG BIRYANI</span>
                </div>
                <div className="menu-body">
                  <div className="menu-head"><h3>Egg Biryani</h3><strong>₹179</strong></div>
                  <p>Perfectly spiced basmati with golden fried eggs.</p>
                  <div className="menu-actions">
                    <button type="button" className="add-to-cart" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Egg Biryani', price: 179, image: '/photo-1599043513900-ed6fe01d3833.avif' }) }}>ORDER</button>
                  </div>
                </div>
              </article>
              
                <article className="menu-card" tabIndex={0} role="button" aria-label="Open Paneer Biryani details" data-title="Paneer Biryani" data-price="₹199" data-category="veg" data-tags="Vegetarian, Mild" data-spice="Low" data-time="20-25 min" data-portion="1 person" data-description="Smoky cottage cheese layered into fragrant rice." data-image="/photo-1596797038530-2c107229654b.avif">
                  <div className="dish-media">
                    <div className="price-badge">₹199</div>
                    <img src="/photo-1596797038530-2c107229654b.avif" alt="Paneer Biryani" loading="lazy" />
                    <span>PANEER BIRYANI</span>
                  </div>
                  <div className="menu-body">
                    <div className="menu-head"><h3>Paneer Biryani</h3><strong>₹199</strong></div>
                    <p>Smoky cottage cheese layered into fragrant rice.</p>
                    <div className="menu-actions">
                      <button type="button" className="add-to-cart" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Paneer Biryani', price: 199, image: '/photo-1596797038530-2c107229654b.avif' }) }}>ORDER</button>
                    </div>
                  </div>
                </article>

                <article className="menu-card" tabIndex={0} role="button" aria-label="Open Prawn Biryani details" data-title="Prawn Biryani" data-price="₹369" data-category="seafood bestseller" data-tags="Seafood, Bestseller, Coastal" data-spice="Medium" data-time="30-35 min" data-portion="1-2 people" data-description="Coastal-style, coconut-kissed, heat-packed." data-image="/photo-1589302168068-964664d93dc0.avif">
                  <div className="dish-media">
                    <div className="price-badge">₹369</div>
                    <img src="/photo-1589302168068-964664d93dc0.avif" alt="Prawn Biryani" loading="lazy" />
                    <span>PRAWN BIRYANI</span>
                  </div>
                  <div className="menu-body">
                    <div className="menu-head"><h3>Prawn Biryani</h3><strong>₹369</strong></div>
                    <p>Coastal-style, coconut-kissed, heat-packed.</p>
                    <div className="menu-actions">
                      <button type="button" className="add-to-cart" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Prawn Biryani', price: 369, image: '/photo-1589302168068-964664d93dc0.avif' }) }}>ORDER</button>
                    </div>
                  </div>
                </article>

                <article className="menu-card" tabIndex={0} role="button" aria-label="Open Veg Dum Biryani details" data-title="Veg Dum Biryani" data-price="₹169" data-category="veg" data-tags="Vegetarian, Light" data-spice="Low" data-time="18-22 min" data-portion="1 person" data-description="Seasonal vegetables, saffron, and kewra water." data-image="/photo-1563379091339-03b21ab4a4f8.avif">
                  <div className="dish-media">
                    <div className="price-badge">₹169</div>
                    <img src="/photo-1563379091339-03b21ab4a4f8.avif" alt="Veg Dum Biryani" loading="lazy" />
                    <span>VEG DUM BIRYANI</span>
                  </div>
                  <div className="menu-body">
                    <div className="menu-head"><h3>Veg Dum Biryani</h3><strong>₹169</strong></div>
                    <p>Seasonal vegetables, saffron, and kewra water.</p>
                    <div className="menu-actions">
                      <button type="button" className="add-to-cart" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Veg Dum Biryani', price: 169, image: '/photo-1563379091339-03b21ab4a4f8.avif' }) }}>ORDER</button>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section className="marquee marquee-two" aria-label="Cuisine ticker">
            <div className="marquee-track">
              <span>HYDERABADI · LUCKNOWI · KOLKATA STYLE · FRESH DAILY · NO COMPROMISE · BIRIYANI EXPRESS ·</span>
              <span>HYDERABADI · LUCKNOWI · KOLKATA STYLE · FRESH DAILY · NO COMPROMISE · BIRIYANI EXPRESS ·</span>
            </div>
          </section>

          

          <section className="order section-pad reveal" id="order">
            <div className="container">
              <p className="section-label">FIND US</p>
              <h2 className="display">DINE IN. OR <span>BRING THE FIRE HOME.</span></h2>

              <div className="order-grid" id="contact">
                <article className="order-card">
                  <div className="order-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M7 2v7M11 2v7M5 10c0 2 1.5 3 4 3s4-1 4-3V2" stroke="var(--deep-green)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h3 className="order-heading">DINE IN</h3>
                  <div className="order-sub">Plot 42, Saheed Nagar, Bhubaneswar</div>
                  <div className="order-hours">Mon–Sun: 11:00 AM – 11:00 PM</div>
                </article>

                <article className="order-card">
                  <div className="order-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M3 13h6l3-6h6v6" stroke="var(--deep-green)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="7" cy="18" r="1.6" stroke="var(--deep-green)" strokeWidth="1.6"/>
                      <circle cx="18" cy="18" r="1.6" stroke="var(--deep-green)" strokeWidth="1.6"/>
                    </svg>
                  </div>
                  <h3 className="order-heading">DELIVERY / TAKEAWAY</h3>
                  <div className="order-sub">Zomato · Swiggy · Direct Order</div>
                  <div className="order-hours">Free over ₹499 · 30 min avg</div>
                </article>

                <div className="order-note">Home delivery across the city. For large orders or catering, contact us at <a href="mailto:hola@example.com">hola@example.com</a>.</div>
              </div>
            </div>
          </section>

        </main>

        <aside className={`cart-drawer ${cartOpen ? 'open' : ''}`} aria-label="Shopping cart" aria-hidden={cartOpen ? 'false' : 'true'}>
          <div className="cart-drawer-header">
            <div>
              <p className="section-label">YOUR CART</p>
              <h2>Fresh from the pot</h2>
            </div>
            <button type="button" className="cart-close" aria-label="Close cart" onClick={() => setCartOpen(false)}>×</button>
          </div>

          <div className="cart-drawer-body">
            {cartItems.length === 0 ? (
              <p className="cart-empty">Your cart is empty. Add a biryani to get started.</p>
            ) : (
              cartItems.map((item) => (
                <article className="cart-item" key={item.title}>
                  <img src={item.image} alt={item.title} />
                  <div className="cart-item-copy">
                    <h3>{item.title}</h3>
                    <p>₹{item.price.toFixed(0)} each</p>
                    <div className="cart-item-controls">
                      <button type="button" onClick={() => updateCartQty(item.title, -1)} aria-label={`Decrease ${item.title}`}>−</button>
                      <strong>{item.qty}</strong>
                      <button type="button" onClick={() => updateCartQty(item.title, 1)} aria-label={`Increase ${item.title}`}>+</button>
                      <button type="button" className="remove-link" onClick={() => removeFromCart(item.title)}>Remove</button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="cart-drawer-footer">
            <div className="cart-summary">
              <span>Subtotal</span>
              <strong>₹{cartTotal.toFixed(0)}</strong>
            </div>
            <button type="button" className="btn cart-checkout" onClick={() => setCheckoutOpen(true)} disabled={cartItems.length === 0}>CHECKOUT</button>
          </div>
        </aside>

        {cartOpen ? <button type="button" className="cart-backdrop" aria-label="Close cart overlay" onClick={() => setCartOpen(false)} /> : null}

        {selectedProduct ? (
          <div className="product-modal" aria-hidden="false">
            <button type="button" className="product-modal-backdrop" aria-label="Close product details" onClick={closeProduct} />
            <section className="product-modal-panel" role="dialog" aria-modal="true" aria-labelledby="productModalTitle">
              <button type="button" className="modal-close product-modal-close" aria-label="Close product details" onClick={closeProduct}>×</button>

              <div className="product-modal-visual">
                <div className="product-modal-ribbon">Signature dish</div>
                <img src={selectedProduct.image} alt={selectedProduct.title} className="product-modal-image" />
                <div className="product-modal-glow" aria-hidden="true" />
              </div>

              <div className="product-modal-body">
                <p className="section-label">SIGNATURE DISH</p>
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

                <div className="product-modal-note">
                  <span className="product-modal-note-label">Why it stands out</span>
                  <p>{selectedProduct.category.includes('bestseller') ? 'The crowd favorite — the one people order again before finishing the first box.' : 'Balanced, comforting, and plated with the kind of care that makes it feel special.'}</p>
                </div>

                <div className="product-modal-actions">
                  <button type="button" className="btn" onClick={() => { addToCart({ title: selectedProduct.title, price: selectedProduct.price, image: selectedProduct.image }); closeProduct() }}>ADD TO CART</button>
                  <button type="button" className="btn secondary" onClick={closeProduct}>CLOSE</button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <div className="checkout-modal" aria-hidden={checkoutOpen ? 'false' : 'true'}>
          <button type="button" className="checkout-modal-backdrop" aria-label="Close checkout overlay" onClick={() => setCheckoutOpen(false)} />
          <section className="checkout-panel" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
            <button type="button" className="modal-close" aria-label="Close checkout" onClick={() => setCheckoutOpen(false)}>×</button>
            <p className="section-label">CHECKOUT</p>
            <h2 id="checkoutTitle">Complete your order</h2>
            <div className="checkout-grid">
              <div className="checkout-section">
                <h3>Order Summary</h3>
                {cartItems.length === 0 ? (
                  <p className="cart-empty">Add items to your cart before checking out.</p>
                ) : (
                  cartItems.map((item) => (
                    <div className="checkout-line" key={item.title}>
                      <span>{item.title} x{item.qty}</span>
                      <strong>₹{(item.price * item.qty).toFixed(0)}</strong>
                    </div>
                  ))
                )}
              </div>

              <div className="checkout-summary-card">
                <h3>Delivery Details</h3>
                <form className="checkout-form">
                  <input type="text" placeholder="Your name" aria-label="Your name" />
                  <input type="tel" placeholder="Phone number" aria-label="Phone number" />
                  <textarea placeholder="Delivery address or notes" aria-label="Delivery address or notes" />
                </form>
                <div className="checkout-line">
                  <span>Subtotal</span>
                  <strong>₹{cartTotal.toFixed(0)}</strong>
                </div>
                <div className="checkout-line">
                  <span>Delivery</span>
                  <strong>{deliveryFee > 0 ? `₹${deliveryFee}` : 'Free'}</strong>
                </div>
                <div className="checkout-line">
                  <span>Total</span>
                  <strong>₹{grandTotal.toFixed(0)}</strong>
                </div>
                <div className="checkout-actions">
                  <a href="https://wa.me/910000000000" className="btn" target="_blank" rel="noreferrer">ORDER ON WHATSAPP</a>
                  <button type="button" className="btn secondary" onClick={() => setCheckoutOpen(false)}>DONE</button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="site-footer" role="contentinfo">
          <div className="footer-top container">
            <div className="footer-left footer-column">
              <a href="#top" className="logo">BIRIYANI <span>EXPRESS</span></a>
              <p>Slow-cooked dum biryani with a sharper, cleaner ordering flow.</p>

              <div className="socials" aria-label="Social links">
                <a href="#" aria-label="Instagram" title="Instagram">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" />
                  </svg>
                </a>
                <a href="#" aria-label="WhatsApp" title="WhatsApp">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M21 11.5A9.5 9.5 0 1 0 11.5 21L7 22l1.2-4.6A9.5 9.5 0 0 0 21 11.5z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15.5 14.2c-.4-.2-1-.3-1.6-.1-.3.1-.6.1-.9-.2-.6-.5-1.6-1.6-1.7-1.7-.2-.3-.2-.6-.1-.9.2-.6.1-1.2-.1-1.6-.2-.4-.6-.7-1-.7-.2 0-.4 0-.6.1-.6.2-1.3.9-1.5 1.5-.2.6 0 1.3.5 2.1.8 1 1.9 2.1 3.5 3 .9.4 1.6.6 2.1.5.6-.1 1.3-.6 1.5-1.1.2-.4.1-.8-.1-1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a href="#" aria-label="Delivery" title="Delivery">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M3 13h6l3-6h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="7" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="18" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </a>
                <a href="#" aria-label="TikTok" title="TikTok">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M17 8v6a3 3 0 0 1-3-3V8h3z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 12a4 4 0 0 0 4 4h0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 4v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </div>

            <nav className="footer-center footer-column" aria-label="Footer navigation">
              <ul className="footer-nav-list">
                <li><a href="#order">PLACE ORDER</a></li>
                <li><a href="#order">LARGE ORDERS</a></li>
                <li><a href="#order">DELIVERY</a></li>
                <li><a href="#menu">STORE</a></li>
                <li><a href="#events">EVENTS</a></li>
              </ul>
            </nav>

            <div className="footer-right footer-column">
              <span className="footer-kicker">CONTACT</span>
              <div className="footer-meta">
                <p>West platform S/N, Port of Mahón, Menorca</p>
                <p><a href="mailto:hello@paputmenorca.com">hello@paputmenorca.com</a></p>
              </div>

              <div className="legal-links footer-legal">
                <a href="#">COOKIES</a>
                <a href="#">PRIVACY POLICY</a>
                <a href="#">ALL LEGAL</a>
              </div>
            </div>
          </div>

          <div className="footer-bottom container">
            <p>© 2024 Biriyani Express · Bhubaneswar, Odisha</p>
            <p>MADE WITH FIRE 🔥</p>
          </div>
        </footer>
      </>
    )
  }

