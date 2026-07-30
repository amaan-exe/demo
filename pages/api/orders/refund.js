import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'
import { withAuth } from '../../../lib/authMiddleware'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { orderId, action, adminEmail } = req.body

    if (!orderId || !action) {
      return res.status(400).json({ error: 'Order ID and action are required' })
    }

    const cleanId = String(orderId).replace(/^#/, '').trim()
    const targetStatus = action === 'COMPLETE_REFUND' ? 'REFUNDED' : 'REFUND_PROCESSING'

    // 1. Sync with MongoDB
    const conn = await connectDb()
    if (conn) {
      const existingOrder = await Order.findOne({
        $or: [
          { orderId: cleanId },
          { orderId: `#${cleanId}` },
          { _id: cleanId }
        ]
      })

      if (existingOrder) {
        const currentRefund = existingOrder.refund || {}
        existingOrder.orderStatus = targetStatus
        existingOrder.status = targetStatus
        if (action === 'COMPLETE_REFUND') existingOrder.paymentStatus = 'refunded'

        existingOrder.refund = {
          ...currentRefund,
          requested: true,
          status: targetStatus,
          processingAt: action === 'START_PROCESSING' ? new Date() : currentRefund.processingAt,
          refundedAt: action === 'COMPLETE_REFUND' ? new Date() : currentRefund.refundedAt,
          refundedBy: action === 'COMPLETE_REFUND' ? (adminEmail || 'Admin') : currentRefund.refundedBy
        }
        existingOrder.updatedAt = new Date()
        await existingOrder.save()
      }
    }

    // 2. Sync with Firestore Real-Time DB
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
      const { db } = await import('../../../lib/firebase')

      const fsDocRef = doc(db, 'orders', cleanId)
      const updatePayload = {
        orderStatus: targetStatus,
        status: targetStatus,
        updatedAt: serverTimestamp(),
        'refund.status': targetStatus,
        'refund.requested': true
      }

      if (action === 'START_PROCESSING') {
        updatePayload['refund.processingAt'] = new Date().toISOString()
      } else if (action === 'COMPLETE_REFUND') {
        updatePayload.paymentStatus = 'refunded'
        updatePayload['refund.refundedAt'] = new Date().toISOString()
        updatePayload['refund.refundedBy'] = adminEmail || 'Admin'
      }

      await updateDoc(fsDocRef, updatePayload).catch(e => console.warn('Firestore refund sync notice:', e.message))
    } catch (fsErr) {
      console.warn('Firestore refund sync error:', fsErr.message)
    }

    try {
      const { archiveOrderIfCompleted } = await import('../../../lib/ordersArchive')
      await archiveOrderIfCompleted(cleanId)
    } catch (e) {
      console.warn('Archival check failed:', e.message)
    }

    return res.status(200).json({
      success: true,
      message: `Refund status updated to ${targetStatus}`
    })
  } catch (error) {
    console.error('Refund Processing Error:', error)
    return res.status(500).json({ error: 'Failed to process refund: ' + error.message })
  }
}

export default withAuth(handler, true)

