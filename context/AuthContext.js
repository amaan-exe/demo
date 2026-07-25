import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'

const AuthContext = createContext({
  user: null,
  userProfile: null,
  isAdmin: false,
  accessToken: null,
  loading: true,
  isAuthModalOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  logout: async () => {},
  updateUserProfileData: async () => {}
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  const openAuthModal = () => setIsAuthModalOpen(true)
  const closeAuthModal = () => setIsAuthModalOpen(false)

  // Listen to Firebase auth state changes & handle redirect sign-in results
  useEffect(() => {
    // Process redirect result if returning from Google OAuth redirect flow
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        await syncWithBackend(result.user)
      }
    }).catch((err) => {
      console.warn('Redirect result notice:', err?.message || err)
    })

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userRef = doc(db, 'users', fbUser.uid)
          const userSnap = await getDoc(userRef)

          const ADMIN_EMAILS = ['amaanullah2607@gmail.com', 'admin@biriyanistation.com']
          const isAdminEmail = ADMIN_EMAILS.includes(fbUser.email?.toLowerCase())

          let profileData = {
            uid: fbUser.uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Foodie User',
            email: fbUser.email,
            photoURL: fbUser.photoURL || '',
            phone: fbUser.phoneNumber || '',
            role: isAdminEmail ? 'admin' : 'customer',
            lastLogin: new Date().toISOString(),
            defaultAddress: '',
            walletBalance: 0,
            isBlocked: false
          }

          if (userSnap.exists()) {
            profileData = { ...profileData, ...userSnap.data(), role: isAdminEmail ? 'admin' : (userSnap.data().role || 'customer'), lastLogin: new Date().toISOString() }
            await updateDoc(userRef, { role: profileData.role, lastLogin: serverTimestamp() }).catch(() => {})
          } else {
            // First time user registration in Firestore
            await setDoc(userRef, {
              ...profileData,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp()
            }).catch(() => {})
          }

          setUserProfile(profileData)
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: profileData.name,
            photoURL: profileData.photoURL,
            role: profileData.role
          })
        } catch (err) {
          console.warn('Firestore user sync notice:', err.message)
          const ADMIN_EMAILS = ['amaanullah2607@gmail.com', 'admin@biriyanistation.com']
          const isAdminEmail = ADMIN_EMAILS.includes(fbUser.email?.toLowerCase())
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0],
            photoURL: fbUser.photoURL || '',
            role: isAdminEmail ? 'admin' : 'customer'
          })
        }
      } else {
        setUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Auto-restore session via HttpOnly refresh cookie on app mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' })
        if (res.ok) {
          const data = await res.json()
          setAccessToken(data.accessToken)
        }
      } catch (err) {
        console.warn('Session restoration notice:', err.message)
      }
    }
    restoreSession()
  }, [])

  // Sync token & user with backend API after Firebase login
  const syncWithBackend = async (firebaseUser) => {
    // 1. Immediately set user state and close modal for instant UI response
    setUser({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Foodie User',
      photoURL: firebaseUser.photoURL || '',
    })
    closeAuthModal()

    // 2. Sync JWT & HttpOnly cookie with server in background
    try {
      const payload = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Foodie User',
        photoURL: firebaseUser.photoURL || '',
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        setAccessToken(data.accessToken)
      }
    } catch (err) {
      console.warn('Backend Auth Sync Notice:', err.message)
    }
  }

  // 1. Google Sign-In via Popup (Supported across Mobile Chrome, Safari & Android WebViews)
  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      if (result?.user) {
        await syncWithBackend(result.user)
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error)
      const code = error?.code || error?.message || ''
      if (code.includes('popup-closed-by-user') || code.includes('user-cancelled')) {
        return // Ignore silent user cancellation
      }
      if (code.includes('popup-blocked')) {
        throw new Error('Google Sign-In popup was blocked by your browser. Please tap the Google button again or allow popups for this website.')
      }
      throw error
    }
  }

  // 2. Email & Password Auth (Login or Signup)
  const loginWithEmail = async (email, password, isSignup = false, displayName = '') => {
    try {
      let userCredential
      if (isSignup) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password)
        if (displayName && userCredential.user) {
          await updateProfile(userCredential.user, { displayName })
        }
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password)
      }

      const fbUser = userCredential.user
      if (displayName) fbUser.displayName = displayName

      await syncWithBackend(fbUser)
    } catch (error) {
      console.error('Email Auth Error:', error)
      throw error
    }
  }

  // 3. Update User Profile in Firestore
  const updateUserProfileData = async (data) => {
    if (!user) return
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, { ...data, updatedAt: serverTimestamp() })
      setUserProfile(prev => ({ ...prev, ...data }))
      if (data.name) {
        setUser(prev => ({ ...prev, displayName: data.name }))
      }
    } catch (err) {
      console.error('Update Profile Error:', err)
      throw err
    }
  }

  // 4. Logout
  const logout = async () => {
    try {
      await firebaseSignOut(auth)
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.warn('Logout notice:', err)
    } finally {
      setUser(null)
      setUserProfile(null)
      setAccessToken(null)
    }
  }

  const ADMIN_EMAILS = ['amaanullah2607@gmail.com', 'admin@biriyanistation.com', 'admin@gmail.com']
  const currentEmail = (user?.email || userProfile?.email || '').toLowerCase().trim()
  const isAdmin = Boolean(user && currentEmail && (userProfile?.role === 'admin' || user?.role === 'admin' || ADMIN_EMAILS.includes(currentEmail)))

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin,
        accessToken,
        loading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        loginWithGoogle,
        loginWithEmail,
        logout,
        updateUserProfileData
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
