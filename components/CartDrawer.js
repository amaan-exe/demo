import dynamic from 'next/dynamic'

const AnnouncementBanner = dynamic(() => import('./AnnouncementBanner'), { ssr: false })

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems = [],
  cartTotal = 0,
  updateCartQty,
  removeFromCart,
  onProceedToCheckout
}) {
  return (
    <>
      <aside
        className={`cart-drawer ${isOpen ? 'open' : ''}`}
        aria-label="Shopping cart"
        aria-hidden={isOpen ? 'false' : 'true'}
      >
        <div className="cart-hd">
          <div className="cart-hd-left">
            <span className="cart-hd-eyebrow">YOUR CART</span>
            <h2 className="cart-hd-title">Fresh from<br />the Pot 🍲</h2>
          </div>
          <button type="button" className="cart-x" aria-label="Close cart" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M1 1l16 16M17 1L1 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="cart-body">
          <AnnouncementBanner placement="cart" />
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
                  <p className="citem-unit">₹{(item.price || 0).toFixed(0)} each</p>
                  <div className="citem-stepper">
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => updateCartQty(item.title, -1)}
                      aria-label={`Decrease ${item.title}`}
                    >
                      <svg width="10" height="2" viewBox="0 0 10 2">
                        <rect width="10" height="2" rx="1" fill="currentColor" />
                      </svg>
                    </button>
                    <span className="stepper-qty">{item.qty}</span>
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => updateCartQty(item.title, 1)}
                      aria-label={`Increase ${item.title}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <rect x="4" width="2" height="10" rx="1" fill="currentColor" />
                        <rect y="4" width="10" height="2" rx="1" fill="currentColor" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="citem-right">
                  <p className="citem-subtotal">₹{((item.price || 0) * item.qty).toFixed(0)}</p>
                  <button
                    type="button"
                    className="citem-remove"
                    onClick={() => removeFromCart(item.title)}
                    aria-label={`Remove ${item.title}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12">
                      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
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
            onClick={onProceedToCheckout}
            disabled={cartItems.length === 0}
          >
            <span>Proceed to Checkout</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>

      {isOpen ? (
        <button
          type="button"
          className="cart-backdrop"
          aria-label="Close cart overlay"
          onClick={onClose}
        />
      ) : null}
    </>
  )
}
