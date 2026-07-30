import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const [activeSnap, archiveSnap] = await Promise.all([
      getDocs(collection(db, 'orders')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'orders_archive')).catch(() => ({ docs: [] }))
    ])

    const allDocs = [...(activeSnap.docs || []), ...(archiveSnap.docs || [])]

    const orders = allDocs.map(docSnap => {
      const data = docSnap.data()
      let createdAtStr = new Date().toISOString()
      let createdAtSeconds = Math.floor(Date.now() / 1000)

      try {
        if (data.createdAt?.toDate) {
          const d = data.createdAt.toDate()
          createdAtStr = d.toISOString()
          createdAtSeconds = Math.floor(d.getTime() / 1000)
        } else if (data.createdAtSeconds) {
          createdAtSeconds = data.createdAtSeconds
          createdAtStr = new Date(data.createdAtSeconds * 1000).toISOString()
        } else if (data.createdAt) {
          const d = new Date(data.createdAt)
          createdAtStr = d.toISOString()
          createdAtSeconds = Math.floor(d.getTime() / 1000)
        }
      } catch (e) {}

      return {
        id: docSnap.id,
        orderId: data.orderId || docSnap.id,
        ...data,
        createdAt: createdAtStr,
        createdAtSeconds
      }
    })

    orders.sort((a, b) => (b.createdAtSeconds || 0) - (a.createdAtSeconds || 0))

    return res.status(200).json({ success: true, orders })
  } catch (error) {
    console.warn('Admin All Orders API Error:', error.message)
    return res.status(200).json({ success: true, orders: [] })
  }
}
