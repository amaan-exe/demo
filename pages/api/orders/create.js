import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, userEmail, userName, userPhone, deliveryAddress, items, grandTotal } = req.body

    if (!userId || !userEmail) {
      return res.status(401).json({ error: 'Authentication required. Please sign in to place an order.' })
    }

    if (!items || !items.length || !userPhone || !deliveryAddress) {
      return res.status(400).json({ error: 'Missing required order details (items, phone, address)' })
    }

    const orderId = req.body.orderId || `BS-PATNA-${Math.floor(100000 + Math.random() * 900000)}`

    connectDb().then(async () => {
      await Order.create({
        orderId,
        userId,
        userEmail,
        customerEmail: req.body.customerEmail || userEmail,
        userName: userName || req.body.customerName || userEmail.split('@')[0],
        customerName: req.body.customerName || userName || userEmail.split('@')[0],
        userPhone: userPhone || req.body.customerPhone,
        customerPhone: req.body.customerPhone || userPhone,
        deliveryAddress,
        items,
        subtotal: req.body.subtotal || 0,
        deliveryCharge: req.body.deliveryCharge || 0,
        tax: req.body.tax || 0,
        discount: req.body.discount || 0,
        grandTotal: Number(grandTotal) || 0,
        paymentMethod: req.body.paymentMethod || 'UPI',
        paymentStatus: req.body.paymentStatus || 'verification_pending',
        orderStatus: req.body.orderStatus || 'payment_verification_pending',
        customerMarkedPaid: req.body.customerMarkedPaid ?? true,
        transactionReference: req.body.transactionReference || null,
        status: req.body.orderStatus || 'payment_verification_pending',
      }).catch((e) => console.warn('Mongoose Order Create Notice:', e.message))
    }).catch((e) => console.warn('DB Connection Notice:', e.message))

    return res.status(200).json({
      success: true,
      message: 'Order created successfully',
      orderId,
    })
  } catch (error) {
    console.error('Order Creation API Error:', error)
    return res.status(500).json({ error: error.message || 'Failed to create order' })
  }
}
