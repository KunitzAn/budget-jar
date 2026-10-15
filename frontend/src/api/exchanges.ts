import api from '../lib/api'
import type { Exchange } from '../types'
import { enqueueAddExchange, enqueueDeleteExchange } from '../lib/offlineQueue'

function isNetworkError(error: unknown): boolean {
  return !(error as { response?: unknown })?.response
}

export type ExchangeBody = {
  date: string
  fromCurrency: string
  fromAmount: number
  toCurrency: string
  toAmount: number
}

export const getExchanges = () => api.get<Exchange[]>('/exchanges')

export const createExchange = async (body: ExchangeBody): Promise<{ data: Exchange }> => {
  try {
    return await api.post<Exchange>('/exchanges', body)
  } catch (error) {
    if (isNetworkError(error)) {
      return { data: enqueueAddExchange(body) }
    }
    throw error
  }
}

export const deleteExchange = async (id: number | string): Promise<void> => {
  if (typeof id === 'string' && id.startsWith('local-')) {
    enqueueDeleteExchange(id)
    return
  }

  try {
    await api.delete(`/exchanges/${id}`)
  } catch (error) {
    if (isNetworkError(error)) {
      enqueueDeleteExchange(id)
      return
    }
    throw error
  }
}
