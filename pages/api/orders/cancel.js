import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'
import { withAuth } from '../../../lib/authMiddleware'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { orderId, cancellationReason } = req.body

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' })
    }

    const cleanId = String(orderId).replace(/^#/, '').trim()

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
        existingOrder.orderStatus = 'Cancelled'
        existingOrder.status = 'Cancelled'
        existingOrder.updatedAt = new Date()
        await existingOrder.save()
      }
    }

    // 2. Sync with Firestore Real-Time DB
    try {
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
      const { db } = await import('../../../lib/firebase')

      const fsDocRef = doc(db, 'orders', cleanId)
      await setDoc(fsDocRef, {
        orderStatus: 'Cancelled',
        status: 'Cancelled',
        updatedAt: serverTimestamp()
      }, { merge: true })
    } catch (fsErr) {
      console.warn('Firestore cancellation sync notice:', fsErr.message)
    }

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      orderId: cleanId
    })
  } catch (error) {
    console.error('Cancellation Error:', error)
    return res.status(500).json({ error: 'Failed to process cancellation request: ' + error.message })
  }
}

export default withAuth(handler)
