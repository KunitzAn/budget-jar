export interface Period {
  id: number
  startDate: string
  endDate: string
  totalSum: number
  expenses: Expense[]
}

export interface Expense {
  id: number
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

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}
