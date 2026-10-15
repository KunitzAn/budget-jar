import { Hono } from 'hono'
import { createPrismaClient } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const exchangesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

exchangesRoutes.use('*', authMiddleware)

const CURRENCY = /^[A-Z]{3}$/

type ExchangeBody = {
  date?: string
  fromCurrency?: string
  fromAmount?: number
  toCurrency?: string
  toAmount?: number
}

function validate(body: ExchangeBody): string | null {
  if (!body.fromCurrency || !CURRENCY.test(body.fromCurrency)) return 'Invalid fromCurrency'
  if (!body.toCurrency || !CURRENCY.test(body.toCurrency)) return 'Invalid toCurrency'
  if (body.fromCurrency === body.toCurrency) return 'Currencies must differ'
  if (!(typeof body.fromAmount === 'number') || body.fromAmount <= 0) return 'fromAmount must be positive'
  if (!(typeof body.toAmount === 'number') || body.toAmount <= 0) return 'toAmount must be positive'
  return null
}

exchangesRoutes.get('/', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const exchanges = await prisma.exchange.findMany({
    where: { userId: c.get('userId') },
    orderBy: { date: 'asc' },
  })
  return c.json(exchanges)
})

exchangesRoutes.post('/', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const body = await c.req.json<ExchangeBody>()

  const error = validate(body)
  if (error) return c.json({ error }, 400)

  const date = body.date ? new Date(body.date) : new Date()
  if (isNaN(date.getTime())) return c.json({ error: 'Invalid date' }, 400)

  const exchange = await prisma.exchange.create({
    data: {
      userId: c.get('userId'),
      date,
      fromCurrency: body.fromCurrency!,
      fromAmount: body.fromAmount!,
      toCurrency: body.toCurrency!,
      toAmount: body.toAmount!,
    },
  })

  return c.json(exchange, 201)
})

exchangesRoutes.patch('/:id', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json<ExchangeBody>()

  const existing = await prisma.exchange.findFirst({ where: { id, userId: c.get('userId') } })
  if (!existing) return c.json({ error: 'Exchange not found' }, 404)

  const merged: ExchangeBody = {
    fromCurrency: body.fromCurrency ?? existing.fromCurrency,
    toCurrency: body.toCurrency ?? existing.toCurrency,
    fromAmount: body.fromAmount ?? Number(existing.fromAmount),
    toAmount: body.toAmount ?? Number(existing.toAmount),
  }
  const error = validate(merged)
  if (error) return c.json({ error }, 400)

  const date = body.date ? new Date(body.date) : existing.date
  if (isNaN(date.getTime())) return c.json({ error: 'Invalid date' }, 400)

  const exchange = await prisma.exchange.update({
    where: { id },
    data: {
      date,
      fromCurrency: merged.fromCurrency!,
      fromAmount: merged.fromAmount!,
      toCurrency: merged.toCurrency!,
      toAmount: merged.toAmount!,
    },
  })

  return c.json(exchange)
})

exchangesRoutes.delete('/:id', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const id = parseInt(c.req.param('id'))

  const existing = await prisma.exchange.findFirst({ where: { id, userId: c.get('userId') } })
  if (!existing) return c.json({ error: 'Exchange not found' }, 404)

  await prisma.exchange.delete({ where: { id } })
  return c.body(null, 204)
})

export default exchangesRoutes
