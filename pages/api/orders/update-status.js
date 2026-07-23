import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { orderId, paymentStatus, orderStatus, rejectionReason } = req.body

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID required' })
    }

    const conn = await connectDb()
    if (!conn) {
      return res.status(200).json({ success: true, message: 'Updated in Firestore only' })
    }

    const updateFields = { updatedAt: new Date() }
    if (paymentStatus) updateFields.paymentStatus = paymentStatus
    if (orderStatus) {
      updateFields.orderStatus = orderStatus
      updateFields.status = orderStatus
    }
    if (rejectionReason) updateFields.rejectionReason = rejectionReason

    const updated = await Order.findOneAndUpdate({ orderId }, updateFields, { new: true })

    return res.status(200).json({ success: true, order: updated })
  } catch (error) {
    return res.status(200).json({ success: true, message: 'Notice: ' + error.message })
  }
}
