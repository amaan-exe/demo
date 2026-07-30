import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'
import { withAuth } from '../../../lib/authMiddleware'

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    const conn = await connectDb()
    if (!conn) {
      return res.status(500).json({ error: 'Database connection failed' })
    }

    // Fetch all historical orders for this user from MongoDB
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean()

    // Format dates to string to prevent serialization issues
    const formattedOrders = orders.map(order => ({
      ...order,
      _id: order._id.toString(),
      id: order._id.toString(),
      orderId: order.orderId || order._id.toString(),
      createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString()
    }))

    return res.status(200).json({ success: true, orders: formattedOrders })
  } catch (error) {
    console.error('User Orders API Error:', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch user orders', orders: [] })
  }
}

export default withAuth(handler)
