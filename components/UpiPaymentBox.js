import { useState } from 'react'

export default function UpiPaymentBox({
  grandTotal,
  orderId,
  restaurantName = 'Biriyani Station',
  upiId = '8271301179@paytm',
  onConfirmPayment,
  loading = false
}) {
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState('idle') // 'idle' | 'confirm' | 'utr'
  const [utrNumber, setUtrNumber] = useState('')

  const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(restaurantName)}&am=${grandTotal.toFixed(0)}&cu=INR&tn=${orderId}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(upiUri)}&size=240x240&margin=10`

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleOpenUpiApp = () => {
    window.location.href = upiUri
  }

  const handleFinalSubmit = (e, utrValue) => {
    setStep('idle')
    onConfirmPayment(e, utrValue)
  }

  return (
    <div style={{ background: '#faf9f5', border: '1px solid rgba(13,90,58,0.18)', borderRadius: '20px', padding: '20px', marginTop: '16px' }}>
      
      {/* Total Amount Header */}
      <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px dashed rgba(0,0,0,0.1)' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase' }}>
          AMOUNT DUE
        </span>
        <h3 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--deep-green)', margin: '2px 0 0 0' }}>
          ₹{grandTotal.toFixed(0)}
        </h3>
      </div>

      {/* Dynamic QR Code Card */}
      <div style={{ background: '#ffffff', padding: '16px', borderRadius: '16px', textAlignment: 'center', textAlign: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.04)', marginBottom: '16px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.1em' }}>
          SCAN QR CODE WITH ANY UPI APP
        </p>
        <img
          src={qrUrl}
          alt="UPI Payment QR Code"
          className="upi-qr-image"
          style={{ width: '180px', height: '180px', margin: '0 auto', display: 'block', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)' }}
        />
        <div style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--ink)' }}>
          Payee: <strong>{restaurantName}</strong>
        </div>
      </div>

      {/* UPI Details & Copy Button */}
      <div style={{ background: '#ffffff', borderRadius: '14px', padding: '12px 14px', marginBottom: '16px', border: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700 }}>UPI ID</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700 }}>ORDER ID</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ fontSize: '0.92rem', color: 'var(--ink)' }}>{upiId}</strong>
            <button
              type="button"
              onClick={handleCopyUpi}
              style={{
                background: copied ? 'rgba(13,90,58,0.15)' : 'rgba(0,0,0,0.05)',
                color: copied ? 'var(--deep-green)' : 'var(--ink)',
                border: 'none',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <strong style={{ fontSize: '0.88rem', color: 'var(--deep-green)' }}>#{orderId}</strong>
        </div>
      </div>

      {/* Direct UPI App Intent Buttons */}
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Pay Directly Using
        </p>
        <div className="upi-app-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button type="button" onClick={handleOpenUpiApp} style={{ padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: '#ffffff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            🔵 Google Pay
          </button>
          <button type="button" onClick={handleOpenUpiApp} style={{ padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: '#ffffff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            🟣 PhonePe
          </button>
          <button type="button" onClick={handleOpenUpiApp} style={{ padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: '#ffffff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            🔷 Paytm
          </button>
          <button type="button" onClick={handleOpenUpiApp} style={{ padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: '#ffffff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            🟠 BHIM UPI
          </button>
        </div>
      </div>

      {/* Already Paid Confirmation Button */}
      <button
        type="button"
        onClick={() => setStep('confirm')}
        disabled={loading}
        style={{
          width: '100%',
          background: 'var(--deep-green)',
          color: '#ffffff',
          border: 'none',
          padding: '14px',
          borderRadius: '14px',
          fontWeight: 800,
          fontSize: '0.92rem',
          cursor: loading ? 'wait' : 'pointer',
          boxShadow: '0 4px 12px rgba(13,90,58,0.2)'
        }}
      >
        {loading ? 'Submitting Order...' : "✓ I've Completed Payment"}
      </button>

      {/* Help Line */}
      <p style={{ margin: '10px 0 0 0', textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)' }}>
        Need help? Call restaurant: <a href="tel:+918271301179" style={{ color: 'var(--deep-green)', fontWeight: 800 }}>+91 82713 01179</a>
      </p>

      {/* STEP 1 MODAL: Confirm Payment */}
      {step === 'confirm' && (
        <>
          <div
            onClick={() => setStep('idle')}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.65)', zIndex: 99998, backdropFilter: 'blur(4px)' }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(420px, 92vw)',
              background: '#ffffff',
              borderRadius: '24px',
              padding: '28px 24px',
              textAlign: 'center',
              zIndex: 99999,
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              border: '2px solid var(--deep-green)'
            }}
          >
            <div style={{ fontSize: '2.8rem', marginBottom: '10px' }}>📲</div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--ink)', margin: '0 0 8px 0' }}>
              Confirm Payment
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '24px' }}>
              Have you successfully completed your UPI payment of <strong style={{ color: 'var(--deep-green)', fontSize: '1rem' }}>₹{grandTotal.toFixed(0)}</strong>?
              <br/>
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Only continue if you have already transferred the payment.</span>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setStep('idle')}
                style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.2)', background: '#ffffff', color: 'var(--ink)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('utr')}
                style={{ padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--deep-green)', color: '#ffffff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(13,90,58,0.3)' }}
              >
                Yes, I've Paid
              </button>
            </div>
          </div>
        </>
      )}

      {/* STEP 2 MODAL: Optional UPI Transaction Reference (UTR) */}
      {step === 'utr' && (
        <>
          <div
            onClick={() => setStep('idle')}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.65)', zIndex: 99998, backdropFilter: 'blur(4px)' }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(420px, 92vw)',
              background: '#ffffff',
              borderRadius: '24px',
              padding: '28px 24px',
              textAlign: 'center',
              zIndex: 99999,
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              border: '2px solid var(--deep-green)'
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>💳</div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--ink)', margin: '0 0 6px 0' }}>
              UPI Transaction ID
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', lineHeight: 1.4, marginBottom: '18px' }}>
              Enter your UPI Transaction Reference (UTR). This is optional but helps us verify your payment faster.
            </p>

            <input
              type="text"
              placeholder="e.g. 74648392929"
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.2)',
                fontSize: '0.95rem',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '0.08em',
                marginBottom: '20px',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                onClick={(e) => handleFinalSubmit(e, null)}
                style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.2)', background: '#ffffff', color: 'var(--ink)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={(e) => handleFinalSubmit(e, utrNumber)}
                style={{ padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--deep-green)', color: '#ffffff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(13,90,58,0.3)' }}
              >
                Submit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
