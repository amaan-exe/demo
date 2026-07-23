import jwt from 'jsonwebtoken'
import * as cookie from 'cookie'

const serializeCookie = (name, val, options) => {
  if (typeof cookie.serialize === 'function') {
    return cookie.serialize(name, val, options)
  }
  return `${name}=${encodeURIComponent(val)}; Path=${options.path || '/'}; HttpOnly; SameSite=Lax`
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'biriyani_express_patna_access_secret_2026_key_999'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'biriyani_express_patna_refresh_secret_2026_key_888'

// Access Token expires in 20 minutes (within 15-30m spec)
export function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '20m' })
}

// Refresh Token expires in 60 days (within 30-90d spec)
export function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '60d' })
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET)
  } catch (err) {
    return null
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET)
  } catch (err) {
    return null
  }
}

// Store Refresh Token in HttpOnly Cookie
export function setRefreshTokenCookie(res, refreshToken) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 24 * 60 * 60, // 60 days in seconds
  }

  const cookieHeader = serializeCookie('refreshToken', refreshToken, cookieOptions)
  res.setHeader('Set-Cookie', cookieHeader)
}

// Clear HttpOnly Cookie on logout
export function clearRefreshTokenCookie(res) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  }

  const cookieHeader = serializeCookie('refreshToken', '', cookieOptions)
  res.setHeader('Set-Cookie', cookieHeader)
}
