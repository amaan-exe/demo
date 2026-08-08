import { connectDb } from '../../../../lib/db'
import PaymentTransaction from '../../../../models/PaymentTransaction'
import Order from '../../../../models/Order'
import { withAuth } from '../../../../lib/authMiddleware'

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const conn = await connectDb()
    if (!conn) {
      // Fallback to Firestore when MongoDB connection is omitted or skipped
      try {
        const { collection, getDocs, query, orderBy, limit: limitFn } = await import('firebase/firestore')
        const { db } = await import('../../../../lib/firebase')
        const ordersSnap = await getDocs(query(collection(db, 'orders'), limitFn(50)))
        const fsOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        const transactions = fsOrders.filter(o => o.paymentMethod === 'RAZORPAY' || o.isRazorpay || o.razorpayOrderId).map(o => {
          const appSt = (o.paymentStatus === 'paid' || o.orderStatus === 'confirmed') ? 'DONE' : (o.paymentStatus === 'payment_failed' ? 'FAILED' : 'PENDING')
          return {
            _id: o.id,
            internalOrderId: o.orderId || o.id,
            razorpayOrderId: o.razorpayOrderId || null,
            paymentId: o.razorpayPaymentId || o.transactionReference || null,
            amount: o.grandTotal || o.subtotal || 0,
            currency: 'INR',
            status: appSt,
            razorpayStatus: appSt === 'DONE' ? 'captured' : 'created',
            paymentMethod: 'RAZORPAY',
            customerName: o.customerName || o.userName || 'Customer',
            customerEmail: o.customerEmail || o.userEmail || '',
            customerPhone: o.customerPhone || o.userPhone || '',
            createdAt: o.createdAt?.toDate ? o.createdAt.toDate() : new Date(),
            updatedAt: o.updatedAt?.toDate ? o.updatedAt.toDate() : new Date(),
          }
        })

        const doneCount = transactions.filter(t => t.status === 'DONE').length
        const pendingCount = transactions.filter(t => t.status === 'PENDING').length
        const failedCount = transactions.filter(t => t.status === 'FAILED').length
        const totalAmount = transactions.filter(t => t.status === 'DONE').reduce((s, t) => s + t.amount, 0)

        return res.status(200).json({
          success: true,
          transactions,
          pagination: { total: transactions.length, page: 1, pages: 1 },
          metrics: {
            totalTransactions: transactions.length,
            pending: pendingCount,
            done: doneCount,
            failed: failedCount,
            cancelled: 0,
            totalSuccessfulAmount: Math.round(totalAmount),
          }
        })
      } catch (fsErr) {
        return res.status(200).json({
          success: true,
          transactions: [],
          pagination: { total: 0, page: 1, pages: 1 },
          metrics: { totalTransactions: 0, pending: 0, done: 0, failed: 0, cancelled: 0, totalSuccessfulAmount: 0 }
        })
      }
    }

    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'ALL',
      method = 'ALL',
      sortBy = 'newest'
    } = req.query

    // 1. Build Filter Query
    let query = {}

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase()
    }

    if (method && method !== 'ALL') {
      query.paymentMethod = method.toUpperCase()
    }

    if (search && search.trim()) {
      const cleanSearch = search.trim()
      query.$or = [
        { paymentId: { $regex: cleanSearch, $options: 'i' } },
        { razorpayOrderId: { $regex: cleanSearch, $options: 'i' } },
        { internalOrderId: { $regex: cleanSearch, $options: 'i' } },
        { customerName: { $regex: cleanSearch, $options: 'i' } },
        { customerEmail: { $regex: cleanSearch, $options: 'i' } },
        { customerPhone: { $regex: cleanSearch, $options: 'i' } },
      ]
    }

    // 2. Determine Sorting
    let sortOptions = { createdAt: -1 }
    if (sortBy === 'oldest') sortOptions = { createdAt: 1 }
    else if (sortBy === 'highest') sortOptions = { amount: -1 }
    else if (sortBy === 'lowest') sortOptions = { amount: 1 }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    // 3. Fetch Transactions
    const [transactions, totalCount] = await Promise.all([
      PaymentTransaction.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PaymentTransaction.countDocuments(query)
    ])

    // If PaymentTransaction is empty, create synthetic transactions from existing Orders so admin is never empty
    let finalTransactions = transactions
    if (totalCount === 0 && !search && status === 'ALL' && method === 'ALL') {
      const existingOrders = await Order.find({ paymentMethod: 'RAZORPAY' }).sort({ createdAt: -1 }).limit(50).lean()
      if (existingOrders.length > 0) {
        // Auto-seed PaymentTransaction records for pre-existing orders
        for (const ord of existingOrders) {
          const appSt = (ord.paymentStatus === 'paid' || ord.status === 'confirmed') ? 'DONE' : (ord.paymentStatus === 'payment_failed' ? 'FAILED' : 'PENDING')
          await PaymentTransaction.findOneAndUpdate(
            { internalOrderId: ord.orderId },
            {
              $set: {
                paymentId: ord.razorpayPaymentId || ord.transactionReference || null,
                razorpayOrderId: ord.razorpayOrderId || null,
                internalOrderId: ord.orderId,
                amount: ord.grandTotal || 0,
                currency: 'INR',
                status: appSt,
                razorpayStatus: appSt === 'DONE' ? 'captured' : 'created',
                paymentMethod: 'RAZORPAY',
                customerName: ord.customerName || ord.userName || '',
                customerEmail: ord.customerEmail || ord.userEmail || '',
                customerPhone: ord.customerPhone || ord.userPhone || '',
                createdAt: ord.createdAt || new Date(),
                updatedAt: ord.updatedAt || new Date(),
              }
            },
            { upsert: true }
          ).catch(() => {})
        }
        // Refetch after seeding
        finalTransactions = await PaymentTransaction.find(query).sort(sortOptions).skip(skip).limit(parseInt(limit)).lean()
      }
    }

    // 4. Calculate Aggregate Dashboard Summary Cards
    const summaryAggregation = await PaymentTransaction.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'DONE'] }, '$amount', 0]
            }
          }
        }
      }
    ])

    let pendingCount = 0
    let doneCount = 0
    let failedCount = 0
    let cancelledCount = 0
    let totalSuccessfulAmount = 0

    summaryAggregation.forEach(item => {
      if (item._id === 'PENDING') pendingCount = item.count
      else if (item._id === 'DONE') {
        doneCount = item.count
        totalSuccessfulAmount = item.totalAmount
      }
      else if (item._id === 'FAILED') failedCount = item.count
      else if (item._id === 'CANCELLED') cancelledCount = item.count
    })

    const overallTotalCount = pendingCount + doneCount + failedCount + cancelledCount

    return res.status(200).json({
      success: true,
      transactions: finalTransactions,
      pagination: {
        total: totalCount || finalTransactions.length,
        page: parseInt(page),
        pages: Math.ceil((totalCount || finalTransactions.length) / parseInt(limit)) || 1
      },
      metrics: {
        totalTransactions: overallTotalCount || finalTransactions.length,
        pending: pendingCount,
        done: doneCount,
        failed: failedCount,
        cancelled: cancelledCount,
        totalSuccessfulAmount: Math.round(totalSuccessfulAmount),
      }
    })
  } catch (error) {
    console.error('Admin Payments API Error:', error)
    return res.status(500).json({ error: 'Internal server error while fetching payment transactions' })
  }
}

export default withAuth(handler, true)
