import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, loginWithGoogle, loginWithEmail } = useAuth()
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isAuthModalOpen) return null

  const formatAuthError = (err) => {
    const code = err?.code || err?.message || ''
    if (code.includes('popup-closed-by-user')) {
      return '' // Silently ignore when user cancels or closes Google popup
    }
    if (code.includes('popup-blocked')) {
      return 'Google Sign-In popup was blocked by your browser. Please allow popups for this site.'
    }
    if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
      return 'Invalid email or password. Please check your credentials and try again.'
    }
    if (code.includes('email-already-in-use')) {
      return 'An account with this email address already exists. Please sign in instead.'
    }
    if (code.includes('weak-password')) {
      return 'Password should be at least 6 characters long.'
    }
    if (code.includes('invalid-email')) {
      return 'Please enter a valid email address.'
    }
    return err?.message?.replace(/Firebase:\s*/i, '').replace(/Error\s*\(/i, '').replace(/\)\.?/i, '').trim() || 'Authentication failed'
  }

  const handleGoogleSignIn = async () => {
    try {
      setError('')
      setLoading(true)
      await loginWithGoogle()
    } catch (err) {
      const msg = formatAuthError(err)
      if (msg) setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setError('')
      setLoading(true)
      await loginWithEmail(email, password, isSignup, name)
    } catch (err) {
      setError(formatAuthError(err) || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="co-overlay" aria-hidden="false" style={{ opacity: 1, visibility: 'visible', zIndex: 4000 }}>
      <button type="button" className="co-backdrop" aria-label="Close auth modal" onClick={closeAuthModal} />

      <div
        className="auth-modal-panel"
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'min(440px, 92vw)',
          background: '#ffffff',
          borderRadius: '28px',
          padding: '36px 32px 32px',
          boxShadow: '0 30px 90px rgba(0,0,0,0.3)',
          border: '1px solid rgba(13,90,58,0.15)',
          overflow: 'hidden'
        }}
      >
        <div className="sheet-handle" />
        <button
          type="button"
          onClick={closeAuthModal}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(0,0,0,0.05)',
            border: 'none',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            fontSize: '1rem',
            color: 'var(--ink)'
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.25em', color: 'var(--deep-green)', textTransform: 'uppercase' }}>
            AUTHENTICATION · PATNA
          </span>
          <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2rem', fontWeight: 800, color: 'var(--ink)', margin: '6px 0 4px', fontStyle: 'italic' }}>
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
            {isSignup ? 'Join Biriyani Station for fast checkout & exclusive offers.' : 'Sign in to access your saved orders & faster checkout.'}
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.2)', color: '#dc3232', fontSize: '0.82rem', marginBottom: '18px', textAlign: 'center' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '14px 20px',
            borderRadius: '999px',
            border: '1.5px solid rgba(0,0,0,0.12)',
            background: '#ffffff',
            color: 'var(--ink)',
            fontWeight: '700',
            fontSize: '0.92rem',
            cursor: loading ? 'wait' : 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
            marginBottom: '20px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 20px 0', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: '700', letterSpacing: '0.1em' }}>OR WITH EMAIL</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isSignup && (
            <div className="co-field">
              <label htmlFor="auth-name">Full Name</label>
              <input
                id="auth-name"
                type="text"
                placeholder="Muhammad Amanullah"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="co-field">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="co-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '6px',
              padding: '16px',
              borderRadius: '999px',
              background: 'var(--deep-green)',
              color: '#ffffff',
              border: 'none',
              fontWeight: '800',
              fontSize: '0.92rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 8px 24px rgba(13,90,58,0.2)'
            }}
          >
            {loading ? 'Authenticating...' : isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Toggle Signup/Login */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => { setIsSignup(!isSignup); setError('') }}
            style={{ background: 'none', border: 'none', color: 'var(--deep-green)', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}
          >
            {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  )
}
