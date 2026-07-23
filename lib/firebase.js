import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, browserSessionPersistence, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAZ6ACAX4aYc_e3mBbFCnHTz5E3_Omodys",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "biriyani-station-patna.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "biriyani-station-patna",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "biriyani-station-patna.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "147207421197",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:147207421197:web:92b71fbd4feb6222078444"
}

// Initialize Firebase app singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)
const googleProvider = new GoogleAuthProvider()

// Use session persistence — each browser tab has its own independent login session.
// This allows testing customer + admin accounts in separate tabs of the same Chrome profile.
if (typeof window !== 'undefined') {
  setPersistence(auth, browserSessionPersistence).catch(() => {})
}

googleProvider.setCustomParameters({ prompt: 'select_account' })

export { app, auth, db, storage, googleProvider }

