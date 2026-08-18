import api from '../lib/api'
import type { Period } from '../types'

export const getPeriods = () => api.get<Period[]>('/periods')

export const getCurrentPeriod = () => api.get<Period>('/periods/current')

export const getPeriod = (id: number) => api.get<Period>(`/periods/${id}`)

export const createPeriod = (body: { 
  startDate: string
  endDate: string
  totalSum: number 
}) => api.post<Period>('/periods', body)

export const deletePeriod = (id: number) => api.delete(`/periods/${id}`)
