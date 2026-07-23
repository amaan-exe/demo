import { connectDb } from '../../../lib/db'
import User from '../../../models/User'
import { generateAccessToken, generateRefreshToken, setRefreshTokenCookie } from '../../../lib/jwt'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { uid, email, displayName, photoURL } = req.body

    if (!uid || !email) {
      return res.status(400).json({ error: 'Missing required credentials (uid and email)' })
    }

    // 1. Generate Access Token (expires in 20m) & Refresh Token (expires in 60d)
    const tokenPayload = { uid, email, displayName }
    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)

    // 2. Set HttpOnly Refresh Cookie
    setRefreshTokenCookie(res, refreshToken)

    // 3. Connect to DB and save refresh token in background without blocking login
    let dbUser = null
    try {
      const conn = await connectDb()
      if (conn) {
        dbUser = await User.findOneAndUpdate(
          { uid },
          {
            uid,
            email,
            displayName: displayName || '',
            photoURL: photoURL || '',
            latestRefreshToken: refreshToken,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      }
    } catch (dbErr) {
      console.warn('MongoDB User Save Warning (non-blocking):', dbErr.message)
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful. Access token generated.',
      user: {
        uid: dbUser?.uid || uid,
        email: dbUser?.email || email,
        displayName: dbUser?.displayName || displayName || email.split('@')[0],
        photoURL: dbUser?.photoURL || photoURL || '',
      },
      accessToken,
    })
  } catch (error) {
    console.error('Login Auth API Error:', error)
    return res.status(500).json({ error: error.message || 'Internal Server Error' })
  }
}
