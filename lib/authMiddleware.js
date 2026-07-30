import { verifyAccessToken } from './jwt'

export function withAuth(handler, requireAdmin = false) {
  return async (req, res) => {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' })
      }
      
      const token = authHeader.split(' ')[1]
      const decoded = verifyAccessToken(token)
      
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized: Expired or invalid token' })
      }
      
      req.user = decoded
      
      if (requireAdmin) {
        // Simple admin check based on AuthContext's logic
        const ADMIN_EMAILS = [
          'amanullah.100ms@gmail.com',
          'admin@biriyanistation.in'
        ]
        if (!ADMIN_EMAILS.includes(decoded.email)) {
           return res.status(403).json({ error: 'Forbidden: Admin access required' })
        }
      }
      
      return handler(req, res)
    } catch (e) {
      console.error('Auth Middleware Error:', e)
      return res.status(500).json({ error: 'Internal Server Error during authentication' })
    }
  }
}
