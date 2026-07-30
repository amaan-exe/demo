import { doc, getDoc, setDoc, deleteDoc, writeBatch, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export const TERMINAL_STATUSES = [
  'delivered',
  'Delivered',
  'DELIVERED',
  'refunded',
  'Refunded',
  'REFUNDED',
  'cancelled',
  'Cancelled',
  'CANCELLED'
]

export function isTerminalStatus(status, refundData) {
  if (!status) return false
  const st = String(status).trim()
  const stLower = st.toLowerCase()

  // If refund requested and not resolved, keep in active orders
  if (refundData?.requested === true) {
    const refSt = String(refundData?.status || '').toUpperCase()
    if (refSt !== 'REFUNDED' && refSt !== 'REJECTED') {
      return false
    }
  }

  return TERMINAL_STATUSES.includes(st) || TERMINAL_STATUSES.includes(stLower)
}

/**
 * Atomically moves an order from 'orders' to 'orders_archive' if completed/terminal.
 */
export async function archiveOrderIfCompleted(orderId, orderData = null) {
  if (!orderId) return false
  const cleanId = String(orderId).replace(/^#/, '').trim()

  try {
    let docData = orderData
    if (!docData) {
      const snap = await getDoc(doc(db, 'orders', cleanId))
      if (!snap.exists()) return false
      docData = { id: snap.id, ...snap.data() }
    }

    const currentStatus = docData.orderStatus || docData.status || ''
    if (!isTerminalStatus(currentStatus, docData.refund)) {
      return false
    }

    const batch = writeBatch(db)
    const archiveRef = doc(db, 'orders_archive', cleanId)
    const activeRef = doc(db, 'orders', cleanId)

    const archivePayload = {
      ...docData,
      isArchived: true,
      archivedAt: serverTimestamp()
    }

    batch.set(archiveRef, archivePayload)
    batch.delete(activeRef)

    await batch.commit()
    console.log(`Order ${cleanId} successfully archived to orders_archive.`)
    return true
  } catch (err) {
    console.warn(`Archive Order Notice for ${cleanId}:`, err.message)
    return false
  }
}

/**
 * Idempotently scans 'orders' and archives any existing completed orders to 'orders_archive'.
 */
export async function migrateExistingCompletedOrders() {
  try {
    const ordersRef = collection(db, 'orders')
    const snap = await getDocs(ordersRef)
    if (snap.empty) return 0

    let count = 0
    const batchSize = 400
    let batch = writeBatch(db)
    let batchOperations = 0

    for (const docSnap of snap.docs) {
      const data = docSnap.data()
      const status = data.orderStatus || data.status || ''
      if (isTerminalStatus(status, data.refund)) {
        const archiveRef = doc(db, 'orders_archive', docSnap.id)
        const activeRef = doc(db, 'orders', docSnap.id)
        batch.set(archiveRef, { ...data, isArchived: true, archivedAt: new Date().toISOString() })
        batch.delete(activeRef)
        batchOperations += 2
        count++

        if (batchOperations >= batchSize) {
          await batch.commit()
          batch = writeBatch(db)
          batchOperations = 0
        }
      }
    }

    if (batchOperations > 0) {
      await batch.commit()
    }

    console.log(`Migrated ${count} completed orders to orders_archive.`)
    return count
  } catch (err) {
    console.warn('Migration warning:', err.message)
    return 0
  }
}
