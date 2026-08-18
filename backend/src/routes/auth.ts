import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import prisma from '../lib/prisma'

function verifyTelegramAuth(data: any, botToken: string): boolean {
  const { hash, ...fields } = data
  const secret = crypto.createHash('sha256').update(botToken).digest()
  const checkString = Object.keys(fields)
    .sort()
    .map(key => `${key}=${fields[key]}`)
    .join('\n')
  const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex')
  return hmac === hash
}

export default async function authRoutes(server: FastifyInstance) {
  server.post('/telegram', async (request, reply) => {
    const data = request.body as any
    const botToken = process.env.TELEGRAM_BOT_TOKEN!

    if (!verifyTelegramAuth(data, botToken)) {
      return reply.status(401).send({ error: 'Invalid Telegram data' })
    }

    const telegramId = BigInt(data.id)
    
    let user = await prisma.user.findUnique({
      where: { telegramId }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          username: data.username || data.first_name
        }
      })
    }

    const token = server.jwt.sign({ userId: user.id })

    return { token, user: { id: user.id, username: user.username } }
  })
}