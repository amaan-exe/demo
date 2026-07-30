import { collection, query, where, getDocs } from 'firebase/firestore'
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
    const activeQ = query(collection(db, 'orders'), where('userId', '==', userId))
    const archiveQ = query(collection(db, 'orders_archive'), where('userId', '==', userId))

    const [activeSnap, archiveSnap] = await Promise.all([
      getDocs(activeQ).catch(() => ({ docs: [] })),
      getDocs(archiveQ).catch(() => ({ docs: [] }))
    ])

    const allDocs = [...(activeSnap.docs || []), ...(archiveSnap.docs || [])]

    const orders = allDocs.map(doc => {
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

    // Sort by createdAt descending in JavaScript
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return res.status(200).json({ success: true, orders })
  } catch (error) {
    console.warn('User Orders API Notice:', error.message)
    return res.status(200).json({ success: true, orders: [] })
  }
}
