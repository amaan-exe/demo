import { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

const SettingsContext = createContext({})

export const defaultSettings = {
  restaurantName: 'Biriyani Station Patna',
  isStoreOpen: true,
  deliveryCharge: 40,
  gstPercentage: 18,
  openingTime: '11:00 AM',
  closingTime: '11:30 PM',
  supportPhone: '+91 82713 01179',
  storeUpiId: 'Q441280679@ybl',
  restaurantAddress: 'Exhibition Road, Opposite Big Bazaar, Patna, Bihar 800001'
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings)

  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'settings', 'restaurant'), (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          setSettings({
            restaurantName: data.restaurantName || defaultSettings.restaurantName,
            isStoreOpen: data.isStoreOpen ?? true,
            deliveryCharge: typeof data.deliveryCharge === 'number' ? data.deliveryCharge : (Number(data.deliveryCharge) || 40),
            gstPercentage: typeof data.gstPercentage === 'number' ? data.gstPercentage : (Number(data.gstPercentage) || 18),
            openingTime: data.openingTime || defaultSettings.openingTime,
            closingTime: data.closingTime || defaultSettings.closingTime,
            supportPhone: data.supportPhone || defaultSettings.supportPhone,
            storeUpiId: data.storeUpiId || defaultSettings.storeUpiId,
            restaurantAddress: data.restaurantAddress || defaultSettings.restaurantAddress
          })
        }
      }, (err) => console.warn('Settings live sync notice:', err.message))

      return () => unsub()
    } catch (e) {}
  }, [])

  return (
    <SettingsContext.Provider value={{ settings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
