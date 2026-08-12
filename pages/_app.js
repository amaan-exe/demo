import { useEffect } from 'react'
import '../styles/globals.css'
import Head from 'next/head'
import { AuthProvider } from '../context/AuthContext'
import { SettingsProvider } from '../context/SettingsContext'
import { OrdersProvider } from '../context/OrdersContext'
import AuthModal from '../components/AuthModal'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // 1. Harmless Network Error Suppression
    const handleUnhandledRejection = (event) => {
      const reason = event?.reason
      const msg = (reason?.message || String(reason || '')).toLowerCase()
      const name = reason?.name || ''
      const stack = (reason?.stack || '').toLowerCase()

      const isHarmlessNetworkError =
        name === 'AbortError' ||
        msg.includes('failed to fetch') ||
        msg.includes('signal is aborted') ||
        msg.includes('webchannel') ||
        msg.includes('aborted') ||
        stack.includes('webchannel') ||
        stack.includes('injectscriptadjust')

      if (isHarmlessNetworkError) {
        event.preventDefault()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handleUnhandledRejection)
    }

    // 2. Global UPI / Razorpay App Handoff Recovery
    // When returning from UPI app (GPay/PhonePe), browser might have reloaded.
    const runRecovery = async () => {
      try {
        const rawPending = typeof window !== 'undefined' ? sessionStorage.getItem('pending_razorpay_checkout') : null
        if (rawPending) {
          const pending = JSON.parse(rawPending)
          const targetOrderId = pending.internalOrderId
          if (targetOrderId && pending.razorpayOrderId) {
            console.log('🔄 Global recovery: found pending checkout, polling Razorpay API...')
            // Wait 2 seconds to give Razorpay webhook a head start
            await new Promise(r => setTimeout(r, 2000))
            const res = await fetch('/api/razorpay/reconcile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                internalOrderId: targetOrderId,
                razorpayOrderId: pending.razorpayOrderId
              })
            })
            if (res.ok) {
              const data = await res.json()
              if (data.success && data.status === 'DONE') {
                console.log('🎉 Global recovery: Payment verified successfully.')
                sessionStorage.removeItem('pending_razorpay_checkout')
                if (window.location.pathname !== '/my-orders') {
                  window.location.href = `/my-orders?orderId=${targetOrderId}&success=1`
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Global recovery check notice:', err)
      }
    }

    runRecovery()

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      }
    }
  }, [])

  return (
    <AuthProvider>
      <SettingsProvider>
        <OrdersProvider>
          <Head>
            <meta charSet="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Biriyani Station Patna | Charcoal Kawabs & Dum Biryanis</title>
            <meta name="description" content="Biriyani Station - Dum Pukht biryani & clay-oven tandoori kawabs, slow-cooked over real fire." />
          </Head>
          <Component {...pageProps} />
          <AuthModal />
        </OrdersProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
