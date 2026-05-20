import { useEffect, useState } from 'react'
import Head from 'next/head'

export default function Home() {
  const [cartItems, setCartItems] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [frontPhoto, setFrontPhoto] = useState(2)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [toast, setToast] = useState(null)

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
    
    // Show premium toast
    setToast({
      title: item.title,
      image: item.image,
      id: Date.now()
    })
    
    // Auto-hide toast
    setTimeout(() => {
      setToast((currentToast) => {
        if (currentToast && currentToast.id === item.id) return null
        return null // Hide any toast after 3s (could be improved, but works nicely)
      })
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

  const cartCount = cartItems.reduce((sum, entry) => sum + entry.qty, 0)
  const cartTotal = cartItems.reduce((sum, entry) => sum + (entry.price * entry.qty), 0)
  const deliveryFee = cartTotal > 0 ? 40 : 0
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

    const plate = document.querySelector('#heroPlate')
    if (plate) {
      plate.classList.add('served')
      window.addEventListener('scroll', () => {
        const scrollY = window.scrollY
        const rotateX = Math.max(-45, Math.min(scrollY * 0.15, 60))
        const rotateZ = scrollY * 0.05
        const scale = 1 + (scrollY * 0.0005)
        plate.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale(${scale})`
      })
    }

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

          <button className="nav-toggle" id="navToggle" aria-label="Toggle navigation" aria-expanded={isNavOpen} aria-controls="navLinks" onClick={() => setIsNavOpen(!isNavOpen)}>
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className={`nav-right ${isNavOpen ? 'open' : ''}`} id="navLinks">
            <a href="#menu" onClick={() => setIsNavOpen(false)}>MENU</a>
            <a href="#about" onClick={() => setIsNavOpen(false)}>ABOUT</a>
            <a href="#order" onClick={() => setIsNavOpen(false)}>ORDER</a>
            <a href="#contact" onClick={() => setIsNavOpen(false)}>CONTACT</a>
            <a href="https://wa.me/918271301179" target="_blank" rel="noopener noreferrer" className="btn cta" aria-label="Hacer pedido" onClick={() => setIsNavOpen(false)}>Order on Whatsapp</a>
            <button type="button" className="btn cart-cta" onClick={() => setCartOpen((open) => !open)} aria-label={`Open cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}>
              CART {cartCount > 0 ? `(${cartCount})` : ''}
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero-clean-split" id="hero">
          <div className="hcs-inner">
            <div className="hcs-left">
              <span className="hcs-word outline pop">Zaiqa</span>
              <span className="hcs-word outline pop">Lazeez</span>
            </div>

            <div className="hcs-center">
              <p className="hcs-sub">ORDER NOW.<br/>EAT NOW.</p>
            </div>

            <div className="hcs-right">
              <span className="hcs-word solid pop">SLOW</span>
              <span className="hcs-word solid pop">FIRE</span>
            </div>
          </div>

          <div className="hcs-bottom container">
            <hr className="subtle-divider" />
            <div className="hcs-bottom-content">
              <span className="hcs-badge">EST. 2026 · PATNA</span>
              <a href="#order" className="btn">ORDER NOW</a>
            </div>
          </div>
        </section>

        <section className="marquee marquee-one" aria-label="Announcement ticker">
          <div className="marquee-track reverse">
            <span>BIRIYANI EXPRESS · DUM PUKHT · HYDERABADI · EST. 2026 · FREE DELIVERY · ORDER NOW ·</span>
            <span>BIRIYANI EXPRESS · DUM PUKHT · HYDERABADI · EST. 2026 · FREE DELIVERY · ORDER NOW ·</span>
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
                <figure className={`about-photo ${frontPhoto === 1 ? 'front' : 'back'}`} onClick={(e) => { e.stopPropagation(); setFrontPhoto(prev => prev === 1 ? 2 : 1); }} style={{cursor: 'pointer'}}>
                  <img src="/photo-1633945274309-2c16c9682a8c.avif" alt="Paput sign" loading="lazy" style={{pointerEvents: 'none'}} />
                </figure>
                <figure className={`about-photo ${frontPhoto === 2 ? 'front' : 'back'}`} onClick={(e) => { e.stopPropagation(); setFrontPhoto(prev => prev === 1 ? 2 : 1); }} style={{cursor: 'pointer'}}>
                  <img src="/photo-1631515243349-e0cb75fb8d3a.avif" alt="Paput terrace" loading="lazy" style={{pointerEvents: 'none'}} />
                </figure>
              </div>
              <a className="about-signature" href="https://instagram.com/_.hussain29" target="_blank" rel="noopener noreferrer">@_.hussain29</a>
            </div>
          </div>
        </section>

        <section className="social-proof section-pad reveal" aria-label="Customer highlights">
          <div className="container proof-shell">
            <div className="proof-intro">
              <div className="proof-intro-header">
                <p className="section-label">WHY PEOPLE RETURN</p>
                <div className="proof-mark">EST. 2026</div>
              </div>
              <h2 className="proof-title">BUILT FOR REPEAT ORDERS.<br/><span className="highlight-italic">MADE FOR MEMORY.</span></h2>
              <p className="proof-lead">A sharper spice balance, generous portions, and delivery that still feels like the kitchen packed it moments ago.</p>
              <div className="proof-pills" aria-label="Highlights">
                <span className="pill interactive"><span className="dot fresh"></span>Fresh daily</span>
                <span className="pill interactive"><span className="dot repeat"></span>Repeat favorites</span>
                <span className="pill interactive"><span className="dot clean"></span>Clean spice profile</span>
              </div>
            </div>

            <div className="proof-stage premium">
              <div className="proof-bg-glow"></div>
              <div className="proof-bg-grid"></div>
              
              <article className="premium-card premium-card-left float-anim">
                <div className="premium-card-glass"></div>
                <div className="premium-card-content">
                  <span className="premium-badge">Spice balance</span>
                  <p className="premium-rating">4.8<span className="out-of">/5</span></p>
                  <p className="premium-copy">Loved for the aroma, portion size, and the clean spice balance.</p>
                </div>
              </article>

              <article className="premium-card premium-card-right float-anim-alt">
                <div className="premium-card-glass"></div>
                <div className="premium-card-content">
                  <span className="premium-badge">Daily volume</span>
                  <p className="premium-rating">1.2K<span className="plus">+</span></p>
                  <p className="premium-copy">Orders served across Bhubaneswar with repeat customers every day.</p>
                </div>
              </article>

              <article className="premium-quote-card hover-lift">
                <div className="quote-icon">"</div>
                <div className="quote-content">
                  <span className="quote-badge">What they say</span>
                  <p className="quote-text">“The closest thing to a proper dum pot I’ve had in the city.”</p>
                  <div className="quote-footer">
                    <div className="quote-avatar"></div>
                    <p className="quote-author">Local foodie review</p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

         <section className="menu section-pad reveal" id="menu">
          <div className="container">
            <div className="menu-header-flex">
              <div className="menu-header-titles">
                <p className="section-label menu-label">OUR MENU</p>
                <h2 className="display menu-title">THE BIRYANI <span className="highlight-italic">BOARD.</span></h2>
              </div>
              <div className="menu-chips" role="tablist" aria-label="Filter menu items">
                <button className="chip active" type="button" data-filter="all">All</button>
                <button className="chip" type="button" data-filter="chicken">Chicken</button>
                <button className="chip" type="button" data-filter="mutton">Mutton</button>
                <button className="chip" type="button" data-filter="veg">Veg</button>
                <button className="chip" type="button" data-filter="seafood">Seafood</button>
                <button className="chip" type="button" data-filter="bestseller">Bestseller</button>
              </div>
            </div>

            <div className="menu-grid premium-grid">
              <article className="menu-card" tabIndex={0} role="button" aria-label="Open Hyderabadi Chicken Dum Biryani details" onClick={() => openProduct({ title: 'Hyderabadi Chicken Dum Biryani', priceLabel: '₹249', price: 249, category: 'chicken bestseller', tags: ['Bestseller', 'Chicken', 'Signature'], spice: 'Medium', time: '25-30 min', portion: '1-2 people', description: 'The original. Slow-cooked, sealed, and smoky.', image: '/photo-1633945274309-2c16c9682a8c.avif' })} data-title="Hyderabadi Chicken Dum Biryani" data-price="₹249" data-category="chicken bestseller" data-tags="Bestseller, Chicken, Signature" data-spice="Medium" data-time="25-30 min" data-portion="1-2 people" data-description="The original. Slow-cooked, sealed, and smoky." data-image="/photo-1633945274309-2c16c9682a8c.avif">
                <div className="dish-media">
                  <img src="/photo-1633945274309-2c16c9682a8c.avif" alt="Hyderabadi Chicken Dum Biryani" loading="lazy" />
                  <span className="dish-tag">HYDERABADI CHICKEN</span>
                  <div className="dish-overlay"></div>
                </div>
                <div className="menu-body">
                  <div className="menu-head">
                    <h3 className="dish-title">HYDERABADI CHICKEN DUM BIRYANI</h3>
                    <strong className="dish-price">₹249</strong>
                  </div>
                  <p className="dish-desc">The original. Slow-cooked, sealed, and smoky.</p>
                  <div className="menu-actions">
                    <button type="button" className="btn-order" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Hyderabadi Chicken Dum Biryani', price: 249, image: '/photo-1633945274309-2c16c9682a8c.avif' }) }}>ADD TO CART</button>
                  </div>
                </div>
              </article>

              <article className="menu-card" tabIndex={0} role="button" aria-label="Open Mutton Dum Biryani details" onClick={() => openProduct({ title: 'Mutton Dum Biryani', priceLabel: '₹329', price: 329, category: 'mutton bestseller', tags: ['Bestseller', 'Mutton', 'Slow Cooked'], spice: 'High', time: '35-40 min', portion: '1-2 people', description: 'Tender cuts, whole spices, and 3 hours of patience.', image: '/photo-1631515243349-e0cb75fb8d3a.avif' })} data-title="Mutton Dum Biryani" data-price="₹329" data-category="mutton bestseller" data-tags="Bestseller, Mutton, Slow Cooked" data-spice="High" data-time="35-40 min" data-portion="1-2 people" data-description="Tender cuts, whole spices, and 3 hours of patience." data-image="/photo-1631515243349-e0cb75fb8d3a.avif">
                <div className="dish-media">
                  <img src="/photo-1631515243349-e0cb75fb8d3a.avif" alt="Mutton Dum Biryani" loading="lazy" />
                  <span className="dish-tag">MUTTON DUM</span>
                  <div className="dish-overlay"></div>
                </div>
                <div className="menu-body">
                  <div className="menu-head">
                    <h3 className="dish-title">MUTTON DUM BIRYANI</h3>
                    <strong className="dish-price">₹329</strong>
                  </div>
                  <p className="dish-desc">Tender cuts, whole spices, and 3 hours of patience.</p>
                  <div className="menu-actions">
                    <button type="button" className="btn-order" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Mutton Dum Biryani', price: 329, image: '/photo-1631515243349-e0cb75fb8d3a.avif' }) }}>ADD TO CART</button>
                  </div>
                </div>
              </article>

              <article className="menu-card" tabIndex={0} role="button" aria-label="Open Egg Biryani details" onClick={() => openProduct({ title: 'Egg Biryani', priceLabel: '₹179', price: 179, category: 'veg bestseller', tags: ['Bestseller', 'Quick Pick'], spice: 'Low', time: '20-25 min', portion: '1 person', description: 'Perfectly spiced basmati with golden fried eggs.', image: '/photo-1599043513900-ed6fe01d3833.avif' })} data-title="Egg Biryani" data-price="₹179" data-category="veg bestseller" data-tags="Bestseller, Quick Pick" data-spice="Low" data-time="20-25 min" data-portion="1 person" data-description="Perfectly spiced basmati with golden fried eggs." data-image="/photo-1599043513900-ed6fe01d3833.avif">
                <div className="dish-media">
                  <img src="/photo-1599043513900-ed6fe01d3833.avif" alt="Egg Biryani" loading="lazy" />
                  <span className="dish-tag">EGG BIRYANI</span>
                  <div className="dish-overlay"></div>
                </div>
                <div className="menu-body">
                  <div className="menu-head">
                    <h3 className="dish-title">EGG BIRYANI</h3>
                    <strong className="dish-price">₹179</strong>
                  </div>
                  <p className="dish-desc">Perfectly spiced basmati with golden fried eggs.</p>
                  <div className="menu-actions">
                    <button type="button" className="btn-order" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Egg Biryani', price: 179, image: '/photo-1599043513900-ed6fe01d3833.avif' }) }}>ADD TO CART</button>
                  </div>
                </div>
              </article>
              
              <article className="menu-card" tabIndex={0} role="button" aria-label="Open Paneer Biryani details" onClick={() => openProduct({ title: 'Paneer Biryani', priceLabel: '₹199', price: 199, category: 'veg', tags: ['Vegetarian', 'Mild'], spice: 'Low', time: '20-25 min', portion: '1 person', description: 'Smoky cottage cheese layered into fragrant rice.', image: '/photo-1596797038530-2c107229654b.avif' })} data-title="Paneer Biryani" data-price="₹199" data-category="veg" data-tags="Vegetarian, Mild" data-spice="Low" data-time="20-25 min" data-portion="1 person" data-description="Smoky cottage cheese layered into fragrant rice." data-image="/photo-1596797038530-2c107229654b.avif">
                <div className="dish-media">
                  <img src="/photo-1596797038530-2c107229654b.avif" alt="Paneer Biryani" loading="lazy" />
                  <span className="dish-tag">PANEER BIRYANI</span>
                  <div className="dish-overlay"></div>
                </div>
                <div className="menu-body">
                  <div className="menu-head">
                    <h3 className="dish-title">PANEER BIRYANI</h3>
                    <strong className="dish-price">₹199</strong>
                  </div>
                  <p className="dish-desc">Smoky cottage cheese layered into fragrant rice.</p>
                  <div className="menu-actions">
                    <button type="button" className="btn-order" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Paneer Biryani', price: 199, image: '/photo-1596797038530-2c107229654b.avif' }) }}>ADD TO CART</button>
                  </div>
                </div>
              </article>

              <article className="menu-card" tabIndex={0} role="button" aria-label="Open Prawn Biryani details" onClick={() => openProduct({ title: 'Prawn Biryani', priceLabel: '₹369', price: 369, category: 'seafood bestseller', tags: ['Seafood', 'Bestseller', 'Coastal'], spice: 'Medium', time: '30-35 min', portion: '1-2 people', description: 'Coastal-style, coconut-kissed, heat-packed.', image: '/photo-1589302168068-964664d93dc0.avif' })} data-title="Prawn Biryani" data-price="₹369" data-category="seafood bestseller" data-tags="Seafood, Bestseller, Coastal" data-spice="Medium" data-time="30-35 min" data-portion="1-2 people" data-description="Coastal-style, coconut-kissed, heat-packed." data-image="/photo-1589302168068-964664d93dc0.avif">
                <div className="dish-media">
                  <img src="/photo-1589302168068-964664d93dc0.avif" alt="Prawn Biryani" loading="lazy" />
                  <span className="dish-tag">PRAWN BIRYANI</span>
                  <div className="dish-overlay"></div>
                </div>
                <div className="menu-body">
                  <div className="menu-head">
                    <h3 className="dish-title">PRAWN BIRYANI</h3>
                    <strong className="dish-price">₹369</strong>
                  </div>
                  <p className="dish-desc">Coastal-style, coconut-kissed, heat-packed.</p>
                  <div className="menu-actions">
                    <button type="button" className="btn-order" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Prawn Biryani', price: 369, image: '/photo-1589302168068-964664d93dc0.avif' }) }}>ADD TO CART</button>
                  </div>
                </div>
              </article>

              <article className="menu-card" tabIndex={0} role="button" aria-label="Open Veg Dum Biryani details" onClick={() => openProduct({ title: 'Veg Dum Biryani', priceLabel: '₹169', price: 169, category: 'veg', tags: ['Vegetarian', 'Light'], spice: 'Low', time: '18-22 min', portion: '1 person', description: 'Seasonal vegetables, saffron, and kewra water.', image: '/photo-1563379091339-03b21ab4a4f8.avif' })} data-title="Veg Dum Biryani" data-price="₹169" data-category="veg" data-tags="Vegetarian, Light" data-spice="Low" data-time="18-22 min" data-portion="1 person" data-description="Seasonal vegetables, saffron, and kewra water." data-image="/photo-1563379091339-03b21ab4a4f8.avif">
                <div className="dish-media">
                  <img src="/photo-1563379091339-03b21ab4a4f8.avif" alt="Veg Dum Biryani" loading="lazy" />
                  <span className="dish-tag">VEG DUM BIRYANI</span>
                  <div className="dish-overlay"></div>
                </div>
                <div className="menu-body">
                  <div className="menu-head">
                    <h3 className="dish-title">VEG DUM BIRYANI</h3>
                    <strong className="dish-price">₹169</strong>
                  </div>
                  <p className="dish-desc">Seasonal vegetables, saffron, and kewra water.</p>
                  <div className="menu-actions">
                    <button type="button" className="btn-order" onClick={(event) => { event.stopPropagation(); addToCart({ title: 'Veg Dum Biryani', price: 169, image: '/photo-1563379091339-03b21ab4a4f8.avif' }) }}>ADD TO CART</button>
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

          

          <section className="find-us-section reveal" id="order">
            {/* Top strip — scrolling location tag */}
            <div className="find-us-ticker">
              <div className="find-us-ticker-track">
                <span>📍 ALBA COLONY , PHULWARI SHAREEF · PATNA · BIHAR · 📍 ALBA COLONY , PHULWARI SHAREEF · PATNA · BIHAR ·📍 ALBA COLONY , PHULWARI SHAREEF · PATNA · BIHAR · </span>
                <span>📍 ALBA COLONY , PHULWARI SHAREEF · PATNA · BIHAR ·📍 ALBA COLONY , PHULWARI SHAREEF · PATNA · BIHAR ·📍 ALBA COLONY , PHULWARI SHAREEF · PATNA · BIHAR ·</span>
              </div>
            </div>

            {/* Big headline */}
            <div className="find-us-hero">
              <p className="section-label" style={{color: 'var(--yellow)'}}>FIND US</p>
              <h2 className="find-us-headline">
                DINE IN.<br/>
                <em>OR BRING</em><br/>
                THE FIRE HOME.
              </h2>
            </div>

            {/* Two big cards */}
            <div className="find-us-cards" id="contact">

              {/* Dine In */}
              <article className="fuc-card fuc-dine stagger">
                <div className="fuc-number">01</div>
                <div className="fuc-content">
                  <h3 className="fuc-title">DINE IN</h3>
                  <div className="fuc-divider"/>
                  <p className="fuc-address">Plot 42, Saheed Nagar<br/>Bhubaneswar, Odisha</p>
                  <p className="fuc-hours">🕐 Mon–Sun: 11:00 AM – 11:00 PM</p>
                  <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="fuc-cta">GET DIRECTIONS →</a>
                </div>
                <div className="fuc-bg-text" aria-hidden="true">EAT</div>
              </article>

              {/* Delivery */}
              <article className="fuc-card fuc-delivery stagger" style={{transitionDelay: '0.2s'}}>
                <div className="fuc-number">02</div>
                <div className="fuc-content">
                  <h3 className="fuc-title">DELIVERY</h3>
                  <div className="fuc-divider"/>
                  <p className="fuc-address">Zomato · Swiggy<br/>Direct WhatsApp Order</p>
                  <p className="fuc-hours">🛵 Free over ₹499 · ~30 min avg</p>
                  <a href="https://wa.me/910000000000" target="_blank" rel="noreferrer" className="fuc-cta">ORDER NOW →</a>
                </div>
                <div className="fuc-bg-text" aria-hidden="true">GO</div>
              </article>

            </div>

            {/* Bottom note */}
            <div className="find-us-note">
              <p>For large orders & catering — <a href="mailto:hello@biriyaniexpress.in">hello@biriyaniexpress.in</a></p>
            </div>
          </section>

        </main>

        {/* ── CART DRAWER ─────────────────────────────────────────── */}
        <aside className={`cart-drawer ${cartOpen ? 'open' : ''}`} aria-label="Shopping cart" aria-hidden={cartOpen ? 'false' : 'true'}>
          {/* Dark header band */}
          <div className="cart-hd">
            <div className="cart-hd-left">
              <span className="cart-hd-eyebrow">YOUR CART</span>
              <h2 className="cart-hd-title">Fresh from<br/>the Pot 🍲</h2>
            </div>
            <button type="button" className="cart-x" aria-label="Close cart" onClick={() => setCartOpen(false)}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 1l16 16M17 1L1 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* Items list */}
          <div className="cart-body">
            {cartItems.length === 0 ? (
              <div className="cart-empty-state">
                <div className="cart-empty-icon">🫙</div>
                <p className="cart-empty-title">Nothing here yet</p>
                <p className="cart-empty-sub">Add a biryani to get the feast going.</p>
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
                      <button type="button" className="stepper-btn" onClick={() => updateCartQty(item.title, -1)} aria-label={`Decrease ${item.title}`}>
                        <svg width="10" height="2" viewBox="0 0 10 2"><rect width="10" height="2" rx="1" fill="currentColor"/></svg>
                      </button>
                      <span className="stepper-qty">{item.qty}</span>
                      <button type="button" className="stepper-btn" onClick={() => updateCartQty(item.title, 1)} aria-label={`Increase ${item.title}`}>
                        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="4" width="2" height="10" rx="1" fill="currentColor"/><rect y="4" width="10" height="2" rx="1" fill="currentColor"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="citem-right">
                    <p className="citem-subtotal">₹{(item.price * item.qty).toFixed(0)}</p>
                    <button type="button" className="citem-remove" onClick={() => removeFromCart(item.title)} aria-label={`Remove ${item.title}`}>
                      <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="cart-foot">
            <div className="cart-foot-row">
              <span>Subtotal</span>
              <strong>₹{cartTotal.toFixed(0)}</strong>
            </div>
            <p className="cart-foot-note">Delivery fee calculated at checkout</p>
            <button
              type="button"
              className="cart-cta"
              onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
              disabled={cartItems.length === 0}
            >
              <span>Proceed to Checkout</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
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

        {/* ── CHECKOUT MODAL ─────────────────────────────────────────── */}
        <div className="co-overlay" aria-hidden={checkoutOpen ? 'false' : 'true'}>
          <button type="button" className="co-backdrop" aria-label="Close checkout" onClick={() => setCheckoutOpen(false)} />
          <div className="co-panel" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
            <button type="button" className="co-close" aria-label="Close checkout" onClick={() => setCheckoutOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 1l14 14M15 1L1 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            
            {/* Left — dark green branding pane */}
            <div className="co-left">
              <div className="co-left-top">
                <p className="co-eyebrow">Biriyani Express</p>
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

            {/* Right — delivery form pane */}
            <div className="co-right">

              <p className="co-form-eyebrow">Step 2 of 2</p>
              <h3 className="co-form-title">Delivery Details</h3>
              <p className="co-form-sub">We'll send your order confirmation on WhatsApp.</p>

              <form className="co-form" onSubmit={(e) => e.preventDefault()}>
                <div className="co-field">
                  <label htmlFor="co-name">Full Name</label>
                  <input id="co-name" type="text" placeholder="Muhammad Amanullah" autoComplete="name" />
                </div>
                <div className="co-field">
                  <label htmlFor="co-phone">Phone Number</label>
                  <input id="co-phone" type="tel" placeholder="+91 82713 01179" autoComplete="tel" />
                </div>
                <div className="co-field">
                  <label htmlFor="co-address">Delivery Address</label>
                  <textarea id="co-address" rows={3} placeholder="House no, Street, Landmark, Patna…" />
                </div>
              </form>

              <a
                href={`https://wa.me/918271301179?text=${encodeURIComponent(`🍛 *New Order — Biriyani Express*\n\n${cartItems.map(i => `• ${i.title} x${i.qty} — ₹${(i.price * i.qty).toFixed(0)}`).join('\n')}\n\n*Total: ₹${grandTotal.toFixed(0)}*`)}`}
                className="co-whatsapp"
                target="_blank"
                rel="noreferrer"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Order on WhatsApp
              </a>

              <button type="button" className="co-cancel" onClick={() => setCheckoutOpen(false)}>Cancel</button>
            </div>

          </div>
        </div>

        <footer className="footer-brutalist" role="contentinfo">
          <div className="marquee marquee-footer" aria-label="Order ticker">
            <div className="marquee-track">
              <span>HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • </span>
              <span>HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • HUNGRY? ORDER NOW • </span>
            </div>
          </div>
          
          <div className="footer-massive-nav container">
            <nav className="massive-links">
              <a href="#menu" data-text="MENU">MENU</a>
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
                <p><a href="https://igniusstudios.vercel.app/" target="_blank" rel="noopener noreferrer">igniusstudios.com</a></p>
              </div>
              <div className="info-block socials-brutalist">
                <a href="https://instagram.com/_.hussain29" target="_blank" rel="noopener noreferrer" >INSTAGRAM</a>
                <a href="https://wa.me/918271301179" target="_blank" rel="noreferrer">WHATSAPP</a>
                <a href="https://github.com/amaan-exe" target="_blank" rel="noopener noreferrer">Github</a>
              </div>
            </div>
          </div>

          <div className="footer-bleeding-edge">
            BIRIYANI EXPRESS
          </div>
          
          <div className="footer-bottom-bar container">
            <p>© 2026 Biriyani Express · Patna, Bihar</p>
            <div className="legal-links">
              <a href="#">COOKIES</a>
              <a href="#">PRIVACY POLICY</a>
            </div>
            <p>MADE By <span>     :</span>
            <a href="https://instagram.com/_.hussain29" target="_blank" rel="noopener noreferrer" >   Muhammad Amanullah</a> </p>
            
          </div>
        </footer>

        {/* Premium Toast Notification */}
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

