import { Hono } from 'hono'
import { createPrismaClient } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const settingsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

settingsRoutes.use('*', authMiddleware)

// Вся история правил зарплатного месяца, отсортированная по effectiveFrom
settingsRoutes.get('/payday-rules', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const rules = await prisma.paydayRule.findMany({
    where: { userId: c.get('userId') },
    orderBy: { effectiveFrom: 'asc' },
  })
  return c.json(rules)
})

// Сохранить новое правило: заменяет всю историю начиная с effectiveFrom —
// так применяется "с какого месяца" (в т.ч. задним числом).
settingsRoutes.post('/payday-rules', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const body = await c.req.json<{
    type: string
    dayOfMonth?: number
    weekday?: number
    effectiveFrom: string
  }>()

  if (body.type !== 'DAY_OF_MONTH' && body.type !== 'FIRST_WEEKDAY') {
    return c.json({ error: 'Invalid type' }, 400)
  }

  if (body.type === 'DAY_OF_MONTH') {
    if (!Number.isInteger(body.dayOfMonth) || body.dayOfMonth! < 1 || body.dayOfMonth! > 31) {
      return c.json({ error: 'dayOfMonth must be between 1 and 31' }, 400)
    }
  } else {
    if (!Number.isInteger(body.weekday) || body.weekday! < 0 || body.weekday! > 6) {
      return c.json({ error: 'weekday must be between 0 and 6' }, 400)
    }
  }

  const effectiveFrom = new Date(body.effectiveFrom)
  if (isNaN(effectiveFrom.getTime())) {
    return c.json({ error: 'Invalid effectiveFrom' }, 400)
  }

  const userId = c.get('userId')

  await prisma.paydayRule.deleteMany({
    where: { userId, effectiveFrom: { gte: effectiveFrom } },
  })

  const rule = await prisma.paydayRule.create({
    data: {
      userId,
      type: body.type,
      dayOfMonth: body.type === 'DAY_OF_MONTH' ? body.dayOfMonth : null,
      weekday: body.type === 'FIRST_WEEKDAY' ? body.weekday : null,
      effectiveFrom,
    },
  })

  const rules = await prisma.paydayRule.findMany({
    where: { userId },
    orderBy: { effectiveFrom: 'asc' },
  })

  return c.json({ rule, rules }, 201)
})

export default settingsRoutes
