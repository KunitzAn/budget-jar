import api from '../lib/api'
import type { Expense } from '../types'

export const addExpense = (
  periodId: number, 
  body: { amount: number; date?: string; note?: string }
) => api.post<Expense>(`/periods/${periodId}/expenses`, body)

export const deleteExpense = (id: number) => api.delete(`/expenses/${id}`)
