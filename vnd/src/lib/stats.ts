import type { Exchange, Expense } from './db'
import { computeFifo, type FifoResult } from './fifo'

/** Траты и переводы в рубли пересчитываются по FIFO — единственный источник курса. */
export function fifoOf(exchanges: Exchange[], expenses: Expense[]): FifoResult {
  return computeFifo(
    exchanges.map((x) => ({ id: x.id, date: x.date, rub: x.rub, vnd: x.vnd, createdAt: x.createdAt })),
    expenses.map((e) => ({
      id: e.id,
      date: e.date,
      vnd: e.vnd,
      categoryId: e.categoryId,
      createdAt: e.createdAt,
    })),
  )
}

export type RangePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

export interface Range {
  from: string
  to: string
}

function shift(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function presetRange(preset: Exclude<RangePreset, 'custom'>): Range {
  const to = shift(0)
  switch (preset) {
    case 'today':
      return { from: to, to }
    case 'week':
      return { from: shift(6), to }
    case 'month':
      return { from: shift(29), to }
    case 'all':
      return { from: '0000-01-01', to: '9999-12-31' }
  }
}

export function inRange(date: string, range: Range): boolean {
  return date >= range.from && date <= range.to
}
