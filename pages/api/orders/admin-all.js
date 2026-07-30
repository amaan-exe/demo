import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'
import { withAuth } from '../../../lib/authMiddleware'

async function handler(req, res) {
  try {
    const conn = await connectDb()
    if (!conn) {
      return res.status(500).json({ error: 'Database connection failed' })
    }

    const { page = 1, limit = 50, search = '' } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    let query = {}
    if (search) {
      query = {
        $or: [
          { orderId: { $regex: search, $options: 'i' } },
          { customerPhone: { $regex: search, $options: 'i' } },
          { customerEmail: { $regex: search, $options: 'i' } },
          { customerName: { $regex: search, $options: 'i' } }
        ]
      }
    }

    const total = await Order.countDocuments(query)
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()

    return res.status(200).json({ 
      orders, 
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' })
  }
}

export default withAuth(handler)
