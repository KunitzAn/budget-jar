import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import authRoutes from './routes/auth'
import periodsRoutes from './routes/periods'
import expensesRoutes from './routes/expenses'
import statsRoutes from './routes/stats'

const server = Fastify({ 
  logger: true 
})

server.register(cors, { 
  origin: true,
  credentials: true
})

server.register(jwt, { 
  secret: process.env.JWT_SECRET || 'changeme'
})

server.register(authRoutes, { prefix: '/auth' })
server.register(periodsRoutes, { prefix: '/periods' })
server.register(expensesRoutes)
server.register(statsRoutes, { prefix: '/stats' })

server.get('/health', async () => {
  return { status: 'ok' }
})

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001')
    const host = process.env.HOST || '0.0.0.0'
    
    await server.listen({ port, host })
    console.log(`🚀 Server running on http://${host}:${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()