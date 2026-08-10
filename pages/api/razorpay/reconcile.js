import Razorpay from 'razorpay'
import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'
import PaymentTransaction from '../../../models/PaymentTransaction'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { internalOrderId, paymentId, razorpayOrderId } = req.body

    if (!internalOrderId && !paymentId && !razorpayOrderId) {
      return res.status(400).json({ error: 'Provide at least internalOrderId, paymentId, or razorpayOrderId' })
    }

    const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const key_secret = process.env.RAZORPAY_KEY_SECRET

    if (!key_id || !key_secret) {
      return res.status(500).json({ error: 'Razorpay API keys not configured on server' })
    }

    const instance = new Razorpay({ key_id, key_secret })
    await connectDb()

    // 1. Locate local PaymentTransaction or Order record
    let query = {}
    if (internalOrderId) query.internalOrderId = internalOrderId
    else if (paymentId) query.paymentId = paymentId
    else if (razorpayOrderId) query.razorpayOrderId = razorpayOrderId

    let tx = await PaymentTransaction.findOne(query)
    let order = await Order.findOne(internalOrderId ? { orderId: internalOrderId } : query)

    const rzpOrderIdToFetch = razorpayOrderId || tx?.razorpayOrderId || order?.razorpayOrderId
    const rzpPaymentIdToFetch = paymentId || tx?.paymentId || order?.razorpayPaymentId

    let fetchedPayment = null
    let fetchedOrder = null

    // 2. Fetch directly from Razorpay API
    if (rzpPaymentIdToFetch) {
      try {
        fetchedPayment = await instance.payments.fetch(rzpPaymentIdToFetch)
      } catch (err) {
        console.warn('Razorpay payment fetch notice:', err.message)
      }
    }

    if (!fetchedPayment && rzpOrderIdToFetch) {
      try {
        const paymentsList = await instance.orders.fetchPayments(rzpOrderIdToFetch)
        if (paymentsList?.items?.length > 0) {
          // Get latest or captured payment
          fetchedPayment = paymentsList.items.find(p => p.status === 'captured') || paymentsList.items[0]
        }
        fetchedOrder = await instance.orders.fetch(rzpOrderIdToFetch)
      } catch (err) {
        console.warn('Razorpay order fetch notice:', err.message)
      }
    }

    if (!fetchedPayment && !fetchedOrder) {
      return res.status(200).json({
        success: true,
        status: 'PENDING',
        razorpayStatus: 'created',
        message: 'No payment transaction captured on Razorpay yet. Payment remains pending.'
      })
    }

    const rzpStatus = fetchedPayment?.status || fetchedOrder?.status || 'unknown'
    let appStatus = 'PENDING'
    if (rzpStatus === 'captured' || rzpStatus === 'paid') {
      appStatus = 'DONE'
    } else if (rzpStatus === 'failed') {
      appStatus = 'FAILED'
    }

    const targetOrderId = internalOrderId || tx?.internalOrderId || order?.orderId

    // 3. Update PaymentTransaction record
    if (targetOrderId) {
      const updatePayload = {
        status: appStatus,
        razorpayStatus: rzpStatus,
        updatedAt: new Date(),
      }

      if (fetchedPayment) {
        updatePayload.paymentId = fetchedPayment.id
        updatePayload.razorpayOrderId = fetchedPayment.order_id || rzpOrderIdToFetch
        updatePayload.amount = fetchedPayment.amount / 100
        updatePayload.paymentMethod = (fetchedPayment.method || 'RAZORPAY').toUpperCase()
        updatePayload.methodDetails = {
          vpa: fetchedPayment.vpa || null,
          cardNetwork: fetchedPayment.card?.network || null,
          cardType: fetchedPayment.card?.type || null,
          bank: fetchedPayment.bank || null,
          wallet: fetchedPayment.wallet || null,
        }
        if (fetchedPayment.error_code) {
          updatePayload.failureCode = fetchedPayment.error_code
          updatePayload.failureReason = fetchedPayment.error_description || fetchedPayment.error_reason
        }
      }

      tx = await PaymentTransaction.findOneAndUpdate(
        { internalOrderId: targetOrderId },
        {
          $set: updatePayload,
          $push: {
            timeline: {
              event: 'RECONCILIATION_CHECK',
              timestamp: new Date(),
              notes: `Reconciliation check with Razorpay API. Status: ${rzpStatus} (App: ${appStatus})`,
              source: 'RECONCILIATION'
            }
          }
        },
        { upsert: true, new: true }
      )

      // 4. Update Order status if payment is confirmed
      const orderPaymentStatus = appStatus === 'DONE' ? 'paid' : (appStatus === 'FAILED' ? 'payment_failed' : 'awaiting_payment')
      const orderStatus = appStatus === 'DONE' ? 'confirmed' : (appStatus === 'FAILED' ? 'payment_failed' : 'awaiting_payment')

      await Order.findOneAndUpdate(
        { orderId: targetOrderId },
        {
          paymentStatus: orderPaymentStatus,
          orderStatus: orderStatus,
          status: orderStatus,
          customerMarkedPaid: appStatus === 'DONE',
          razorpayPaymentId: fetchedPayment?.id || tx?.paymentId,
          razorpayOrderId: rzpOrderIdToFetch,
          paymentVerifiedBy: 'RECONCILIATION_CHECK',
          paymentVerifiedAt: new Date(),
          updatedAt: new Date(),
        }
      )

      try {
        const orderRef = doc(db, 'orders', targetOrderId)
        await setDoc(orderRef, {
          paymentStatus: orderPaymentStatus,
          orderStatus: orderStatus,
          customerMarkedPaid: appStatus === 'DONE',
          razorpayPaymentId: fetchedPayment?.id || tx?.paymentId,
          razorpayOrderId: rzpOrderIdToFetch,
          paymentVerifiedBy: 'RECONCILIATION_CHECK',
          paymentVerifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true })
      } catch (fsErr) {
        console.warn('Reconcile Firestore update warning:', fsErr.message)
      }

      if (appStatus === 'DONE' && targetOrderId) {
        try {
          const { sendOrderNotification } = await import('../../../lib/orderNotification')
          const orderDoc = await Order.findOne({ orderId: targetOrderId }).lean()
          await sendOrderNotification({
            orderId: targetOrderId,
            grandTotal: orderDoc?.grandTotal || (fetchedPayment ? fetchedPayment.amount / 100 : 0),
            items: orderDoc?.items || [],
            customerName: orderDoc?.customerName || orderDoc?.userName || '',
            userName: orderDoc?.userName || '',
            customerPhone: orderDoc?.customerPhone || orderDoc?.userPhone || '',
            deliveryAddress: orderDoc?.deliveryAddress || '',
            paymentMethod: 'Razorpay (Reconciled)',
            paymentStatus: 'paid'
          })
        } catch (notifErr) {
          console.warn('[Reconcile] Notification dispatch notice:', notifErr.message)
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Payment reconciled successfully with Razorpay API',
      status: appStatus,
      razorpayStatus: rzpStatus,
      payment: fetchedPayment,
      transaction: tx
    })
  } catch (error) {
    console.error('Razorpay Reconcile API Error:', error)
    return res.status(500).json({ error: error.message || 'Failed to reconcile payment' })
  }
}

