import { useState, useEffect } from 'react'
import UpiPaymentBox from './UpiPaymentBox'
import { getDocs, query, collection, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useSettings } from '../context/SettingsContext'
export default function CheckoutModal({
  isOpen,
  onClose,
  cartItems = [],
  cartTotal = 0,
  deliveryFee = 0,
  grandTotal = 0,
  user = null,
  userProfile = null,
  openAuthModal,
  onPlaceOrder,
  coLoading = false
}) {
  const { settings } = useSettings()
  const [step, setStep] = useState(1) // 1: Delivery Details, 2: Payment & Review
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('COD') // 'COD' | 'UPI'
  const [showItemSummary, setShowItemSummary] = useState(false)
  
  // Coupon State
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return
    setCouponError('')
    setCouponLoading(true)

    try {
      const q = query(collection(db, 'coupons'), where('couponCode', '==', couponInput.toUpperCase().trim()))
      const snapshot = await getDocs(q)
      
      if (snapshot.empty) {
        setCouponError('Invalid coupon code.')
        setAppliedCoupon(null)
      } else {
        const coupon = snapshot.docs[0].data()
        
        if (!coupon.active) {
          setCouponError('This coupon is currently inactive.')
          setAppliedCoupon(null)
        } else if (cartTotal < coupon.minimumOrder) {
          setCouponError(`Minimum order amount for this coupon is ₹${coupon.minimumOrder}.`)
          setAppliedCoupon(null)
        } else {
          setAppliedCoupon(coupon)
          setCouponInput('')
        }
      }
    } catch (err) {
      setCouponError('Failed to apply coupon. Try again.')
      setAppliedCoupon(null)
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponError('')
  }

  // Pre-fill user details from Auth Profile
  useEffect(() => {
    if (userProfile || user) {
      if (!name) setName(userProfile?.name || user?.displayName || '')
      if (!phone) setPhone(userProfile?.phone || '')
      if (!address) setAddress(userProfile?.defaultAddress || '')
    }
  }, [userProfile, user])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setShowItemSummary(false)
    }
  }, [isOpen])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const handleStep1Submit = (e) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !address.trim()) {
      alert('Please fill in your name, phone number, and delivery address.')
      return
    }
    setStep(2)
  }

  const discountAmount = appliedCoupon ? appliedCoupon.discountValue : 0
  const finalTotal = Math.max(0, grandTotal - discountAmount)

  const handleFinalOrderSubmit = (e) => {
    if (e) e.preventDefault()
    onPlaceOrder({
      name,
      phone,
      address,
      paymentMethod,
      isUpi: paymentMethod === 'UPI',
      coupon: appliedCoupon ? { code: appliedCoupon.couponCode, discount: appliedCoupon.discountValue } : null
    })
  }

  const handleQuickAddress = (landmark) => {
    if (!address.includes(landmark)) {
      setAddress((prev) => (prev ? `${prev}, ${landmark}` : landmark))
    }
  }

  return (
    <div className="co-overlay" aria-hidden={isOpen ? 'false' : 'true'}>
      <button type="button" className="co-backdrop" aria-label="Close checkout" onClick={onClose} />
      
      <div className="co-panel checkout-redesign-panel" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
        <div className="sheet-handle" />
        
        <button type="button" className="co-close" aria-label="Close checkout" onClick={onClose}>
          ✕
        </button>

        {/* --- LEFT PANEL: ORDER SUMMARY & STEPS --- */}
        <div className="co-left checkout-left-redesign">
          <div className="co-left-top">
            <span className="co-eyebrow">BIRIYANI STATION PATNA</span>
            <h2 id="checkoutTitle" className="co-headline">Checkout</h2>
            <p className="co-tagline">Authentic Dum Pukht & Clay-Oven Kawabs</p>
          </div>

          {/* Stepper Tabs */}
          <div className="checkout-stepper-pills">
            <button
              type="button"
              className={`stepper-pill ${step === 1 ? 'active' : 'completed'}`}
              onClick={() => setStep(1)}
            >
              <span className="pill-num">{step > 1 ? '✓' : '1'}</span>
              <span className="pill-text">Delivery Info</span>
            </button>

            <span className="stepper-arrow">→</span>

            <button
              type="button"
              className={`stepper-pill ${step === 2 ? 'active' : ''}`}
              onClick={() => {
                if (name && phone && address) setStep(2)
              }}
            >
              <span className="pill-num">2</span>
              <span className="pill-text">Payment</span>
            </button>
          </div>

          {/* Order Items Collapsible */}
          <div className="checkout-items-card">
            <div
              className="items-card-header"
              onClick={() => setShowItemSummary(!showItemSummary)}
            >
              <span>🛒 Order Summary ({cartItems.length} item{cartItems.length === 1 ? '' : 's'})</span>
              <span style={{ fontSize: '0.8rem' }}>{showItemSummary ? '▲ Hide' : '▼ View'}</span>
            </div>

            {(showItemSummary || step === 1) && (
              <div className="co-items" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {cartItems.map((item) => (
                  <div className="co-item" key={item.title}>
                    <img src={item.image} alt={item.title} className="co-item-img" />
                    <div className="co-item-info">
                      <p className="co-item-name">{item.title}</p>
                      <p className="co-item-qty">x{item.qty}</p>
                    </div>
                    <p className="co-item-price">₹{(item.price * item.qty).toFixed(0)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coupon Code Section */}
          {(showItemSummary || step === 1) && (
            <div style={{ padding: '0 24px', marginBottom: '16px' }}>
              {!appliedCoupon ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Have a coupon code?" 
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px dashed #ccc', textTransform: 'uppercase' }}
                  />
                  <button 
                    type="button" 
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponInput.trim()}
                    style={{ padding: '0 16px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: couponLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {couponLoading ? '...' : 'APPLY'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(34,197,94,0.1)', border: '1px dashed #16a34a', padding: '10px 14px', borderRadius: '10px' }}>
                  <div>
                    <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '0.85rem' }}>{appliedCoupon.couponCode} APPLIED</span>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#16a34a' }}>You saved ₹{appliedCoupon.discountValue}!</p>
                  </div>
                  <button type="button" onClick={handleRemoveCoupon} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>REMOVE</button>
                </div>
              )}
              {couponError && <p style={{ color: '#dc2626', fontSize: '0.75rem', margin: '6px 0 0 0', fontWeight: 600 }}>{couponError}</p>}
            </div>
          )}

          {/* Totals */}
          <div className="co-totals">
            <div className="co-total-row">
              <span>Subtotal</span><span>₹{cartTotal.toFixed(0)}</span>
            </div>
            {appliedCoupon && (
              <div className="co-total-row" style={{ color: '#16a34a', fontWeight: 700 }}>
                <span>Coupon Discount</span><span>-₹{appliedCoupon.discountValue}</span>
              </div>
            )}
            <div className="co-total-row">
              <span>Delivery Fee</span><span>{deliveryFee > 0 ? `₹${deliveryFee}` : 'FREE 🎉'}</span>
            </div>
            <div className="co-total-row" style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              <span>Taxes (GST {settings?.gstPercentage || 18}%)</span><span>Included</span>
            </div>
            <div className="co-total-row co-total-grand">
              <span>Total Payable</span><strong>₹{finalTotal.toFixed(0)}</strong>
            </div>
          </div>
        </div>

        {/* --- RIGHT PANEL: FORM & PAYMENT --- */}
        <div className="co-right checkout-right-redesign">
          {settings?.isStoreOpen === false ? (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '20px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔴</div>
              <h3 style={{ margin: '0 0 6px 0', color: '#991b1b', fontSize: '1.25rem', fontWeight: 900 }}>
                RESTAURANT IS CURRENTLY CLOSED
              </h3>
              <p style={{ margin: '0 0 16px 0', color: '#7f1d1d', fontSize: '0.88rem', lineHeight: 1.6 }}>
                We are currently not accepting new online orders. Please check back during our operating hours or contact support.
              </p>
              
              <div style={{ background: '#ffffff', borderRadius: '14px', padding: '14px 16px', marginBottom: '20px', textAlign: 'left', border: '1px solid rgba(0,0,0,0.08)' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)' }}>
                  🕒 Store Hours: <strong>{settings?.openingTime || '11:00 AM'} – {settings?.closingTime || '11:30 PM'}</strong>
                </p>
                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)' }}>
                  📞 Support: <a href={`tel:${settings?.supportPhone}`} style={{ color: 'var(--deep-green)', textDecoration: 'underline' }}>{settings?.supportPhone || '+91 82713 01179'}</a>
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="btn"
                style={{ width: '100%', background: '#dc2626', color: '#ffffff', padding: '14px', fontWeight: 900 }}
              >
                CLOSE CHECKOUT ✕
              </button>
            </div>
          ) : step === 1 ? (
            /* STEP 1: DELIVERY DETAILS */
            <form className="co-form" onSubmit={handleStep1Submit}>
              <div className="checkout-step-header">
                <span className="step-badge">STEP 1 OF 2</span>
                <h3>Where should we deliver?</h3>
                <p>Enter your contact details so our delivery agent can reach you.</p>
              </div>

              {!user && (
                <div style={{ background: 'rgba(245, 200, 66, 0.14)', border: '1px solid rgba(245, 200, 66, 0.4)', borderRadius: '12px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Already have an account?</span>
                  <button type="button" onClick={openAuthModal} style={{ background: 'var(--deep-green)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
                    Sign In
                  </button>
                </div>
              )}

              <div className="co-field">
                <label htmlFor="co-name">Full Name *</label>
                <input
                  id="co-name"
                  type="text"
                  placeholder="e.g. Amanullah Khan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="co-field">
                <label htmlFor="co-phone">Phone Number *</label>
                <input
                  id="co-phone"
                  type="tel"
                  placeholder="+91 82713 01179"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="co-field">
                <label htmlFor="co-address">Delivery Address in Patna *</label>
                <textarea
                  id="co-address"
                  rows={3}
                  placeholder="House/Flat No., Landmark, Area, Patna…"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>

              {/* Quick Patna Landmarks */}
              <div style={{ marginTop: '-6px', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  QUICK PATNA LANDMARKS:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['Phulwari Shareef', 'Boring Road', 'Bailey Road', 'Kankarbagh', 'Rajendra Nagar'].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleQuickAddress(chip)}
                      style={{
                        background: 'rgba(0,0,0,0.05)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--ink)',
                        cursor: 'pointer'
                      }}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn"
                style={{
                  width: '100%',
                  padding: '16px',
                  minHeight: '52px',
                  background: 'var(--deep-green)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  letterSpacing: '0.05em'
                }}
              >
                PROCEED TO PAYMENT →
              </button>
            </form>
          ) : (
            /* STEP 2: PAYMENT & CONFIRMATION */
            <div className="co-form">
              <div className="checkout-step-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="step-badge">STEP 2 OF 2</span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{ background: 'none', border: 'none', color: 'var(--deep-green)', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    ← Edit Address
                  </button>
                </div>
                <h3>Select Payment Method</h3>
                <p>Delivering to: <strong>{address}</strong></p>
              </div>

              {/* Payment Method Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  style={{
                    padding: '14px 12px',
                    borderRadius: '16px',
                    border: paymentMethod === 'COD' ? '2px solid var(--deep-green)' : '1px solid rgba(0,0,0,0.1)',
                    background: paymentMethod === 'COD' ? 'rgba(13,90,58,0.08)' : '#ffffff',
                    color: paymentMethod === 'COD' ? 'var(--deep-green)' : 'var(--ink)',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>💵</span>
                  <span>Pay on Delivery</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  style={{
                    padding: '14px 12px',
                    borderRadius: '16px',
                    border: paymentMethod === 'UPI' ? '2px solid var(--deep-green)' : '1px solid rgba(0,0,0,0.1)',
                    background: paymentMethod === 'UPI' ? 'rgba(13,90,58,0.08)' : '#ffffff',
                    color: paymentMethod === 'UPI' ? 'var(--deep-green)' : 'var(--ink)',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>📲</span>
                  <span>Instant UPI</span>
                </button>
              </div>

              {paymentMethod === 'UPI' && (
                <UpiPaymentBox
                  amount={finalTotal}
                  onVerify={(utr) => {
                    onPlaceOrder({ name, phone, address, paymentMethod: 'UPI', isUpi: true, coupon: appliedCoupon ? { code: appliedCoupon.couponCode, discount: appliedCoupon.discountValue } : null }, utr)
                  }}
                />
              )}
              {paymentMethod !== 'UPI' && (
                <>
                  <div style={{ background: '#faf9f5', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '14px', padding: '14px', marginBottom: '16px' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink)', lineHeight: 1.5 }}>
                      💵 <strong>Cash or QR Code on Delivery</strong>: Pay cash or scan UPI code when your hot biryani arrives at your doorstep.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="co-whatsapp"
                    disabled={coLoading}
                    onClick={handleFinalOrderSubmit}
                    style={{ width: '100%', border: 'none', cursor: coLoading ? 'wait' : 'pointer', minHeight: '52px' }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    {coLoading ? 'CONFIRMING ORDER...' : 'PLACE ORDER VIA WHATSAPP'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
