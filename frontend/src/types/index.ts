export interface Period {
  id: number
  startDate: string
  endDate: string
  totalSum: number
  expenses: Expense[]
}

export interface Expense {
  // строковый id вида `local-...` — трата, добавленная офлайн и ещё не
  // отправленная на сервер (см. frontend/src/lib/offlineQueue.ts)
  id: number | string
  amount: number
  date: string
  note?: string
  periodId: number
}

export interface Stats {
  totalIncome: number
  totalExpenses: number
  balance: number
  periods: Period[]
}

export interface PaydayRule {
  id: number
  type: 'DAY_OF_MONTH' | 'FIRST_WEEKDAY'
  dayOfMonth: number | null
  // 0=воскресенье..6=суббота (JS Date.getUTCDay())
  weekday: number | null
  effectiveFrom: string
}

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}
