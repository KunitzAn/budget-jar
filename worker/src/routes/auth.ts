import { Hono } from 'hono'
import { createPrismaClient } from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { verifyTelegramAuth } from '../lib/telegram'
import type { Bindings, Variables } from '../types'

const authRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

authRoutes.post('/telegram', async (c) => {
  const data = await c.req.json()

  const isValid = await verifyTelegramAuth(data, c.env.TELEGRAM_BOT_TOKEN)
  if (!isValid) {
    return c.json({ error: 'Invalid Telegram data' }, 401)
  }

  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const telegramId = BigInt(data.id)

  let user = await prisma.user.findUnique({ where: { telegramId } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        username: data.username || data.first_name,
      },
    })
  }

  const token = await signToken({ userId: user.id }, c.env.JWT_SECRET)

  return c.json({ token, user: { id: user.id, username: user.username } })
})

export default authRoutes
