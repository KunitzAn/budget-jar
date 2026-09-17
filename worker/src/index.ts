import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRoutes from './routes/auth'
import periodsRoutes from './routes/periods'
import expensesRoutes from './routes/expenses'
import statsRoutes from './routes/stats'
import settingsRoutes from './routes/settings'
import type { Bindings, Variables } from './types'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use(
  '*',
  cors({
    origin: [
      'http://localhost:5173',
      'https://jar.kunitcan.online',
      'https://budget-jar.pages.dev',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
)

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/auth', authRoutes)
app.route('/periods', periodsRoutes)
app.route('/', expensesRoutes)
app.route('/stats', statsRoutes)
app.route('/settings', settingsRoutes)

export default app
