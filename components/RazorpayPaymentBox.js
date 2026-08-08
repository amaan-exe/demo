import { useState } from 'react'

export default function RazorpayPaymentBox({
  grandTotal = 0,
  customerName = '',
  customerPhone = '',
  customerEmail = '',
  orderDetails = null,
  onPaymentSuccess,
  loading = false
}) {
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')

  const numericTotal = typeof grandTotal === 'number' && !isNaN(grandTotal) ? grandTotal : (parseFloat(grandTotal) || 0)
  const formattedTotal = numericTotal.toFixed(0)

  // Dynamically load Razorpay Checkout SDK script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleInitiateRazorpay = async () => {
    setPayError('')
    setPayLoading(true)

    try {
      // 1. Load SDK
      const isLoaded = await loadRazorpayScript()
      if (!isLoaded) {
        setPayError('Failed to load Razorpay Payment Gateway. Please check your internet connection.')
        setPayLoading(false)
        return
      }

      // 2. Call backend to create Razorpay order + pre-create Firestore order
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numericTotal,
          orderDetails: orderDetails || null,
        })
      })

      const resText = await res.text()
      let data = {}
      try { data = JSON.parse(resText) } catch (e) { data = { error: `Server error (Status ${res.status})` } }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not initiate Razorpay payment order.')
      }

      const { order_id, key_id, amount, currency, orderId: internalOrderId } = data

      // 3. Open Razorpay Checkout Modal
      const options = {
        key: key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: amount,
        currency: currency || 'INR',
        name: 'Biriyani Station Patna',
        description: `Order Payment — ₹${formattedTotal}`,
        image: '/favicon.ico',
        order_id: order_id,
        handler: async function (response) {
          setPayLoading(true)
          try {
            // 4. Verify payment signature on backend + update Firestore
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId: internalOrderId,
              })
            })

            const verifyText = await verifyRes.text()
            let verifyData = {}
            try { verifyData = JSON.parse(verifyText) } catch (e) { verifyData = { error: `Verification error (Status ${verifyRes.status})` } }

            if (verifyRes.ok && verifyData.success) {
              if (typeof onPaymentSuccess === 'function') {
                onPaymentSuccess({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  preCreatedOrderId: internalOrderId,
                })
              }
            } else {
              setPayError(verifyData.error || 'Payment verification failed. Please contact support if money was deducted.')
            }
          } catch (err) {
            console.error('Razorpay verification error:', err)
            // Even if client verification fails, webhook will catch it
            setPayError('Verification timed out. Your payment is safe — the order will be confirmed automatically within 1 minute.')
          } finally {
            setPayLoading(false)
          }
        },
        prefill: {
          name: customerName || '',
          email: customerEmail || '',
          contact: customerPhone || '',
        },
        notes: {
          address: 'Biriyani Station Patna Checkout',
        },
        theme: {
          color: '#0d5a3a',
        },
        modal: {
          ondismiss: function () {
            setPayLoading(false)
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        console.error('Razorpay Payment Failed:', response.error)
        setPayError(response.error.description || 'Payment was unsuccessful. Please try again.')
        setPayLoading(false)
      })
      rzp.open()

    } catch (err) {
      console.error('Razorpay Initiation Error:', err)
      setPayError(err.message || 'Failed to start payment.')
      setPayLoading(false)
    }
  }

  const isBusy = payLoading || loading

  return (
    <div style={{ background: '#faf9f5', border: '1.5px solid rgba(13,90,58,0.2)', borderRadius: '20px', padding: '20px', marginTop: '16px' }}>
      
      {/* Total Amount Header */}
      <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px dashed rgba(0,0,0,0.1)' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase' }}>
          TOTAL PAYABLE
        </span>
        <h3 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--deep-green)', margin: '2px 0 0 0' }}>
          ₹{formattedTotal}
        </h3>
      </div>

      {/* Supported Payment Methods Badge */}
      <div style={{ background: '#ffffff', padding: '14px 16px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.04)', marginBottom: '16px' }}>
        <span style={{ display: 'inline-block', background: 'rgba(13,90,58,0.08)', color: 'var(--deep-green)', padding: '4px 12px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '8px' }}>
          🔒 256-BIT SECURE RAZORPAY CHECKOUT
        </span>
        <p style={{ margin: '4px 0 10px 0', fontSize: '0.83rem', color: 'var(--muted)', fontWeight: 600 }}>
          Supports Google Pay, PhonePe, Paytm, All Credit/Debit Cards, NetBanking & Wallets
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ background: '#f0f4f1', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#0d5a3a' }}>📲 UPI / QR</span>
          <span style={{ background: '#f0f4f1', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#0d5a3a' }}>💳 Cards</span>
          <span style={{ background: '#f0f4f1', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#0d5a3a' }}>🏦 NetBanking</span>
          <span style={{ background: '#f0f4f1', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#0d5a3a' }}>👛 Wallets</span>
        </div>
      </div>

      {payError && (
        <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '10px 14px', borderRadius: '12px', fontSize: '0.82rem', marginBottom: '14px', fontWeight: 600 }}>
          ⚠️ {payError}
        </div>
      )}

      {/* Pay Now Button */}
      <button
        type="button"
        onClick={handleInitiateRazorpay}
        disabled={isBusy}
        style={{
          width: '100%',
          background: isBusy ? 'var(--muted)' : 'var(--deep-green)',
          color: '#ffffff',
          border: 'none',
          padding: '16px',
          borderRadius: '14px',
          fontSize: '1.05rem',
          fontWeight: 900,
          letterSpacing: '0.05em',
          cursor: isBusy ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 14px rgba(13,90,58,0.3)',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        {isBusy ? (
          <>🔄 Processing Payment...</>
        ) : (
          <>💳 PAY ₹{formattedTotal} VIA RAZORPAY →</>
        )}
      </button>
    </div>
  )
}
