import { createMiddleware } from 'hono/factory'
import { verifyToken } from '../lib/jwt'
import type { Bindings, Variables } from '../types'

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
      const { userId } = await verifyToken(token, c.env.JWT_SECRET)
      c.set('userId', userId)
      await next()
    } catch {
      return c.json({ error: 'Unauthorized' }, 401)
    }
  }
)
