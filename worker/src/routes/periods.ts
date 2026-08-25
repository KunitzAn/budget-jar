import { Hono } from 'hono'
import { createPrismaClient } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const periodsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

periodsRoutes.use('*', authMiddleware)

// Получить все периоды пользователя
periodsRoutes.get('/', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const periods = await prisma.period.findMany({
    where: { userId: c.get('userId') },
    orderBy: { startDate: 'desc' },
    include: { expenses: true },
  })
  return c.json(periods)
})

// Получить текущий период
periodsRoutes.get('/current', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const now = new Date()
  const period = await prisma.period.findFirst({
    where: {
      userId: c.get('userId'),
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: { expenses: true },
  })

  if (!period) {
    return c.json({ error: 'No active period' }, 404)
  }

  return c.json(period)
})

// Получить один период по ID
periodsRoutes.get('/:id', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const periodId = parseInt(c.req.param('id'))

  const period = await prisma.period.findFirst({
    where: {
      id: periodId,
      userId: c.get('userId'),
    },
    include: { expenses: true },
  })

  if (!period) {
    return c.json({ error: 'Period not found' }, 404)
  }

  return c.json(period)
})

// Создать новый период
periodsRoutes.post('/', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const { startDate, endDate, totalSum } = await c.req.json<{
    startDate: string
    endDate: string
    totalSum: number
  }>()

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (start >= end) {
    return c.json({ error: 'End date must be after start date' }, 400)
  }

  if (totalSum <= 0) {
    return c.json({ error: 'Total sum must be positive' }, 400)
  }

  const userId = c.get('userId')

  const overlapping = await prisma.period.findFirst({
    where: {
      userId,
      startDate: { lte: end },
      endDate: { gte: start },
    },
  })

  if (overlapping) {
    return c.json(
      { error: 'Period dates overlap with existing period', conflictingPeriodId: overlapping.id },
      409
    )
  }

  const period = await prisma.period.create({
    data: {
      userId,
      startDate: start,
      endDate: end,
      totalSum,
    },
  })

  return c.json(period, 201)
})

// Удалить период
periodsRoutes.delete('/:id', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const periodId = parseInt(c.req.param('id'))

  const period = await prisma.period.findFirst({
    where: {
      id: periodId,
      userId: c.get('userId'),
    },
  })

  if (!period) {
    return c.json({ error: 'Period not found' }, 404)
  }

  await prisma.period.delete({ where: { id: periodId } })

  return c.body(null, 204)
})

export default periodsRoutes
