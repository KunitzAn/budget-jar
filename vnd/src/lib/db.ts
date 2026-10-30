import Dexie, { type EntityTable } from 'dexie'

/**
 * Локальная копия данных. Приложение всегда читает отсюда, а не из сети:
 * в поездке интернет — самое ненадёжное, что есть, и экран должен
 * открываться мгновенно и офлайн.
 *
 * `dirty` — строка правилась локально и ещё не отправлена. Это не поле
 * сервера, в push оно не уходит.
 */

export interface SyncFields {
  createdAt: string
  updatedAt: string
  serverUpdatedAt?: string
  deletedAt: string | null
  dirty: boolean
}

export interface Category extends SyncFields {
  id: string
  name: string
  icon: string
  position: number
}

/** Статья, которая должна быть всегда: трате без статьи деваться некуда. */
export const DEFAULT_CATEGORY_NAME = 'Другое'

/** Перевод рублей в донги — он же «шкала». */
export interface Exchange extends SyncFields {
  id: string
  date: string // YYYY-MM-DD
  rub: number
  vnd: number
}

export interface Expense extends SyncFields {
  id: string
  date: string // YYYY-MM-DD
  vnd: number
  categoryId: string
  comment: string | null
}

export const db = new Dexie('budget-vnd') as Dexie & {
  categories: EntityTable<Category, 'id'>
  exchanges: EntityTable<Exchange, 'id'>
  expenses: EntityTable<Expense, 'id'>
}

// dirty не индексируем: Dexie не умеет индексировать boolean, фильтруем перебором
db.version(1).stores({
  categories: 'id, position, updatedAt',
  exchanges: 'id, date, updatedAt',
  expenses: 'id, date, categoryId, updatedAt',
})

export function newId(): string {
  return crypto.randomUUID()
}

/** Локальная дата в формате YYYY-MM-DD — даты тут календарные, не моменты. */
export function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function touch(): Pick<SyncFields, 'updatedAt' | 'dirty'> {
  return { updatedAt: new Date().toISOString(), dirty: true }
}
