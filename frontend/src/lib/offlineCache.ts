import type { Exchange, Expense, Period } from '../types'

const PREFIX = 'cache:'

export function getCache<T>(url: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + url)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export function setCache(url: string, data: unknown) {
  try {
    localStorage.setItem(PREFIX + url, JSON.stringify(data))
  } catch {
    // localStorage переполнен/недоступен — офлайн-кэш необязателен для работы приложения
  }
}

function removeCache(url: string) {
  try {
    localStorage.removeItem(PREFIX + url)
  } catch {
    // ignore
  }
}

function withExpenses(period: Period, updater: (expenses: Expense[]) => Expense[]): Period {
  return { ...period, expenses: updater(period.expenses) }
}

/** Применяет трату ко всем кэш-слотам, где встречается этот период. */
export function applyOptimisticExpenseAdd(periodId: number, expense: Expense) {
  const current = getCache<Period>('/periods/current')
  if (current && current.id === periodId) {
    setCache('/periods/current', withExpenses(current, (es) => [...es, expense]))
  }

  const byId = getCache<Period>(`/periods/${periodId}`)
  if (byId) {
    setCache(`/periods/${periodId}`, withExpenses(byId, (es) => [...es, expense]))
  }

  const list = getCache<Period[]>('/periods')
  if (list) {
    setCache(
      '/periods',
      list.map((p) => (p.id === periodId ? withExpenses(p, (es) => [...es, expense]) : p)),
    )
  }
}

/** Убирает трату из всех кэш-слотов. */
export function applyOptimisticExpenseRemove(periodId: number, expenseId: number | string) {
  const current = getCache<Period>('/periods/current')
  if (current && current.id === periodId) {
    setCache('/periods/current', withExpenses(current, (es) => es.filter((e) => e.id !== expenseId)))
  }

  const byId = getCache<Period>(`/periods/${periodId}`)
  if (byId) {
    setCache(`/periods/${periodId}`, withExpenses(byId, (es) => es.filter((e) => e.id !== expenseId)))
  }

  const list = getCache<Period[]>('/periods')
  if (list) {
    setCache(
      '/periods',
      list.map((p) => (p.id === periodId ? withExpenses(p, (es) => es.filter((e) => e.id !== expenseId)) : p)),
    )
  }
}

/** Меняет категорию траты во всех кэш-слотах. */
export function applyOptimisticExpenseCategory(
  periodId: number,
  expenseId: number | string,
  categoryId: number | null,
) {
  const update = (es: Expense[]) => es.map((e) => (e.id === expenseId ? { ...e, categoryId } : e))

  const current = getCache<Period>('/periods/current')
  if (current && current.id === periodId) setCache('/periods/current', withExpenses(current, update))

  const byId = getCache<Period>(`/periods/${periodId}`)
  if (byId) setCache(`/periods/${periodId}`, withExpenses(byId, update))

  const list = getCache<Period[]>('/periods')
  if (list) setCache('/periods', list.map((p) => (p.id === periodId ? withExpenses(p, update) : p)))
}

/** Заменяет временный (local-...) id траты на реальный после синхронизации. */
export function replaceOptimisticExpenseId(periodId: number, tempId: string, realExpense: Expense) {
  const replace = (es: Expense[]) => es.map((e) => (e.id === tempId ? realExpense : e))

  const current = getCache<Period>('/periods/current')
  if (current && current.id === periodId) setCache('/periods/current', withExpenses(current, replace))

  const byId = getCache<Period>(`/periods/${periodId}`)
  if (byId) setCache(`/periods/${periodId}`, withExpenses(byId, replace))

  const list = getCache<Period[]>('/periods')
  if (list) setCache('/periods', list.map((p) => (p.id === periodId ? withExpenses(p, replace) : p)))
}

/** Обмены лежат одним списком, отсортированным по дате — порядок важен для FIFO. */
function setExchanges(update: (list: Exchange[]) => Exchange[]) {
  const list = getCache<Exchange[]>('/exchanges')
  if (!list) return
  const next = update(list).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  setCache('/exchanges', next)
}

export function applyOptimisticExchangeAdd(exchange: Exchange) {
  setExchanges((list) => [...list, exchange])
}

export function applyOptimisticExchangeRemove(id: number | string) {
  setExchanges((list) => list.filter((e) => e.id !== id))
}

export function replaceOptimisticExchangeId(tempId: string, real: Exchange) {
  setExchanges((list) => list.map((e) => (e.id === tempId ? real : e)))
}

/** Убирает период из всех кэш-слотов. */
export function applyOptimisticPeriodRemove(periodId: number) {
  const list = getCache<Period[]>('/periods')
  if (list) setCache('/periods', list.filter((p) => p.id !== periodId))

  const current = getCache<Period>('/periods/current')
  if (current && current.id === periodId) removeCache('/periods/current')

  removeCache(`/periods/${periodId}`)
}
