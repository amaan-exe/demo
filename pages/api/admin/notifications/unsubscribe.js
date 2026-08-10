import { withAuth } from '../../../../lib/authMiddleware'
import { connectDb } from '../../../../lib/db'
import AdminSubscription from '../../../../models/AdminSubscription'
import { doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../../../lib/firebase'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { endpoint } = req.body

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint to unsubscribe' })
    }

    // 1. Remove from MongoDB (if connected)
    try {
      const conn = await connectDb()
      if (conn && mongoose.connection.readyState === 1) {
        await AdminSubscription.deleteOne({ endpoint })
      }
    } catch (mongoErr) {
      console.warn('MongoDB AdminSubscription delete warning:', mongoErr.message)
    }

    // 2. Remove from Firestore
    try {
      const docId = Buffer.from(endpoint).toString('base64').replace(/\//g, '_').replace(/\+/g, '-').substring(0, 60)
      await deleteDoc(doc(db, 'admin_notification_subscriptions', docId)).catch(() => {})
    } catch (fsErr) {
      console.warn('Firestore unsubscribe warning:', fsErr.message)
    }

    return res.status(200).json({
      success: true,
      message: 'Admin push notification subscription removed successfully',
    })
  } catch (error) {
    console.error('Unsubscribe Admin Notification Error:', error)
    return res.status(500).json({ error: error.message || 'Failed to remove notification subscription' })
  }
}

export default withAuth(handler, true)
