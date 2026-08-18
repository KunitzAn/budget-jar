import api from '../lib/api'
import type { TelegramUser } from '../types'

export const loginWithTelegram = async (telegramData: TelegramUser) => {
  const { data } = await api.post('/auth/telegram', telegramData)
  localStorage.setItem('token', data.token)
  return data
}

export const logout = () => {
  localStorage.removeItem('token')
}
