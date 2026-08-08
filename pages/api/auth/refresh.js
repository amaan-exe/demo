import { verifyRefreshToken, generateAccessToken, setRefreshTokenCookie, generateRefreshToken } from '../../../lib/jwt'
import * as cookie from 'cookie'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const parseFn = cookie.parseCookie || cookie.parse || cookie.default?.parseCookie || cookie.default?.parse
    const parsedCookies = parseFn ? parseFn(req.headers.cookie || '') : {}
    const cookies = req.cookies && Object.keys(req.cookies).length > 0 ? req.cookies : parsedCookies
    const refreshToken = cookies?.refreshToken

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' })
    }

    const decoded = verifyRefreshToken(refreshToken)
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' })
    }

    // Generate new access token
    const tokenPayload = { uid: decoded.uid, email: decoded.email, displayName: decoded.displayName }
    const accessToken = generateAccessToken(tokenPayload)
    
    // Optionally rotate refresh token
    const newRefreshToken = generateRefreshToken(tokenPayload)
    setRefreshTokenCookie(res, newRefreshToken)

    return res.status(200).json({
      success: true,
      accessToken,
      user: tokenPayload
    })
  } catch (error) {
    console.error('Refresh Token Error:', error)
    return res.status(500).json({ error: 'Failed to refresh token' })
  }
}
