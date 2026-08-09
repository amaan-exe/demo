import Razorpay from 'razorpay'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { amount, currency, receipt, orderDetails } = req.body

    // amount comes from frontend in rupees — convert to paise
    const amountInPaise = Math.round(Number(amount) * 100)

    // Razorpay minimum is 100 paise (₹1)
    if (!amount || isNaN(amount) || amountInPaise < 100) {
      return res.status(400).json({ error: 'Amount must be at least ₹1 (100 paise)' })
    }

    const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const key_secret = process.env.RAZORPAY_KEY_SECRET

    if (!key_id || !key_secret) {
      console.error('Razorpay credentials not configured in environment variables')
      return res.status(500).json({ error: 'Payment gateway not configured' })
    }

    // --- STEP 1: Generate internal Order ID ---
    const ts = Date.now().toString(36).toUpperCase()
    const rnd = Math.floor(1000 + Math.random() * 9000).toString()
    const orderId = `BS-PATNA-${ts}-${rnd}`

    // --- STEP 2: Create Razorpay order with our orderId in notes ---
    const instance = new Razorpay({ key_id, key_secret })

    const razorpayOrder = await instance.orders.create({
      amount: amountInPaise,
      currency: currency || 'INR',
      receipt: receipt || orderId,
      notes: {
        internalOrderId: orderId,
        customerName: orderDetails?.customerName || '',
        customerPhone: orderDetails?.customerPhone || '',
      },
    })

    // --- STEP 3: Pre-create order record in Firestore synchronously ---
    if (orderDetails) {
      const discountValue = orderDetails.coupon ? orderDetails.coupon.discount : 0

      const firestorePayload = {
        orderId,
        userId: orderDetails.userId || 'GUEST',
        userEmail: orderDetails.userEmail || 'guest@biriyanistation.in',
        customerName: orderDetails.customerName || '',
        customerEmail: orderDetails.userEmail || 'guest@biriyanistation.in',
        customerPhone: orderDetails.customerPhone || '',
        deliveryAddress: orderDetails.deliveryAddress || '',
        items: orderDetails.items || [],
        subtotal: Number(orderDetails.subtotal) || 0,
        deliveryCharge: Number(orderDetails.deliveryCharge) || 0,
        tax: 0,
        discount: discountValue,
        appliedCoupon: orderDetails.coupon ? orderDetails.coupon.code : null,
        grandTotal: Number(amount) || 0,
        paymentMethod: 'RAZORPAY',
        paymentStatus: 'awaiting_payment',
        orderStatus: 'awaiting_payment',
        customerMarkedPaid: false,
        transactionReference: null,
        razorpayPaymentId: null,
        razorpayOrderId: razorpayOrder.id,
        razorpaySignature: null,
        paymentVerifiedBy: null,
        paymentVerifiedAt: null,
        rejectionReason: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      try {
        await setDoc(doc(db, 'orders', orderId), firestorePayload)
      } catch (fsErr) {
        console.warn('Firestore pre-create warning:', fsErr.message)
      }
    }

    // --- STEP 4: Return response for popup ---
    res.status(200).json({
      success: true,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id,
      orderId, // internal order ID for the frontend
    })

    // --- STEP 5: Background MongoDB pre-creation ---
    ;(async () => {
      try {
        const { connectDb } = await import('../../../lib/db')
        const PaymentTransaction = (await import('../../../models/PaymentTransaction')).default
        const Order = (await import('../../../models/Order')).default
        await connectDb()

        await PaymentTransaction.findOneAndUpdate(
          { internalOrderId: orderId },
          {
            $set: {
              internalOrderId: orderId,
              razorpayOrderId: razorpayOrder.id,
              amount: Number(amount) || 0,
              currency: currency || 'INR',
              status: 'PENDING',
              razorpayStatus: 'created',
              paymentMethod: 'RAZORPAY',
              customerName: orderDetails?.customerName || '',
              customerEmail: orderDetails?.userEmail || '',
              customerPhone: orderDetails?.customerPhone || '',
            },
            $push: {
              timeline: {
                event: 'ORDER_CREATED',
                timestamp: new Date(),
                notes: `Razorpay Order Created (${razorpayOrder.id}) for ₹${amount}`,
                source: 'CLIENT_CHECKOUT'
              }
            }
          },
          { upsert: true, new: true }
        ).catch(() => {})

        if (orderDetails) {
          const discountValue = orderDetails.coupon ? orderDetails.coupon.discount : 0
          await Order.findOneAndUpdate(
            { orderId },
            {
              $set: {
                orderId,
                userId: orderDetails.userId || 'GUEST',
                userEmail: orderDetails.userEmail || orderDetails.customerEmail || 'guest@biriyanistation.in',
                customerEmail: orderDetails.userEmail || orderDetails.customerEmail || '',
                userName: orderDetails.customerName || '',
                customerName: orderDetails.customerName || '',
                userPhone: orderDetails.customerPhone || '',
                customerPhone: orderDetails.customerPhone || '',
                deliveryAddress: orderDetails.deliveryAddress || '',
                items: orderDetails.items || [],
                subtotal: Number(orderDetails.subtotal) || 0,
                deliveryCharge: Number(orderDetails.deliveryCharge) || 0,
                tax: 0,
                discount: discountValue,
                appliedCoupon: orderDetails.coupon ? orderDetails.coupon.code : null,
                grandTotal: Number(amount) || 0,
                paymentMethod: 'RAZORPAY',
                paymentStatus: 'awaiting_payment',
                orderStatus: 'awaiting_payment',
                status: 'awaiting_payment',
                customerMarkedPaid: false,
                razorpayOrderId: razorpayOrder.id,
                updatedAt: new Date()
              }
            },
            { upsert: true, new: true }
          ).catch(() => {})
        }
      } catch (ptErr) {
        console.warn('PaymentTransaction/Order bg init warning:', ptErr.message)
      }
    })()
  } catch (error) {
    console.error('Razorpay Create Order Error:', error)

    if (error.statusCode === 401) {
      return res.status(401).json({ error: 'Razorpay authentication failed. Check API keys.' })
    }

    return res.status(500).json({
      error: error.error?.description || error.message || 'Failed to create Razorpay order',
    })
  }
}
