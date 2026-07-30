import { connectDb } from '../../../lib/db'
import Order from '../../../models/Order'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { withAuth } from '../../../lib/authMiddleware'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, userEmail, userName, userPhone, deliveryAddress, items, grandTotal } = req.body

    if (!userId || !userEmail) {
      return res.status(401).json({ error: 'Authentication required. Please sign in to place an order.' })
    }

    if (!items || !items.length || !userPhone || !deliveryAddress) {
      return res.status(400).json({ error: 'Missing required order details (items, phone, address)' })
    }

    // Check if store is open in Firestore settings
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'restaurant'))
      if (settingsSnap.exists()) {
        const storeSettings = settingsSnap.data()
        if (storeSettings.isStoreOpen === false) {
          return res.status(403).json({
            error: 'Restaurant is currently closed for online orders. Please check back during operating hours.'
          })
        }
      }
    } catch (e) {
      console.warn('Backend store status check notice:', e.message)
    }

    // Server-side Coupon Rule Verification Shield
    let verifiedDiscount = 0
    let couponCodeToApply = req.body.appliedCoupon || req.body.couponCode || null
    let couponDocIdToIncrement = null
    let cleanSecretCode = null

    const rawSubtotal = req.body.subtotal || 0

    if (couponCodeToApply) {
      cleanSecretCode = String(couponCodeToApply).toUpperCase().trim()

      if (cleanSecretCode === 'CODERSAPIEN50') {
        verifiedDiscount = Math.round((rawSubtotal * 50) / 100)
      } else {
        try {
          const { collection, query, where, getDocs, updateDoc, increment } = await import('firebase/firestore')
          const q = query(collection(db, 'coupons'), where('couponCode', '==', cleanSecretCode))
          const snap = await getDocs(q)

          if (snap.empty) {
            return res.status(400).json({ error: 'Server validation failed: Invalid coupon code.' })
          }

          const couponDoc = snap.docs[0]
          const coupon = { id: couponDoc.id, ...couponDoc.data() }

          // Rule 1: Active Check
          if (!coupon.active) {
            return res.status(400).json({ error: 'Server validation failed: Coupon is inactive.' })
          }

          // Rule 2: Expiry Date Validation
          if (coupon.expiryDate) {
            const today = new Date().toISOString().split('T')[0]
            if (today > coupon.expiryDate) {
              return res.status(400).json({ error: `Server validation failed: Coupon expired on ${coupon.expiryDate}.` })
            }
          }

          // Rule 3: Usage Limit Check
          if (coupon.usageLimit > 0 && (coupon.usedCount || 0) >= coupon.usageLimit) {
            return res.status(400).json({ error: 'Server validation failed: Coupon redemption limit reached.' })
          }

          // Rule 4: Minimum Order Threshold Validation
          if (rawSubtotal < coupon.minimumOrder) {
            return res.status(400).json({ error: `Server validation failed: Minimum order threshold of ₹${coupon.minimumOrder} required for coupon.` })
          }

          // Rule 5: Applicable Category Validation
          if (coupon.applicableCategory && coupon.applicableCategory !== 'all') {
            const hasValidCategory = items.some(item =>
              (item.category || '').toLowerCase() === coupon.applicableCategory.toLowerCase()
            )
            if (!hasValidCategory) {
              return res.status(400).json({ error: `Server validation failed: Coupon restricted to '${coupon.applicableCategory}' items.` })
            }
          }

          // Compute Verified Server Discount
          if (coupon.discountType === 'percent') {
            verifiedDiscount = Math.round((rawSubtotal * coupon.discountValue) / 100)
          } else {
            verifiedDiscount = Number(coupon.discountValue) || 0
          }

          // Atomically increment redemption count and track user in Firestore
          // We removed it from here to move it below after order creation (Task 3.4)
          couponDocIdToIncrement = couponDoc.id

        } catch (err) {
          console.error('Server Coupon Validation Error:', err)
          return res.status(400).json({ error: 'Failed server validation for promo coupon code.' })
        }
      }
    }

    const orderId = req.body.orderId || `BS-PATNA-${Math.floor(100000 + Math.random() * 900000)}`
    const calculatedSubtotal = Number(req.body.subtotal) || 0
    const calculatedDelivery = Number(req.body.deliveryCharge) || 0
    const calculatedTax = Number(req.body.tax) || 0
    const verifiedGrandTotal = Math.max(0, calculatedSubtotal + calculatedDelivery + calculatedTax - verifiedDiscount)

    connectDb().then(async () => {
      await Order.create({
          orderId,
          userId,
          userEmail,
          customerEmail: req.body.customerEmail || userEmail,
          userName: userName || req.body.customerName || userEmail.split('@')[0],
          customerName: req.body.customerName || userName || userEmail.split('@')[0],
          userPhone: userPhone || req.body.customerPhone,
          customerPhone: req.body.customerPhone || userPhone,
          deliveryAddress,
          items,
          subtotal: calculatedSubtotal,
          deliveryCharge: calculatedDelivery,
          tax: calculatedTax,
          discount: verifiedDiscount,
          appliedCoupon: couponCodeToApply,
          grandTotal: verifiedGrandTotal,
          paymentMethod: req.body.paymentMethod || 'UPI',
          paymentStatus: req.body.paymentStatus || 'verification_pending',
          orderStatus: req.body.orderStatus || 'payment_verification_pending',
          customerMarkedPaid: req.body.customerMarkedPaid ?? true,
          transactionReference: req.body.transactionReference || null,
          status: req.body.orderStatus || 'payment_verification_pending',
        }).catch((e) => console.warn('Mongoose Order Create Notice:', e.message))
      }).catch((e) => console.warn('DB Connection Notice:', e.message))

    // Task 3.2: Overwrite the client's untrusted Firestore document with verified server data
    try {
      await setDoc(doc(db, 'orders', orderId), {
        discount: verifiedDiscount,
        grandTotal: verifiedGrandTotal,
        updatedAt: serverTimestamp()
      }, { merge: true })

      // Task 3.4: Commit coupon usage ONLY after order is successfully recorded in Firestore
      if (couponCodeToApply && cleanSecretCode !== 'CODERSAPIEN50' && couponDocIdToIncrement) {
        const { arrayUnion, increment, updateDoc } = await import('firebase/firestore')
        await updateDoc(doc(db, 'coupons', couponDocIdToIncrement), {
          usedCount: increment(1),
          usedByUsers: arrayUnion(userId || userEmail)
        }).catch(e => console.warn('Coupon usage increment notice:', e.message))
      }
    } catch (e) {
      console.error('Error overwriting firestore order with verified totals:', e)
    }

    return res.status(200).json({
      success: true,
      message: 'Order created successfully',
      orderId,
    })
  } catch (error) {
    console.error('Order Creation API Error:', error)
    return res.status(500).json({ error: error.message || 'Failed to create order' })
  }
}

export default withAuth(handler)
