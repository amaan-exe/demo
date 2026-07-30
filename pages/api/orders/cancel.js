import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'
import { withAuth } from '../../../lib/authMiddleware'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { orderId, cancellationReason, userEmail, userId } = req.body

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' })
    }

    const cleanId = String(orderId).replace(/^#/, '').trim()

    const refundData = {
      requested: true,
      status: 'REFUND_PENDING',
      requestedAt: new Date().toISOString(),
      processingAt: null,
      refundedAt: null,
      refundedBy: null,
      amount: 0,
      cancellationReason: cancellationReason || 'Customer requested cancellation'
    }

    // 1. Sync with MongoDB
    const conn = await connectDb()
    let existingOrder = null
    if (conn) {
      existingOrder = await Order.findOne({
        $or: [
          { orderId: cleanId },
          { orderId: `#${cleanId}` },
          { _id: cleanId }
        ]
      })

      if (existingOrder) {
        const currentStatus = (existingOrder.orderStatus || existingOrder.status || '').toLowerCase()
        if (currentStatus === 'delivered' || currentStatus === 'cancelled' || currentStatus === 'refunded') {
          return res.status(400).json({ error: `Cannot cancel order that is already ${currentStatus}` })
        }
        refundData.amount = existingOrder.grandTotal || existingOrder.amount || 0
        existingOrder.orderStatus = 'REFUND_PENDING'
        existingOrder.status = 'REFUND_PENDING'
        existingOrder.refund = refundData
        existingOrder.updatedAt = new Date()
        await existingOrder.save()
      }
    }

    // 2. Sync with Firestore Real-Time DB
    try {
      const { doc, updateDoc, setDoc, getDoc, serverTimestamp } = await import('firebase/firestore')
      const { db } = await import('../../../lib/firebase')

      const fsDocRef = doc(db, 'orders', cleanId)
      const fsSnap = await getDoc(fsDocRef)

      if (fsSnap.exists()) {
        const fsData = fsSnap.data()
        const currentFsStatus = (fsData.orderStatus || fsData.status || '').toLowerCase()
        if (currentFsStatus === 'delivered' || currentFsStatus === 'cancelled' || currentFsStatus === 'refunded') {
          return res.status(400).json({ error: `Cannot cancel order that is already ${currentFsStatus}` })
        }
        if (!refundData.amount) refundData.amount = fsData.grandTotal || fsData.amount || 0
        await updateDoc(fsDocRef, {
          orderStatus: 'REFUND_PENDING',
          status: 'REFUND_PENDING',
          updatedAt: serverTimestamp(),
          refund: refundData
        })
      } else {
        await setDoc(fsDocRef, {
          orderId: cleanId,
          orderStatus: 'REFUND_PENDING',
          status: 'REFUND_PENDING',
          updatedAt: serverTimestamp(),
          refund: refundData
        }, { merge: true })
      }
    } catch (fsErr) {
      console.warn('Firestore cancellation sync notice:', fsErr.message)
    }

    try {
      const { archiveOrderIfCompleted } = await import('../../../lib/ordersArchive')
      await archiveOrderIfCompleted(cleanId)
    } catch (e) {
      console.warn('Archival check failed:', e.message)
    }

    return res.status(200).json({
      success: true,
      message: 'Order cancellation requested successfully and submitted to Refund Queue',
      refund: refundData
    })
  } catch (error) {
    console.error('Cancellation Error:', error)
    return res.status(500).json({ error: 'Failed to process cancellation request: ' + error.message })
  }
}

export default withAuth(handler)

