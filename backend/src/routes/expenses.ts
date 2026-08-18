import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middleware/auth'
import prisma from '../lib/prisma'

export default async function expensesRoutes(server: FastifyInstance) {
  server.addHook('onRequest', authMiddleware)

  // Добавить трату к периоду
  server.post<{
    Params: { periodId: string }
    Body: { amount: number; date?: string; note?: string }
  }>('/periods/:periodId/expenses', async (request, reply) => {
    const periodId = parseInt(request.params.periodId)
    const { amount, date, note } = request.body

    if (amount <= 0) {
      return reply.status(400).send({ error: 'Amount must be positive' })
    }

    // Проверяем что период принадлежит пользователю
    const period = await prisma.period.findFirst({
      where: {
        id: periodId,
        userId: request.userId
      }
    })

    if (!period) {
      return reply.status(404).send({ error: 'Period not found' })
    }

    const expense = await prisma.expense.create({
      data: {
        periodId,
        amount,
        date: date ? new Date(date) : new Date(),
        note
      }
    })

    return reply.status(201).send(expense)
  })

  // Удалить трату
  server.delete<{ Params: { id: string } }>('/expenses/:id', async (request, reply) => {
    const expenseId = parseInt(request.params.id)

    // Проверяем что трата принадлежит периоду пользователя
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId },
      include: { period: true }
    })

    if (!expense || expense.period.userId !== request.userId) {
      return reply.status(404).send({ error: 'Expense not found' })
    }

    await prisma.expense.delete({ where: { id: expenseId } })

    return reply.status(204).send()
  })
}