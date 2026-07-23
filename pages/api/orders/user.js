import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    const ordersRef = collection(db, 'orders')
    // Simple query without orderBy to avoid composite index requirement on server
    const q = query(ordersRef, where('userId', '==', userId))
    const snapshot = await getDocs(q)

    const orders = snapshot.docs.map(doc => {
      const data = doc.data()
      let createdAtStr = new Date().toISOString()
      try {
        if (data.createdAt?.toDate) {
          createdAtStr = data.createdAt.toDate().toISOString()
        } else if (data.createdAt) {
          createdAtStr = new Date(data.createdAt).toISOString()
        }
      } catch (e) {}

      return {
        id: doc.id,
        orderId: data.orderId || doc.id,
        ...data,
        createdAt: createdAtStr
      }
    })

    // Sort by createdAt descending in JavaScript (avoids Firestore composite index)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return res.status(200).json({ success: true, orders })
  } catch (error) {
    console.warn('User Orders API Notice:', error.message)
    return res.status(200).json({ success: true, orders: [] })
  }
}
