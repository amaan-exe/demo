import crypto from 'crypto'
import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'
import PaymentTransaction from '../../../models/PaymentTransaction'
import WebhookLog from '../../../models/WebhookLog'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

// Disable Next.js body parser to preserve raw request stream for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let rawBody
  try {
    rawBody = await getRawBody(req)
  } catch (err) {
    console.error('[Razorpay Webhook] Error reading raw body:', err)
    return res.status(400).json({ error: 'Failed to read request body' })
  }

  const webhookSignature = req.headers['x-razorpay-signature']
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  // 1. Signature Verification
  if (!webhookSignature) {
    console.warn('[Razorpay Webhook] Rejected: Missing x-razorpay-signature header')
    return res.status(400).json({ error: 'Missing x-razorpay-signature header' })
  }

  if (!webhookSecret || webhookSecret === 'your_webhook_secret_here') {
    console.error('[Razorpay Webhook] Rejected: RAZORPAY_WEBHOOK_SECRET not properly set in environment')
    return res.status(500).json({ error: 'Server webhook secret configuration missing' })
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')

  const isSignatureValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(webhookSignature)
  )

  if (!isSignatureValid) {
    console.error('[Razorpay Webhook] Rejected: Signature mismatch')
    return res.status(400).json({ error: 'Invalid webhook signature' })
  }

  // 2. Parse Event Payload
  let event
  try {
    event = JSON.parse(rawBody.toString('utf8'))
  } catch (err) {
    console.error('[Razorpay Webhook] Rejected: Malformed JSON body')
    return res.status(400).json({ error: 'Invalid JSON payload' })
  }

  const eventType = event.event
  const eventId = req.headers['x-razorpay-event-id'] || event.event_id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  console.log(`[Razorpay Webhook] Event received: ${eventType} (ID: ${eventId})`)

  // 3. Connect DB & Check Webhook Idempotency
  await connectDb().catch(err => console.warn('[Razorpay Webhook] DB Connect warning:', err.message))

  try {
    const existingLog = await WebhookLog.findOne({ eventId }).lean()
    if (existingLog) {
      console.log(`[Razorpay Webhook] Duplicate event detected (ID: ${eventId}). Skipping re-execution.`)
      return res.status(200).json({ status: 'duplicate', message: 'Event already processed', eventId })
    }
  } catch (dbErr) {
    console.warn('[Razorpay Webhook] Idempotency check DB warning:', dbErr.message)
  }

  const payloadEntity = event.payload?.payment?.entity || event.payload?.order?.entity || event.payload?.refund?.entity
  const razorpayPaymentId = event.payload?.payment?.entity?.id || event.payload?.refund?.entity?.payment_id || null
  const razorpayOrderId = event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id || null
  const internalOrderId = payloadEntity?.notes?.internalOrderId || null

  let processingError = null
  let processingStatus = 'PROCESSED'

  try {
    // 4. Process Specific Events
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const payment = event.payload?.payment?.entity
      if (payment && internalOrderId) {
        const amountInRupees = payment.amount ? payment.amount / 100 : 0
        const method = (payment.method || 'RAZORPAY').toUpperCase()

        // Update MongoDB PaymentTransaction
        await PaymentTransaction.findOneAndUpdate(
          { internalOrderId },
          {
            $set: {
              paymentId: razorpayPaymentId,
              razorpayOrderId: razorpayOrderId,
              internalOrderId: internalOrderId,
              amount: amountInRupees,
              status: 'DONE',
              razorpayStatus: 'captured',
              paymentMethod: method,
              methodDetails: {
                vpa: payment.vpa || null,
                cardNetwork: payment.card?.network || null,
                cardType: payment.card?.type || null,
                bank: payment.bank || null,
                wallet: payment.wallet || null,
              },
              customerEmail: payment.email || null,
              customerPhone: payment.contact || null,
              capturedAt: new Date(),
              lastWebhookEvent: eventType,
              razorpayEventId: eventId,
            },
            $push: {
              timeline: {
                event: `WEBHOOK_${eventType.toUpperCase().replace(/\./g, '_')}`,
                timestamp: new Date(),
                notes: `Payment captured successfully via Razorpay Webhook. Payment ID: ${razorpayPaymentId}`,
                source: 'WEBHOOK'
              }
            }
          },
          { upsert: true, new: true }
        )

        // Update MongoDB Order
        await Order.findOneAndUpdate(
          { orderId: internalOrderId },
          {
            paymentStatus: 'paid',
            orderStatus: 'confirmed',
            status: 'confirmed',
            customerMarkedPaid: true,
            razorpayPaymentId: razorpayPaymentId,
            razorpayOrderId: razorpayOrderId,
            transactionReference: razorpayPaymentId,
            paymentVerifiedBy: 'RAZORPAY_WEBHOOK',
            paymentVerifiedAt: new Date(),
            updatedAt: new Date(),
          }
        )

        // Update Firestore Order
        try {
          const orderRef = doc(db, 'orders', internalOrderId)
          const orderSnap = await getDoc(orderRef)
          if (orderSnap.exists()) {
            await updateDoc(orderRef, {
              paymentStatus: 'paid',
              orderStatus: 'confirmed',
              customerMarkedPaid: true,
              razorpayPaymentId: razorpayPaymentId,
              razorpayOrderId: razorpayOrderId,
              transactionReference: razorpayPaymentId,
              paymentVerifiedBy: 'RAZORPAY_WEBHOOK',
              paymentVerifiedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          }
        } catch (fsErr) {
          console.warn('[Razorpay Webhook] Firestore sync warning:', fsErr.message)
        }
      }
    } else if (eventType === 'payment.authorized') {
      const payment = event.payload?.payment?.entity
      if (payment && internalOrderId) {
        const amountInRupees = payment.amount ? payment.amount / 100 : 0
        await PaymentTransaction.findOneAndUpdate(
          { internalOrderId },
          {
            $set: {
              paymentId: razorpayPaymentId,
              razorpayOrderId: razorpayOrderId,
              internalOrderId,
              amount: amountInRupees,
              status: 'PENDING',
              razorpayStatus: 'authorized',
              authorizedAt: new Date(),
              lastWebhookEvent: eventType,
              razorpayEventId: eventId,
            },
            $push: {
              timeline: {
                event: 'WEBHOOK_PAYMENT_AUTHORIZED',
                timestamp: new Date(),
                notes: `Payment authorized by bank/gateway. Payment ID: ${razorpayPaymentId}`,
                source: 'WEBHOOK'
              }
            }
          },
          { upsert: true, new: true }
        )
      }
    } else if (eventType === 'payment.failed') {
      const payment = event.payload?.payment?.entity
      if (payment && internalOrderId) {
        const failureCode = payment.error_code || 'UNKNOWN_ERROR'
        const failureReason = payment.error_description || payment.error_reason || 'Payment failed on gateway'

        await PaymentTransaction.findOneAndUpdate(
          { internalOrderId },
          {
            $set: {
              paymentId: razorpayPaymentId,
              razorpayOrderId: razorpayOrderId,
              internalOrderId,
              amount: payment.amount ? payment.amount / 100 : 0,
              status: 'FAILED',
              razorpayStatus: 'failed',
              failureCode,
              failureReason,
              failedAt: new Date(),
              lastWebhookEvent: eventType,
              razorpayEventId: eventId,
            },
            $push: {
              timeline: {
                event: 'WEBHOOK_PAYMENT_FAILED',
                timestamp: new Date(),
                notes: `Payment failed: ${failureReason} (${failureCode})`,
                source: 'WEBHOOK'
              }
            }
          },
          { upsert: true, new: true }
        )

        await Order.findOneAndUpdate(
          { orderId: internalOrderId },
          {
            paymentStatus: 'payment_failed',
            orderStatus: 'payment_failed',
            rejectionReason: failureReason,
            updatedAt: new Date(),
          }
        )

        try {
          const orderRef = doc(db, 'orders', internalOrderId)
          const orderSnap = await getDoc(orderRef)
          if (orderSnap.exists()) {
            await updateDoc(orderRef, {
              paymentStatus: 'payment_failed',
              orderStatus: 'payment_failed',
              rejectionReason: failureReason,
              updatedAt: serverTimestamp(),
            })
          }
        } catch (fsErr) {
          console.warn('[Razorpay Webhook] Firestore failure sync warning:', fsErr.message)
        }
      }
    } else {
      processingStatus = 'IGNORED'
    }
  } catch (err) {
    console.error(`[Razorpay Webhook] Error processing event ${eventType}:`, err)
    processingError = err.message
    processingStatus = 'FAILED'
  }

  // 5. Store Webhook Log for Audit & Idempotency
  try {
    await WebhookLog.create({
      eventId,
      eventType,
      receivedAt: new Date(),
      processedAt: new Date(),
      processingStatus,
      razorpayPaymentId,
      razorpayOrderId,
      internalOrderId,
      payload: {
        event: event.event,
        created_at: event.created_at,
        contains: event.contains,
      },
      error: processingError,
    })
  } catch (logErr) {
    console.warn('[Razorpay Webhook] Log save warning:', logErr.message)
  }

  return res.status(200).json({
    status: processingStatus.toLowerCase(),
    eventId,
    eventType,
    internalOrderId
  })
}
