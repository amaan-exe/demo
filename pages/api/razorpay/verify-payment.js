import crypto from 'crypto'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId, userId, userEmail, customerName, customerPhone, deliveryAddress } = req.body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature',
      })
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET

    if (!key_secret) {
      console.error('RAZORPAY_KEY_SECRET not configured in environment variables')
      return res.status(500).json({ error: 'Payment gateway not configured' })
    }

    // HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(body)
      .digest('hex')

    const isValid = expectedSignature === razorpay_signature

    if (!isValid) {
      // Signature mismatch — do NOT mark as paid
      return res.status(400).json({
        success: false,
        error: 'Payment signature verification failed. Do not fulfil this order.',
      })
    }

    // --- Signature valid ---

    // Guard: if orderId is missing, signature is valid but we can't update any order record
    if (!orderId) {
      console.warn('verify-payment: Signature valid but orderId missing. Client should trigger reconciliation.')
      return res.status(200).json({
        success: true,
        signatureValid: true,
        orderUpdateSkipped: true,
        message: 'Payment signature verified but orderId was missing. Use reconciliation to update order.',
        razorpay_order_id,
        razorpay_payment_id,
      })
    }

    // --- Update Firestore (awaited, not fire-and-forget) ---
    let firestoreUpdated = false
    const orderRef = doc(db, 'orders', orderId)
    const updatePayload = {
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      customerMarkedPaid: true,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      transactionReference: razorpay_payment_id,
      paymentVerifiedBy: 'CLIENT_VERIFY',
      paymentVerifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    if (userId) updatePayload.userId = userId
    if (userEmail) {
      updatePayload.userEmail = userEmail
      updatePayload.customerEmail = userEmail
    }
    if (customerName) updatePayload.customerName = customerName
    if (customerPhone) updatePayload.customerPhone = customerPhone
    if (deliveryAddress) updatePayload.deliveryAddress = deliveryAddress

    try {
      await setDoc(orderRef, updatePayload, { merge: true })
      firestoreUpdated = true
    } catch (fsErr) {
      console.error('Firestore setDoc error in verify-payment:', fsErr)
    }

    // MongoDB Order & PaymentTransaction Sync (non-blocking background)
    ;(async () => {
      try {
        const { connectDb } = await import('../../../lib/db')
        const Order = (await import('../../../models/Order')).default
        const PaymentTransaction = (await import('../../../models/PaymentTransaction')).default
        await connectDb()

        await Order.findOneAndUpdate(
          { orderId },
          {
            paymentStatus: 'paid',
            orderStatus: 'confirmed',
            status: 'confirmed',
            customerMarkedPaid: true,
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            razorpaySignature: razorpay_signature,
            transactionReference: razorpay_payment_id,
            paymentVerifiedBy: 'CLIENT_VERIFY',
            paymentVerifiedAt: new Date(),
            updatedAt: new Date(),
          }
        ).catch(() => {})

        await PaymentTransaction.findOneAndUpdate(
          { internalOrderId: orderId },
          {
            $set: {
              paymentId: razorpay_payment_id,
              razorpayOrderId: razorpay_order_id,
              status: 'DONE',
              razorpayStatus: 'captured',
              capturedAt: new Date(),
            },
            $push: {
              timeline: {
                event: 'CLIENT_VERIFICATION_SUCCESS',
                timestamp: new Date(),
                notes: `Client payment response verified via HMAC-SHA256. Payment ID: ${razorpay_payment_id}`,
                source: 'CLIENT_CHECKOUT'
              }
            }
          },
          { upsert: true, new: true }
        ).catch(() => {})
      } catch (mongoErr) {
        console.warn('MongoDB bg sync error in verify-payment:', mongoErr.message)
      }
    })()

    return res.status(200).json({
      success: true,
      signatureValid: true,
      orderUpdateSkipped: false,
      message: 'Payment verified successfully',
      razorpay_order_id,
      razorpay_payment_id,
      orderId,
      firestoreUpdated,
    })
  } catch (error) {
    console.error('Razorpay Verify Payment Error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Payment verification failed',
    })
  }
}

