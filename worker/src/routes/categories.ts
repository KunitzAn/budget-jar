import { Hono } from 'hono'
import { createPrismaClient } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const categoriesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

categoriesRoutes.use('*', authMiddleware)

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

categoriesRoutes.get('/', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const categories = await prisma.category.findMany({
    where: { userId: c.get('userId') },
    orderBy: { createdAt: 'asc' },
  })
  return c.json(categories)
})

categoriesRoutes.post('/', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const body = await c.req.json<{
    name?: string
    color?: string
    inStats?: boolean
    inBalance?: boolean
  }>()

  const name = body.name?.trim()
  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }
  if (!body.color || !HEX_COLOR.test(body.color)) {
    return c.json({ error: 'Color must be a hex value like #ff6fa5' }, 400)
  }

  const category = await prisma.category.create({
    data: {
      userId: c.get('userId'),
      name,
      color: body.color,
      inStats: body.inStats ?? true,
      inBalance: body.inBalance ?? true,
    },
  })

  return c.json(category, 201)
})

categoriesRoutes.patch('/:id', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json<{
    name?: string
    color?: string
    inStats?: boolean
    inBalance?: boolean
  }>()

  const existing = await prisma.category.findFirst({
    where: { id, userId: c.get('userId') },
  })
  if (!existing) {
    return c.json({ error: 'Category not found' }, 404)
  }

  const data: { name?: string; color?: string; inStats?: boolean; inBalance?: boolean } = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return c.json({ error: 'Name is required' }, 400)
    data.name = name
  }
  if (body.color !== undefined) {
    if (!HEX_COLOR.test(body.color)) {
      return c.json({ error: 'Color must be a hex value like #ff6fa5' }, 400)
    }
    data.color = body.color
  }
  if (body.inStats !== undefined) data.inStats = body.inStats
  if (body.inBalance !== undefined) data.inBalance = body.inBalance

  const category = await prisma.category.update({ where: { id }, data })
  return c.json(category)
})

// Траты удалённой категории остаются, но становятся «без категории» (SetNull)
categoriesRoutes.delete('/:id', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const id = parseInt(c.req.param('id'))

  const existing = await prisma.category.findFirst({
    where: { id, userId: c.get('userId') },
  })
  if (!existing) {
    return c.json({ error: 'Category not found' }, 404)
  }

  await prisma.category.delete({ where: { id } })
  return c.body(null, 204)
})

export default categoriesRoutes
