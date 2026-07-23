import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'

export default async function handler(req, res) {
  try {
    const conn = await connectDb()
    if (!conn) {
      return res.status(200).json({ success: true, orders: [] })
    }
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean()
    return res.status(200).json({ success: true, orders: orders || [] })
  } catch (error) {
    return res.status(200).json({ success: true, orders: [] })
  }
}
