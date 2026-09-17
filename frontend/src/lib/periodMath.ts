import type { Period } from '../types'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000 // МСК = UTC+3

// округляем момент до «дня» по московскому времени
// (новый день наступает в 00:00 МСК, а не 00:00 UTC)
export function toUTCDay(d: string | Date): number {
  const t = new Date(d).getTime() + MSK_OFFSET_MS
  const dt = new Date(t)
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
}

export function totalDays(period: Period): number {
  return Math.round((toUTCDay(period.endDate) - toUTCDay(period.startDate)) / MS_PER_DAY) + 1
}

export function dailyBudget(period: Period): number {
  const days = totalDays(period)
  if (days <= 0) return 0
  return Number(period.totalSum) / days
}

export function daysPassed(period: Period): number {
  const days = totalDays(period)
  const start = toUTCDay(period.startDate)
  const today = toUTCDay(new Date())
  const passed = Math.round((today - start) / MS_PER_DAY) + 1
  return Math.max(0, Math.min(passed, days))
}

export function daysLeft(period: Period): number {
  const end = toUTCDay(period.endDate)
  const today = toUTCDay(new Date())
  return Math.max(0, Math.round((end - today) / MS_PER_DAY))
}

export function isActive(period: Period): boolean {
  const today = toUTCDay(new Date())
  return today >= toUTCDay(period.startDate) && today <= toUTCDay(period.endDate)
}

export function isFuture(period: Period): boolean {
  return toUTCDay(new Date()) < toUTCDay(period.startDate)
}

export function spentSoFar(period: Period): number {
  return period.expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
}

export function spentToday(period: Period): number {
  const today = toUTCDay(new Date())
  return period.expenses
    .filter((exp) => toUTCDay(exp.date) === today)
    .reduce((sum, exp) => sum + Number(exp.amount), 0)
}

export function earnedSoFar(period: Period): number {
  return dailyBudget(period) * daysPassed(period)
}

/** Сколько уже накоплено по дневной норме минус потрачено. */
export function currentBalance(period: Period): number {
  return earnedSoFar(period) - spentSoFar(period)
}

/** Сколько останется в конце периода, если больше ничего не тратить. */
export function remainingIfNoMoreSpending(period: Period): number {
  return Number(period.totalSum) - spentSoFar(period)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDateRange(start: string, end: string, withYear = true): string {
  const s = new Date(start)
  const e = new Date(end)
  const fmt = new Intl.DateTimeFormat(
    'ru-RU',
    withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' },
  )
  return `${fmt.format(s)} — ${fmt.format(e)}`
}

export function formatDate(d: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}
