import type { Exchange, Expense, Period } from '../types'
import { toUTCDay } from './periodMath'

export const BASE_CURRENCY = 'RUB'

const SYMBOLS: Record<string, string> = { RUB: '₽', VND: '₫', USD: '$' }

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? code
}

/** Сумма в произвольной валюте: рубли округляем, донги тоже (копеек в них нет). */
export function formatAmount(value: number, currency: string): string {
  const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
  return `${formatted} ${currencySymbol(currency)}`
}

/** Из какой партии обмена взят кусок траты — для расшифровки в интерфейсе. */
export interface ConversionChunk {
  amount: number // в иностранной валюте
  rub: number
  exchangeId: number | string | null // null — курса не хватило, взяли последний известный
  exchangeDate: string | null
}

export interface ConversionResult {
  /** Рублёвая стоимость каждой траты в иностранной валюте, по id траты. */
  rubByExpense: Map<number | string, number>
  chunksByExpense: Map<number | string, ConversionChunk[]>
  /** Сколько валюты осталось на руках и сколько рублей она стоила. */
  walletByCurrency: Map<string, { amount: number; rub: number }>
  /** Потрачено больше, чем обменяно, — такие суммы посчитаны по последнему курсу. */
  overdraftByCurrency: Map<string, number>
}

interface Batch {
  exchangeId: number | string
  date: string
  rubPerUnit: number
  remaining: number
}

type Event =
  | { kind: 'exchange'; day: number; order: number; exchange: Exchange }
  | { kind: 'expense'; day: number; order: number; expense: Expense }

/**
 * Пересчитывает траты в иностранной валюте в рубли по FIFO: сначала тратится
 * то, что обменяно раньше. Одна трата может разойтись по двум партиям с разными
 * курсами — тогда её рублёвая стоимость складывается из кусков.
 *
 * Считается по сквозной истории всех периодов: партия валюты спокойно переживает
 * границу периода. Если обмен и трата попали на одну дату, обмен считается более
 * ранним — сначала меняют, потом тратят.
 */
export function convertExpenses(exchanges: Exchange[], expenses: Expense[]): ConversionResult {
  const foreign = expenses.filter((e) => (e.currency ?? BASE_CURRENCY) !== BASE_CURRENCY)

  const events: Event[] = [
    ...exchanges.map((exchange) => ({
      kind: 'exchange' as const,
      day: toUTCDay(exchange.date),
      order: 0,
      exchange,
    })),
    ...foreign.map((expense) => ({
      kind: 'expense' as const,
      day: toUTCDay(expense.date),
      order: 1,
      expense,
    })),
  ].sort((a, b) => a.day - b.day || a.order - b.order)

  // очередь партий и последний известный курс — отдельно по каждой валюте
  const batches = new Map<string, Batch[]>()
  const lastRate = new Map<string, { rubPerUnit: number; exchangeId: number | string; date: string }>()
  const rubByExpense = new Map<number | string, number>()
  const chunksByExpense = new Map<number | string, ConversionChunk[]>()
  const overdraftByCurrency = new Map<string, number>()

  for (const event of events) {
    if (event.kind === 'exchange') {
      const { toCurrency, toAmount, fromAmount, id, date } = event.exchange
      const amount = Number(toAmount)
      if (amount <= 0) continue
      const rubPerUnit = Number(fromAmount) / amount
      const queue = batches.get(toCurrency) ?? []
      queue.push({ exchangeId: id, date, rubPerUnit, remaining: amount })
      batches.set(toCurrency, queue)
      lastRate.set(toCurrency, { rubPerUnit, exchangeId: id, date })
      continue
    }

    const expense = event.expense
    const currency = expense.currency ?? BASE_CURRENCY
    let left = Number(expense.amount)
    let rub = 0
    const chunks: ConversionChunk[] = []
    const queue = batches.get(currency) ?? []

    while (left > 0 && queue.length > 0) {
      const head = queue[0]
      const take = Math.min(left, head.remaining)
      const chunkRub = take * head.rubPerUnit
      rub += chunkRub
      chunks.push({ amount: take, rub: chunkRub, exchangeId: head.exchangeId, exchangeDate: head.date })
      head.remaining -= take
      left -= take
      if (head.remaining <= 0) queue.shift()
    }

    if (left > 0) {
      // обменяно меньше, чем потрачено: добираем по последнему известному курсу
      const fallback = lastRate.get(currency)
      const rubPerUnit = fallback?.rubPerUnit ?? 0
      rub += left * rubPerUnit
      chunks.push({ amount: left, rub: left * rubPerUnit, exchangeId: null, exchangeDate: null })
      overdraftByCurrency.set(currency, (overdraftByCurrency.get(currency) ?? 0) + left)
    }

    rubByExpense.set(expense.id, rub)
    chunksByExpense.set(expense.id, chunks)
  }

  const walletByCurrency = new Map<string, { amount: number; rub: number }>()
  for (const [currency, queue] of batches) {
    const amount = queue.reduce((s, b) => s + b.remaining, 0)
    const rub = queue.reduce((s, b) => s + b.remaining * b.rubPerUnit, 0)
    if (amount > 0) walletByCurrency.set(currency, { amount, rub })
  }

  return { rubByExpense, chunksByExpense, walletByCurrency, overdraftByCurrency }
}

/** Собирает все траты из всех периодов — FIFO считается по сквозной истории. */
export function allExpenses(periods: Period[]): Expense[] {
  return periods.flatMap((p) => p.expenses)
}

/** Трата в рублях: для рублёвой — как есть, для валютной — из результата пересчёта. */
export function expenseRub(expense: Expense, conversion: ConversionResult): number {
  if ((expense.currency ?? BASE_CURRENCY) === BASE_CURRENCY) return Number(expense.amount)
  return conversion.rubByExpense.get(expense.id) ?? 0
}

/** Период, в котором все траты выражены в рублях — на нём работает вся остальная математика. */
export function toRubPeriod(period: Period, conversion: ConversionResult): Period {
  return {
    ...period,
    expenses: period.expenses.map((e) =>
      (e.currency ?? BASE_CURRENCY) === BASE_CURRENCY
        ? e
        : { ...e, amount: expenseRub(e, conversion), currency: BASE_CURRENCY },
    ),
  }
}

export function toRubPeriods(periods: Period[], conversion: ConversionResult): Period[] {
  return periods.map((p) => toRubPeriod(p, conversion))
}
