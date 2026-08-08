import { connectDb } from '../../../../lib/db'
import WebhookLog from '../../../../models/WebhookLog'
import { withAuth } from '../../../../lib/authMiddleware'

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const conn = await connectDb()
    if (!conn) {
      return res.status(200).json({
        success: true,
        logs: [],
        pagination: { total: 0, page: 1, pages: 1 }
      })
    }

    const { page = 1, limit = 30 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [logs, total] = await Promise.all([
      WebhookLog.find({})
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      WebhookLog.countDocuments({})
    ])

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)) || 1
      }
    })
  } catch (error) {
    console.error('Admin Webhook Logs API Error:', error)
    return res.status(500).json({ error: 'Internal server error while fetching webhook logs' })
  }
}

export default withAuth(handler, true)
