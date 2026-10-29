/**
 * Пересчёт трат в донгах в рубли по FIFO: сначала тратится то, что переведено
 * раньше. Одна трата может разойтись по двум переводам с разными курсами —
 * тогда её рублёвая стоимость складывается из кусков.
 *
 * Рублёвая стоимость нигде не хранится, а считается отсюда каждый раз. Это
 * не прихоть: перевод, внесённый задним числом (забыла записать), должен
 * сам починить курс у всех трат после него. При «заморозке» они бы молча
 * остались с неверным курсом.
 */

export interface ExchangeInput {
  id: string
  date: string // YYYY-MM-DD
  rub: number
  vnd: number
  createdAt: string
}

export interface ExpenseInput {
  id: string
  date: string // YYYY-MM-DD
  vnd: number
  categoryId: string
  createdAt: string
}

/** Кусок траты, взятый из конкретного перевода. */
export interface Chunk {
  expenseId: string
  exchangeId: string | null // null — переведённого не хватило
  vnd: number
  rub: number
}

/** Шкала — перевод и то, сколько от него осталось. */
export interface Bar {
  id: string
  date: string
  rub: number
  vnd: number
  /** Рублей за один донг. */
  rate: number
  spentVnd: number
  remainingVnd: number
  /** Остаток в рублях — по курсу этого же перевода. */
  remainingRub: number
  /** 0..100, сколько осталось. */
  percent: number
  /** Куски трат, ушедших из этой шкалы, в порядке трат. */
  chunks: Chunk[]
}

export interface FifoResult {
  bars: Bar[]
  /** Рублёвая стоимость каждой траты по id. */
  rubByExpense: Map<string, number>
  /** Из каких переводов набрана каждая трата. */
  chunksByExpense: Map<string, Chunk[]>
  /** Донгов потрачено сверх переведённого (посчитано по последнему курсу). */
  overdraftVnd: number
  /** Всего на руках сейчас. */
  remainingVnd: number
  remainingRub: number
}

type Event =
  | { kind: 'exchange'; key: string; item: ExchangeInput }
  | { kind: 'expense'; key: string; item: ExpenseInput }

/** Дата, затем переводы перед тратами того же дня, затем порядок внесения. */
function sortKey(date: string, kindOrder: number, createdAt: string, id: string): string {
  return `${date}|${kindOrder}|${createdAt}|${id}`
}

export function computeFifo(exchanges: ExchangeInput[], expenses: ExpenseInput[]): FifoResult {
  const events: Event[] = [
    ...exchanges.map((item) => ({
      kind: 'exchange' as const,
      key: sortKey(item.date, 0, item.createdAt, item.id),
      item,
    })),
    ...expenses.map((item) => ({
      kind: 'expense' as const,
      key: sortKey(item.date, 1, item.createdAt, item.id),
      item,
    })),
  ].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  const bars: Bar[] = []
  const barById = new Map<string, Bar>()
  // очередь непотраченных шкал, старые впереди
  const queue: Bar[] = []
  let lastRate = 0

  const rubByExpense = new Map<string, number>()
  const chunksByExpense = new Map<string, Chunk[]>()
  let overdraftVnd = 0

  for (const event of events) {
    if (event.kind === 'exchange') {
      const x = event.item
      if (x.vnd <= 0 || x.rub <= 0) continue
      const rate = x.rub / x.vnd
      const bar: Bar = {
        id: x.id,
        date: x.date,
        rub: x.rub,
        vnd: x.vnd,
        rate,
        spentVnd: 0,
        remainingVnd: x.vnd,
        remainingRub: x.rub,
        percent: 100,
        chunks: [],
      }
      bars.push(bar)
      barById.set(bar.id, bar)
      queue.push(bar)
      lastRate = rate
      continue
    }

    const e = event.item
    let left = e.vnd
    let rub = 0
    const chunks: Chunk[] = []

    while (left > 0 && queue.length > 0) {
      const head = queue[0]!
      const take = Math.min(left, head.remainingVnd)
      const chunkRub = take * head.rate
      const chunk: Chunk = { expenseId: e.id, exchangeId: head.id, vnd: take, rub: chunkRub }
      chunks.push(chunk)
      head.chunks.push(chunk)
      head.remainingVnd -= take
      head.spentVnd += take
      head.remainingRub = head.remainingVnd * head.rate
      head.percent = head.vnd > 0 ? (head.remainingVnd / head.vnd) * 100 : 0
      rub += chunkRub
      left -= take
      if (head.remainingVnd <= 0) queue.shift()
    }

    if (left > 0) {
      // переведено меньше, чем потрачено: добираем по последнему курсу
      rub += left * lastRate
      chunks.push({ expenseId: e.id, exchangeId: null, vnd: left, rub: left * lastRate })
      overdraftVnd += left
    }

    rubByExpense.set(e.id, rub)
    chunksByExpense.set(e.id, chunks)
  }

  const remainingVnd = queue.reduce((s, b) => s + b.remainingVnd, 0)
  const remainingRub = queue.reduce((s, b) => s + b.remainingRub, 0)

  return { bars, rubByExpense, chunksByExpense, overdraftVnd, remainingVnd, remainingRub }
}

/** Шкалы сверху вниз: сначала та, из которой тратим сейчас. */
export function activeBars(result: FifoResult): Bar[] {
  return result.bars.filter((b) => b.remainingVnd > 0)
}
