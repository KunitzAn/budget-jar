import { Hono } from 'hono'
import { createPrismaClient } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const statsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

statsRoutes.use('*', authMiddleware)

statsRoutes.get('/', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const periods = await prisma.period.findMany({
    where: { userId: c.get('userId') },
    include: { expenses: true },
  })

  const totalIncome = periods.reduce((sum, p) => sum + Number(p.totalSum), 0)
  const totalExpenses = periods.reduce(
    (sum, p) => sum + p.expenses.reduce((s, e) => s + Number(e.amount), 0),
    0
  )
  const balance = totalIncome - totalExpenses

  return c.json({ totalIncome, totalExpenses, balance })
})

export default statsRoutes
