import api from '../lib/api'
import type { Category } from '../types'

// Управление категориями — только онлайн (как и создание периода). Сам список
// кэшируется GET-интерцептором, поэтому офлайн траты по-прежнему показывают
// свои категории и считаются по флагам.
export const getCategories = () => api.get<Category[]>('/categories')

export const createCategory = (body: {
  name: string
  color: string
  inStats: boolean
  inBalance: boolean
}) => api.post<Category>('/categories', body)

export const updateCategory = (
  id: number,
  body: Partial<{ name: string; color: string; inStats: boolean; inBalance: boolean }>,
) => api.patch<Category>(`/categories/${id}`, body)

export const deleteCategory = (id: number) => api.delete(`/categories/${id}`)
