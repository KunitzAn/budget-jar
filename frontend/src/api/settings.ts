import api from '../lib/api'
import type { PaydayRule } from '../types'

export const getPaydayRules = () => api.get<PaydayRule[]>('/settings/payday-rules')

export const savePaydayRule = (body: {
  type: 'DAY_OF_MONTH' | 'FIRST_WEEKDAY'
  dayOfMonth?: number
  weekday?: number
  effectiveFrom: string
}) => api.post<{ rule: PaydayRule; rules: PaydayRule[] }>('/settings/payday-rules', body)
