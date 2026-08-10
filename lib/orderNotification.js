import webpush from 'web-push'

/**
 * Configure VAPID credentials if available
 */
function getVapidDetails() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@biriyanistation.in'

  if (!publicKey || !privateKey) {
    console.warn('[WebPush] Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY environment variables.')
    return null
  }

  return { publicKey, privateKey, subject }
}

/**
 * Main Order Notification Engine
 * Sends Web Push notifications to all registered admin devices when a new order is verified/confirmed.
 * Safe & Idempotent: Never throws or fails the parent order creation request.
 */
export async function sendOrderNotification(orderData) {
  if (!orderData || !orderData.orderId) {
    console.warn('[OrderNotification] Invalid order data passed to notification engine.')
    return { success: false, reason: 'Invalid order data' }
  }

  const { orderId, grandTotal, items, customerName, userName } = orderData

  try {
    // 1. Connect MongoDB
    const { connectDb } = await import('./db')
    const AdminSubscription = (await import('../models/AdminSubscription')).default
    const Order = (await import('../models/Order')).default
    await connectDb()

    // 2. Atomic Idempotency Check & Lock
    // Only proceed if notificationSent is false/unset. If already sent, skip to avoid duplicate pushes.
    const lockResult = await Order.findOneAndUpdate(
      { orderId, notificationSent: { $ne: true } },
      { $set: { notificationSent: true, updatedAt: new Date() } },
      { new: true }
    )

    if (!lockResult) {
      console.log(`[OrderNotification] Notification already dispatched for order ${orderId}. Skipping duplicate.`)
      return { success: true, duplicate: true }
    }

    // 3. Update Firestore order document to set notificationSent = true and mark order as live confirmed
    try {
      const { doc, updateDoc, setDoc, serverTimestamp } = await import('firebase/firestore')
      const { db } = await import('./firebase')
      const orderRef = doc(db, 'orders', orderId)
      await setDoc(orderRef, {
        notificationSent: true,
        notificationEmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true })
    } catch (fsErr) {
      console.warn('[OrderNotification] Firestore notificationSent update notice:', fsErr.message)
    }

    // 4. Fetch Subscriptions from MongoDB
    const mongoSubs = await AdminSubscription.find({}).lean()

    // Also try fetching from Firestore as fallback/sync
    let fsSubs = []
    try {
      const { collection, getDocs } = await import('firebase/firestore')
      const { db } = await import('./firebase')
      const snap = await getDocs(collection(db, 'admin_notification_subscriptions'))
      fsSubs = snap.docs.map(d => d.data())
    } catch (e) {
      // Ignore Firestore query warning if collection empty
    }

    // Merge and deduplicate subscriptions by endpoint
    const subMap = new Map()
    for (const sub of [...mongoSubs, ...fsSubs]) {
      if (sub && sub.endpoint && sub.p256dh && sub.auth) {
        subMap.set(sub.endpoint, {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          },
          adminUserId: sub.adminUserId,
          adminEmail: sub.adminEmail
        })
      }
    }

    const subscriptions = Array.from(subMap.values())

    if (subscriptions.length === 0) {
      console.log(`[OrderNotification] Order #${orderId} confirmed, but no admin push subscriptions are registered.`)
      return { success: true, deliveredCount: 0, totalSubscriptions: 0 }
    }

    // 5. Prepare Web Push Payload
    const itemCount = Array.isArray(items) ? items.reduce((acc, curr) => acc + (Number(curr.qty) || 1), 0) : 0
    const formattedAmount = `₹${Math.round(grandTotal || 0)}`
    const shortOrderId = orderId.replace('BS-PATNA-', '#')
    const customer = customerName || userName || 'Customer'

    const payload = JSON.stringify({
      title: `New Order ${shortOrderId}`,
      body: `${formattedAmount} • ${itemCount} item${itemCount !== 1 ? 's' : ''} • ${customer}`,
      icon: '/images/cart.png',
      badge: '/images/cart.png',
      tag: `new-order-${orderId}`,
      renotify: true,
      requireInteraction: true,
      data: {
        orderId,
        url: `/admin/orders?orderId=${encodeURIComponent(orderId)}`,
        grandTotal,
        itemCount,
        customerName: customer,
        createdAt: new Date().toISOString()
      }
    })

    // 6. Configure WebPush VAPID
    const vapid = getVapidDetails()
    if (!vapid) {
      console.warn('[OrderNotification] Cannot send Web Push: VAPID keys not configured.')
      return { success: false, reason: 'VAPID keys not configured' }
    }

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

    // 7. Dispatch Web Push to all registered admin devices concurrently
    let deliveredCount = 0
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: sub.keys
        }, payload)

        deliveredCount++

        // Update lastUsedAt in MongoDB
        AdminSubscription.updateOne(
          { endpoint: sub.endpoint },
          { $set: { lastUsedAt: new Date() } }
        ).catch(() => {})

      } catch (pushErr) {
        const statusCode = pushErr.statusCode
        console.warn(`[OrderNotification] WebPush error for endpoint (${statusCode}):`, pushErr.message)

        // Clean up expired or invalid subscriptions (404 Not Found or 410 Gone)
        if (statusCode === 404 || statusCode === 410) {
          console.log(`[OrderNotification] Removing expired subscription endpoint: ${sub.endpoint.substring(0, 30)}...`)
          try {
            await AdminSubscription.deleteOne({ endpoint: sub.endpoint })
            const { doc, deleteDoc } = await import('firebase/firestore')
            const { db } = await import('./firebase')
            const fsSubId = Buffer.from(sub.endpoint).toString('base64').substring(0, 60)
            await deleteDoc(doc(db, 'admin_notification_subscriptions', fsSubId)).catch(() => {})
          } catch (delErr) {
            console.warn('Subscription cleanup notice:', delErr.message)
          }
        }
      }
    })

    await Promise.all(sendPromises)

    console.log(`[OrderNotification] Successfully dispatched push notification for Order #${orderId} to ${deliveredCount}/${subscriptions.length} devices.`)
    return { success: true, deliveredCount, totalSubscriptions: subscriptions.length }

  } catch (error) {
    // CRITICAL: NEVER throw from notification helper so parent order transaction succeeds
    console.error('[OrderNotification] Non-fatal notification failure:', error)
    return { success: false, error: error.message }
  }
}
