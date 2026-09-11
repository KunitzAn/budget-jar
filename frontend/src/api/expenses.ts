import api from '../lib/api'
import type { Expense } from '../types'
import { dequeueLocalExpense, enqueueAddExpense, enqueueDeleteExpense } from '../lib/offlineQueue'

function isNetworkError(error: unknown): boolean {
  return !(error as { response?: unknown })?.response
}

export const addExpense = async (
  periodId: number,
  body: { amount: number; date?: string; note?: string },
): Promise<{ data: Expense }> => {
  try {
    return await api.post<Expense>(`/periods/${periodId}/expenses`, body)
  } catch (error) {
    if (isNetworkError(error)) {
      return { data: enqueueAddExpense(periodId, body) }
    }
    throw error
  }
}

export const deleteExpense = async (id: number | string, periodId: number): Promise<void> => {
  if (typeof id === 'string' && id.startsWith('local-')) {
    dequeueLocalExpense(id, periodId)
    return
  }

  try {
    await api.delete(`/expenses/${id}`)
  } catch (error) {
    if (isNetworkError(error)) {
      enqueueDeleteExpense(id as number, periodId)
      return
    }
    throw error
  }
}
