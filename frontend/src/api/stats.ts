import api from '../lib/api'
import type { Stats } from '../types'

export const getStats = () => api.get<Stats>('/stats')
