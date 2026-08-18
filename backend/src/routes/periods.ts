import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middleware/auth'
import prisma from '../lib/prisma'

export default async function periodsRoutes(server: FastifyInstance) {
  server.addHook('onRequest', authMiddleware)

  // Получить все периоды пользователя
  server.get('/', async (request, reply) => {
    const periods = await prisma.period.findMany({
      where: { userId: request.userId },
      orderBy: { startDate: 'desc' },
      include: { expenses: true }
    })
    return periods
  })

  // Получить текущий период
  server.get('/current', async (request, reply) => {
    const now = new Date()
    const period = await prisma.period.findFirst({
      where: {
        userId: request.userId,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      include: { expenses: true }
    })

    if (!period) {
      return reply.status(404).send({ error: 'No active period' })
    }

    return period
  })

  // Получить один период по ID
  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const periodId = parseInt(request.params.id)
    
    const period = await prisma.period.findFirst({
      where: {
        id: periodId,
        userId: request.userId
      },
      include: { expenses: true }
    })

    if (!period) {
      return reply.status(404).send({ error: 'Period not found' })
    }

    return period
  })

  // Создать новый период
  server.post<{
    Body: { startDate: string; endDate: string; totalSum: number }
  }>('/', async (request, reply) => {
    const { startDate, endDate, totalSum } = request.body

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start >= end) {
      return reply.status(400).send({ error: 'End date must be after start date' })
    }

    if (totalSum <= 0) {
      return reply.status(400).send({ error: 'Total sum must be positive' })
    }

    const period = await prisma.period.create({
      data: {
        userId: request.userId,
        startDate: start,
        endDate: end,
        totalSum
      }
    })

    return reply.status(201).send(period)
  })

  // Удалить период
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const periodId = parseInt(request.params.id)

    const period = await prisma.period.findFirst({
      where: {
        id: periodId,
        userId: request.userId
      }
    })

    if (!period) {
      return reply.status(404).send({ error: 'Period not found' })
    }

    await prisma.period.delete({ where: { id: periodId } })

    return reply.status(204).send()
  })
}