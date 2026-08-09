import { useState, useEffect, useRef, useCallback } from 'react'

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

  // Refs to track pending checkout across visibility changes
  const pendingCheckoutRef = useRef(null)
  const reconcileRunningRef = useRef(false)

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

  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [checkingNotice, setCheckingNotice] = useState('')

  // Server-side payment reconciliation polling loop (NO auth header needed — public endpoint)
  const pollServerPaymentStatus = useCallback(async (internalOrderId, razorpayOrderId) => {
    if (reconcileRunningRef.current) return false // prevent duplicate polls
    reconcileRunningRef.current = true
    setIsCheckingStatus(true)
    setCheckingNotice("⏳ Checking payment status with Razorpay... Please don't pay again.")

    const delays = [0, 2500, 5000, 8000, 12000]
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) {
        await new Promise((r) => setTimeout(r, delays[i]))
      }

      try {
        const res = await fetch('/api/razorpay/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ internalOrderId, razorpayOrderId })
        })

        if (res.ok) {
          const data = await res.json()
          if (data.success && data.status === 'DONE') {
            setIsCheckingStatus(false)
            setPayLoading(false)
            setCheckingNotice('')
            reconcileRunningRef.current = false
            pendingCheckoutRef.current = null
            try { sessionStorage.removeItem('pending_razorpay_checkout') } catch (e) {}
            if (typeof onPaymentSuccess === 'function') {
              onPaymentSuccess({
                razorpay_payment_id: data.payment?.id || 'VERIFIED',
                razorpay_order_id: razorpayOrderId,
                preCreatedOrderId: internalOrderId,
              })
            }
            return true
          } else if (data.status === 'FAILED') {
            setIsCheckingStatus(false)
            setPayLoading(false)
            setCheckingNotice('')
            reconcileRunningRef.current = false
            pendingCheckoutRef.current = null
            setPayError(data.transaction?.failureReason || 'Payment failed on gateway or was cancelled by user.')
            return false
          }
        }
      } catch (err) {
        console.warn('Reconciliation poll notice:', err)
      }
    }

    // Polling completed without definitive DONE or FAILED -> Payment remains pending on bank
    setIsCheckingStatus(false)
    setPayLoading(false)
    setCheckingNotice('')
    reconcileRunningRef.current = false
    setPayError('We are still confirming your payment with your bank. Please check your Orders page shortly. Do not pay again.')
    return false
  }, [onPaymentSuccess])

  // Fast single-pass check when user explicitly dismisses or cancels payment modal
  const checkDismissedOrCancelledStatus = useCallback(async (internalOrderId, razorpayOrderId) => {
    setIsCheckingStatus(true)
    setCheckingNotice("⏳ Checking payment status...")
    try {
      const res = await fetch('/api/razorpay/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalOrderId, razorpayOrderId })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.status === 'DONE') {
          setIsCheckingStatus(false)
          setPayLoading(false)
          setCheckingNotice('')
          reconcileRunningRef.current = false
          pendingCheckoutRef.current = null
          try { sessionStorage.removeItem('pending_razorpay_checkout') } catch (e) {}
          if (typeof onPaymentSuccess === 'function') {
            onPaymentSuccess({
              razorpay_payment_id: data.payment?.id || 'VERIFIED',
              razorpay_order_id: razorpayOrderId,
              preCreatedOrderId: internalOrderId,
            })
          }
          return true
        }
      }
    } catch (e) {}

    // Not paid -> User dismissed modal or cancelled
    setIsCheckingStatus(false)
    setPayLoading(false)
    setCheckingNotice('')
    reconcileRunningRef.current = false
    pendingCheckoutRef.current = null
    setPayError('Payment was cancelled or closed. You can try paying again whenever you are ready.')
    return false
  }, [onPaymentSuccess])

  // R1: Auto-reconcile when user returns from UPI app (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && pendingCheckoutRef.current && !reconcileRunningRef.current) {
        const { internalOrderId, razorpayOrderId } = pendingCheckoutRef.current
        if (internalOrderId && razorpayOrderId) {
          // Small delay to let Razorpay SDK settle after app switch
          setTimeout(() => {
            if (pendingCheckoutRef.current) {
              pollServerPaymentStatus(internalOrderId, razorpayOrderId)
            }
          }, 1500)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [pollServerPaymentStatus])

  const handleInitiateRazorpay = async () => {
    setPayError('')
    setCheckingNotice('')
    setPayLoading(true)
    // Reset stale reconciliation state from any previous attempt
    reconcileRunningRef.current = false
    pendingCheckoutRef.current = null

    try {
      // 1. Load SDK
      const isLoaded = await loadRazorpayScript()
      if (!isLoaded) {
        setPayError('Failed to load Razorpay Payment Gateway. Please check your internet connection.')
        setPayLoading(false)
        return
      }

      // 2. Call backend to create Razorpay order + pre-create Firestore & MongoDB order
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

      // Save pending checkout metadata to sessionStorage for reload recovery
      const pendingData = {
        internalOrderId,
        razorpayOrderId: order_id,
        amount: numericTotal,
        userId: orderDetails?.userId || null,
        userEmail: orderDetails?.userEmail || null,
        customerName: customerName || orderDetails?.customerName || '',
        customerPhone: customerPhone || orderDetails?.customerPhone || '',
        createdAt: Date.now()
      }
      pendingCheckoutRef.current = pendingData
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pending_razorpay_checkout', JSON.stringify(pendingData))
        }
      } catch (e) {}

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
          pendingCheckoutRef.current = null // handler fired = no need for visibility recovery
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
                userId: orderDetails?.userId || null,
                userEmail: orderDetails?.userEmail || null,
                customerName: customerName || orderDetails?.customerName || '',
                customerPhone: customerPhone || orderDetails?.customerPhone || '',
                deliveryAddress: orderDetails?.deliveryAddress || '',
                items: orderDetails?.items || [],
                subtotal: orderDetails?.subtotal || 0,
                deliveryCharge: orderDetails?.deliveryCharge || 0,
                grandTotal: numericTotal,
                coupon: orderDetails?.coupon || null,
              })
            })

            const verifyText = await verifyRes.text()
            let verifyData = {}
            try { verifyData = JSON.parse(verifyText) } catch (e) { verifyData = { error: `Verification error (Status ${verifyRes.status})` } }

            if (verifyRes.ok && verifyData.success) {
              // If orderId was missing on server side, trigger reconciliation as backup
              if (verifyData.orderUpdateSkipped) {
                await pollServerPaymentStatus(internalOrderId, order_id)
              } else {
                try { sessionStorage.removeItem('pending_razorpay_checkout') } catch (e) {}
                if (typeof onPaymentSuccess === 'function') {
                  onPaymentSuccess({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    preCreatedOrderId: internalOrderId,
                  })
                }
              }
            } else {
              // Client verify didn't complete immediately — run server reconciliation poll
              await pollServerPaymentStatus(internalOrderId, order_id)
            }
          } catch (err) {
            console.error('Razorpay verification error:', err)
            await pollServerPaymentStatus(internalOrderId, order_id)
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
            // User dismissed modal or cancelled payment
            checkDismissedOrCancelledStatus(internalOrderId, order_id)
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        console.warn('Razorpay payment notice / error event:', response.error)
        const desc = response.error?.description || ''
        const reason = response.error?.reason || ''
        
        // Fast single-pass check to see if user cancelled vs app handoff
        const isMobileHandoffError = (
          desc.includes("Can't open payment app") ||
          desc.includes('Unable to open') ||
          desc.includes('payment app is not installed') ||
          !desc
        )

        if (isMobileHandoffError) {
          pollServerPaymentStatus(internalOrderId, order_id)
        } else {
          checkDismissedOrCancelledStatus(internalOrderId, order_id)
        }
      })
      rzp.open()

    } catch (err) {
      console.error('Razorpay Initiation Error:', err)
      setPayError(err.message || 'Failed to start payment.')
      setPayLoading(false)
    }
  }

  const isBusy = payLoading || loading || isCheckingStatus

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

      {checkingNotice && (
        <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', color: '#92400e', padding: '12px 14px', borderRadius: '12px', fontSize: '0.84rem', marginBottom: '14px', fontWeight: 700, textAlign: 'center' }}>
          {checkingNotice}
        </div>
      )}

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
