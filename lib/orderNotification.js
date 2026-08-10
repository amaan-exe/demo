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
    // 1. Connect MongoDB (if available)
    const { connectDb } = await import('./db')
    const mongoose = (await import('mongoose')).default
    const AdminSubscription = (await import('../models/AdminSubscription')).default
    const Order = (await import('../models/Order')).default
    
    let mongoConnected = false
    try {
      const conn = await connectDb()
      if (conn && mongoose.connection.readyState === 1) {
        mongoConnected = true
      }
    } catch (e) {}

    let enrichedOrderData = { ...orderData }

    // 2. Atomic Idempotency Check & Lock
    if (mongoConnected) {
      try {
        const lockResult = await Order.findOneAndUpdate(
          { orderId, notificationSent: { $ne: true } },
          { $set: { notificationSent: true, updatedAt: new Date() } },
          { new: true }
        )

        if (!lockResult) {
          console.log(`[OrderNotification] Notification already dispatched for order ${orderId}. Skipping duplicate.`)
          return { success: true, duplicate: true }
        }

        const obj = lockResult.toObject ? lockResult.toObject() : lockResult
        enrichedOrderData = {
          ...obj,
          ...orderData,
          customerPhone: orderData.customerPhone || obj.customerPhone || obj.userPhone || '',
          deliveryAddress: orderData.deliveryAddress || obj.deliveryAddress || '',
          paymentMethod: orderData.paymentMethod || obj.paymentMethod || 'Online',
          paymentStatus: orderData.paymentStatus || obj.paymentStatus || 'confirmed',
          customerName: orderData.customerName || obj.customerName || obj.userName || 'Customer',
          grandTotal: orderData.grandTotal || obj.grandTotal || 0,
          items: (orderData.items && orderData.items.length) ? orderData.items : (obj.items || [])
        }
      } catch (lockErr) {
        console.warn('[OrderNotification] MongoDB lock notice:', lockErr.message)
      }
    }

    // 3. Update Firestore order document to set notificationSent = true and mark order as live confirmed
    try {
      const { doc, setDoc, getDoc, serverTimestamp } = await import('firebase/firestore')
      const { db } = await import('./firebase')
      const orderRef = doc(db, 'orders', orderId)

      if (!mongoConnected || !enrichedOrderData.customerPhone || !enrichedOrderData.deliveryAddress) {
        try {
          const snap = await getDoc(orderRef)
          if (snap.exists()) {
            const fsData = snap.data()
            enrichedOrderData = {
              ...fsData,
              ...enrichedOrderData,
              customerPhone: enrichedOrderData.customerPhone || fsData.customerPhone || fsData.userPhone || '',
              deliveryAddress: enrichedOrderData.deliveryAddress || fsData.deliveryAddress || '',
              paymentMethod: enrichedOrderData.paymentMethod || fsData.paymentMethod || 'Online',
              paymentStatus: enrichedOrderData.paymentStatus || fsData.paymentStatus || 'confirmed',
              customerName: enrichedOrderData.customerName || fsData.customerName || fsData.userName || 'Customer',
              grandTotal: enrichedOrderData.grandTotal || fsData.grandTotal || 0,
              items: (enrichedOrderData.items && enrichedOrderData.items.length) ? enrichedOrderData.items : (fsData.items || [])
            }
          }
        } catch (e) {}
      }

      await setDoc(orderRef, {
        notificationSent: true,
        notificationEmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true })
    } catch (fsErr) {
      console.warn('[OrderNotification] Firestore notificationSent update notice:', fsErr.message)
    }

    // 4. Dispatch Telegram Order Notification concurrently (ALWAYS INSTANT & UNBLOCKED)
    try {
      const { sendTelegramOrderNotification } = await import('./telegramNotification')
      await sendTelegramOrderNotification(enrichedOrderData).catch(err => console.warn('[OrderNotification] Telegram notice:', err.message))
    } catch (tgErr) {
      console.warn('[OrderNotification] Telegram import notice:', tgErr.message)
    }

    // 5. Fetch Subscriptions from MongoDB (if connected)
    let mongoSubs = []
    if (mongoConnected) {
      try {
        mongoSubs = await AdminSubscription.find({}).lean()
      } catch (e) {
        console.warn('[OrderNotification] MongoDB subscription fetch notice:', e.message)
      }
    }

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
      console.log(`[OrderNotification] Order #${orderId} confirmed, but no admin push subscriptions are registered. Telegram alert sent.`)
      return { success: true, deliveredCount: 0, totalSubscriptions: 0, telegramSent: true }
    }

    // 6. Prepare Web Push Payload
    const itemCount = Array.isArray(enrichedOrderData.items) ? enrichedOrderData.items.reduce((acc, curr) => acc + (Number(curr.qty) || 1), 0) : 0
    const formattedAmount = `₹${Math.round(enrichedOrderData.grandTotal || grandTotal || 0)}`
    const shortOrderId = orderId.replace('BS-PATNA-', '#')
    const customer = enrichedOrderData.customerName || customerName || userName || 'Customer'

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
        grandTotal: enrichedOrderData.grandTotal || grandTotal,
        itemCount,
        customerName: customer,
        createdAt: new Date().toISOString()
      }
    })

    // 7. Configure WebPush VAPID
    const vapid = getVapidDetails()
    if (!vapid) {
      console.warn('[OrderNotification] Cannot send Web Push: VAPID keys not configured.')
      return { success: false, reason: 'VAPID keys not configured', telegramSent: true }
    }

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

    // 8. Dispatch Web Push to all registered admin devices concurrently
    let deliveredCount = 0
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: sub.keys
        }, payload)

        deliveredCount++

        // Update lastUsedAt in MongoDB if connected
        if (mongoConnected) {
          AdminSubscription.updateOne(
            { endpoint: sub.endpoint },
            { $set: { lastUsedAt: new Date() } }
          ).catch(() => {})
        }

      } catch (pushErr) {
        const statusCode = pushErr.statusCode
        console.warn(`[OrderNotification] WebPush error for endpoint (${statusCode}):`, pushErr.message)

        // Clean up expired or invalid subscriptions (404 Not Found or 410 Gone)
        if (statusCode === 404 || statusCode === 410) {
          console.log(`[OrderNotification] Removing expired subscription endpoint: ${sub.endpoint.substring(0, 30)}...`)
          try {
            if (mongoConnected) {
              await AdminSubscription.deleteOne({ endpoint: sub.endpoint }).catch(() => {})
            }
            const { doc, deleteDoc } = await import('firebase/firestore')
            const { db } = await import('./firebase')
            const fsSubId = Buffer.from(sub.endpoint).toString('base64').replace(/\//g, '_').replace(/\+/g, '-').substring(0, 60)
            await deleteDoc(doc(db, 'admin_notification_subscriptions', fsSubId)).catch(() => {})
          } catch (delErr) {
            console.warn('Subscription cleanup notice:', delErr.message)
          }
        }
      }
    })

    await Promise.all(sendPromises)

    console.log(`[OrderNotification] Successfully dispatched push notification for Order #${orderId} to ${deliveredCount}/${subscriptions.length} devices.`)
    return { success: true, deliveredCount, totalSubscriptions: subscriptions.length, telegramSent: true }

  } catch (error) {
    // CRITICAL: NEVER throw from notification helper so parent order transaction succeeds
    console.error('[OrderNotification] Non-fatal notification failure:', error)
    return { success: false, error: error.message }
  }
}
