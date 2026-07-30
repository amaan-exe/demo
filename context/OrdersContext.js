import { createContext, useContext, useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'

const OrdersContext = createContext({})

export const KITCHEN_STATUSES = [
  'PAYMENT_VERIFIED',
  'Payment Verified',
  'payment_verified',
  'ACCEPTED',
  'Accepted',
  'accepted',
  'PREPARING',
  'Preparing',
  'preparing',
  'READY',
  'Ready',
  'ready',
  'PENDING',
  'Pending',
  'pending',
  'payment_verification_pending',
  'UPI Verification Pending',
  'confirmed',
  'Confirmed',
  'CONFIRMED',
  'REFUND_PENDING',
  'refund_pending',
  'REFUND_PROCESSING',
  'refund_processing',
  'CANCELLED',
  'cancelled'
]

export const DELIVERY_STATUSES = [
  'READY',
  'Ready',
  'ready',
  'ready_for_delivery',
  'OUT_FOR_DELIVERY',
  'Out For Delivery',
  'out_for_delivery'
]

export function OrdersProvider({ children }) {
  const { user, isAdmin, isStaff, isDelivery } = useAuth()
  const [kitchenOrders, setKitchenOrders] = useState([])
  const [deliveryOrders, setDeliveryOrders] = useState([])
  const [activeOrders, setActiveOrders] = useState([])
  const [pendingRefundCount, setPendingRefundCount] = useState(0)

  // 1. Shared Kitchen Listener (Only active when staff/admin logged in)
  useEffect(() => {
    if (!user || (!isStaff && !isAdmin)) {
      setKitchenOrders([])
      return
    }

    try {
      const q = query(
        collection(db, 'orders'),
        where('orderStatus', 'in', KITCHEN_STATUSES)
      )

      const unsub = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(d => {
          const data = d.data()
          let dateObj = new Date()
          if (data.createdAt?.toDate) {
            dateObj = data.createdAt.toDate()
          } else if (data.createdAtSeconds) {
            dateObj = new Date(data.createdAtSeconds * 1000)
          } else if (data.createdAt) {
            dateObj = new Date(data.createdAt)
          }

          const createdAtFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          const elapsedMinutes = Math.max(0, Math.floor((Date.now() - dateObj.getTime()) / 60000))

          return {
            id: d.id,
            ...data,
            dateObj,
            createdAtFormatted,
            elapsedMinutes
          }
        })

        fetched.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
        setKitchenOrders(fetched)
      }, (err) => console.warn('Kitchen shared listener notice:', err.message))

      return () => unsub()
    } catch (e) {
      console.warn('Kitchen query error:', e)
    }
  }, [user, isAdmin, isStaff])

  // 2. Shared Delivery Listener (Only active when delivery partner/admin logged in)
  useEffect(() => {
    if (!user || (!isDelivery && !isAdmin)) {
      setDeliveryOrders([])
      return
    }

    try {
      const q = query(
        collection(db, 'orders'),
        where('orderStatus', 'in', DELIVERY_STATUSES)
      )

      const unsub = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(d => {
          const data = d.data()
          let dateObj = new Date()
          if (data.updatedAt?.toDate) {
            dateObj = data.updatedAt.toDate()
          } else if (data.createdAt?.toDate) {
            dateObj = data.createdAt.toDate()
          } else if (data.createdAtSeconds) {
            dateObj = new Date(data.createdAtSeconds * 1000)
          } else if (data.createdAt) {
            dateObj = new Date(data.createdAt)
          }

          const elapsedMinutes = Math.max(0, Math.floor((Date.now() - dateObj.getTime()) / 60000))

          return {
            id: d.id,
            ...data,
            dateObj,
            elapsedMinutes
          }
        })

        fetched.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
        setDeliveryOrders(fetched)
      }, (err) => console.warn('Delivery shared listener notice:', err.message))

      return () => unsub()
    } catch (e) {
      console.warn('Delivery query error:', e)
    }
  }, [user, isAdmin, isDelivery])

  // 3. Shared Pending Refund Count (Only active when admin logged in)
  useEffect(() => {
    if (!user || !isAdmin) {
      setPendingRefundCount(0)
      return
    }

    try {
      const q = query(
        collection(db, 'orders'),
        where('refund.requested', '==', true)
      )

      const unsub = onSnapshot(q, (snapshot) => {
        const pendingDocs = snapshot.docs.filter(d => {
          const data = d.data()
          const st = (data.orderStatus || data.status || '').toUpperCase()
          const refSt = (data.refund?.status || '').toUpperCase()
          return st !== 'REFUNDED' && refSt !== 'REFUNDED'
        })
        setPendingRefundCount(pendingDocs.length)
      }, (err) => console.warn('Refund count listener notice:', err.message))

      return () => unsub()
    } catch (e) {
      console.warn('Refund count query error:', e)
    }
  }, [user, isAdmin])

  // 4. Shared Active Orders Listener (For Admin Desk live view)
  useEffect(() => {
    if (!user || !isAdmin) {
      setActiveOrders([])
      return
    }

    try {
      const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
        const fetched = snapshot.docs.map(d => {
          const data = d.data()
          let dateObj = new Date()
          if (data.createdAt?.toDate) {
            dateObj = data.createdAt.toDate()
          } else if (data.createdAtSeconds) {
            dateObj = new Date(data.createdAtSeconds * 1000)
          } else if (data.createdAt) {
            dateObj = new Date(data.createdAt)
          }

          return {
            id: d.id,
            ...data,
            dateObj
          }
        })

        fetched.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
        setActiveOrders(fetched)
      }, (err) => console.warn('Active orders listener notice:', err.message))

      return () => unsub()
    } catch (e) {}
  }, [user, isAdmin])

  return (
    <OrdersContext.Provider
      value={{
        kitchenOrders,
        deliveryOrders,
        activeOrders,
        pendingRefundCount
      }}
    >
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrdersContext() {
  return useContext(OrdersContext)
}
