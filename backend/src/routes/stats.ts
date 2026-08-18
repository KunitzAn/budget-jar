import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middleware/auth'
import prisma from '../lib/prisma'

export default async function statsRoutes(server: FastifyInstance) {
  server.addHook('onRequest', authMiddleware)

  server.get('/', async (request, reply) => {
    const periods = await prisma.period.findMany({
      where: { userId: request.userId },
      include: { expenses: true }
    })

    const totalIncome = periods.reduce((sum, p) => sum + Number(p.totalSum), 0)
    const totalExpenses = periods.reduce(
      (sum, p) => sum + p.expenses.reduce((s, e) => s + Number(e.amount), 0),
      0
    )
    const balance = totalIncome - totalExpenses

    return {
      totalIncome,
      totalExpenses,
      balance
    }
  })
}