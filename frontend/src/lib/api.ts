import axios from 'axios'
import { getCache, setCache } from './offlineCache'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Кэшируем успешные GET-ответы и подменяем ими сетевые сбои (офлайн-режим).
// Настоящие HTTP-ошибки (404, 409 и т.д. — у них есть error.response) не трогаем.
api.interceptors.response.use(
  (response) => {
    if (response.config.method === 'get' && response.config.url) {
      setCache(response.config.url, response.data)
    }
    return response
  },
  (error) => {
    const config = error.config
    if (config?.method === 'get' && !error.response && config.url) {
      const cached = getCache(config.url)
      if (cached !== undefined) {
        return Promise.resolve({
          data: cached,
          status: 200,
          statusText: 'OK (cached)',
          headers: {},
          config,
          fromCache: true,
        })
      }
    }
    return Promise.reject(error)
  },
)

export default api
