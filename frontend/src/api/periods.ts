import api from '../lib/api'
import type { Period } from '../types'
import { enqueueDeletePeriod } from '../lib/offlineQueue'

export const getPeriods = () => api.get<Period[]>('/periods')

export const getCurrentPeriod = () => api.get<Period>('/periods/current')

export const getPeriod = (id: number) => api.get<Period>(`/periods/${id}`)

// Создание периода офлайн не поддерживаем: пересечение дат (409) проверяется
// только сервером, без сети мы не можем это провалидировать.
export const createPeriod = (body: {
  startDate: string
  endDate: string
  totalSum: number
}) => api.post<Period>('/periods', body)

export const deletePeriod = async (id: number): Promise<void> => {
  try {
    await api.delete(`/periods/${id}`)
  } catch (error) {
    if (!(error as { response?: unknown })?.response) {
      enqueueDeletePeriod(id)
      return
    }
    throw error
  }
}
