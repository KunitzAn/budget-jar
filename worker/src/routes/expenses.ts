import { Hono } from 'hono'
import { createPrismaClient } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const expensesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

expensesRoutes.use('*', authMiddleware)

// Добавить трату к периоду
expensesRoutes.post('/periods/:periodId/expenses', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const periodId = parseInt(c.req.param('periodId'))
  const { amount, date, note } = await c.req.json<{
    amount: number
    date?: string
    note?: string
  }>()

  if (amount <= 0) {
    return c.json({ error: 'Amount must be positive' }, 400)
  }

  const period = await prisma.period.findFirst({
    where: {
      id: periodId,
      userId: c.get('userId'),
    },
  })

  if (!period) {
    return c.json({ error: 'Period not found' }, 404)
  }

  const expense = await prisma.expense.create({
    data: {
      periodId,
      amount,
      date: date ? new Date(date) : new Date(),
      note,
    },
  })

  return c.json(expense, 201)
})

// Удалить трату
expensesRoutes.delete('/expenses/:id', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const expenseId = parseInt(c.req.param('id'))

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId },
    include: { period: true },
  })

  if (!expense || expense.period.userId !== c.get('userId')) {
    return c.json({ error: 'Expense not found' }, 404)
  }

  await prisma.expense.delete({ where: { id: expenseId } })

  return c.body(null, 204)
})

export default expensesRoutes
