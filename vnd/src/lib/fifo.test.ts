import { describe, expect, it } from 'vitest'
import { computeFifo, type ExchangeInput, type ExpenseInput } from './fifo'

const ex = (id: string, date: string, rub: number, vnd: number): ExchangeInput => ({
  id,
  date,
  rub,
  vnd,
  createdAt: `${date}T10:00:00.000Z`,
})

const sp = (id: string, date: string, vnd: number): ExpenseInput => ({
  id,
  date,
  vnd,
  categoryId: 'other',
  createdAt: `${date}T12:00:00.000Z`,
})

describe('computeFifo', () => {
  it('тратит сначала то, что переведено раньше, и режет трату между шкалами', () => {
    const r = computeFifo(
      [ex('x1', '2026-10-05', 10000, 3_000_000), ex('x2', '2026-10-12', 10000, 2_800_000)],
      [sp('e1', '2026-10-06', 1_800_000), sp('e2', '2026-10-13', 1_500_000)],
    )

    expect(r.rubByExpense.get('e1')).toBeCloseTo(6000, 2)
    // 1 200 000 по курсу первой (4000 ₽) + 300 000 по курсу второй (1071.43 ₽)
    expect(r.rubByExpense.get('e2')).toBeCloseTo(5071.43, 2)

    const chunks = r.chunksByExpense.get('e2')!
    expect(chunks).toHaveLength(2)
    expect(chunks[0]!.exchangeId).toBe('x1')
    expect(chunks[0]!.vnd).toBe(1_200_000)
    expect(chunks[1]!.exchangeId).toBe('x2')
    expect(chunks[1]!.vnd).toBe(300_000)
  })

  it('считает остаток и процент по каждой шкале', () => {
    const r = computeFifo(
      [ex('x1', '2026-10-05', 10000, 3_000_000), ex('x2', '2026-10-12', 10000, 2_800_000)],
      [sp('e1', '2026-10-06', 1_800_000)],
    )

    const [first, second] = r.bars
    expect(first!.remainingVnd).toBe(1_200_000)
    expect(first!.percent).toBeCloseTo(40, 5)
    expect(first!.remainingRub).toBeCloseTo(4000, 2)
    expect(second!.percent).toBe(100)

    expect(r.remainingVnd).toBe(4_000_000)
    expect(r.remainingRub).toBeCloseTo(14000, 2)
  })

  it('следующая шкала начинает тратиться только после окончания предыдущей', () => {
    const r = computeFifo(
      [ex('x1', '2026-10-05', 1000, 300_000), ex('x2', '2026-10-06', 1000, 250_000)],
      [sp('e1', '2026-10-07', 400_000)],
    )

    const chunks = r.chunksByExpense.get('e1')!
    expect(chunks.map((c) => c.exchangeId)).toEqual(['x1', 'x2'])
    expect(r.bars[0]!.remainingVnd).toBe(0)
    expect(r.bars[1]!.remainingVnd).toBe(150_000)
  })

  it('порядок внесения не важен — считаем по датам', () => {
    const forward = computeFifo(
      [ex('x1', '2026-10-05', 10000, 3_000_000), ex('x2', '2026-10-12', 10000, 2_800_000)],
      [sp('e1', '2026-10-06', 1_800_000), sp('e2', '2026-10-13', 1_500_000)],
    )
    const backward = computeFifo(
      [ex('x2', '2026-10-12', 10000, 2_800_000), ex('x1', '2026-10-05', 10000, 3_000_000)],
      [sp('e2', '2026-10-13', 1_500_000), sp('e1', '2026-10-06', 1_800_000)],
    )
    expect(backward.rubByExpense.get('e2')).toBeCloseTo(forward.rubByExpense.get('e2')!, 6)
  })

  it('перевод того же дня считается раньше траты', () => {
    const r = computeFifo([ex('x1', '2026-10-05', 1000, 300_000)], [sp('e1', '2026-10-05', 60_000)])
    expect(r.rubByExpense.get('e1')).toBeCloseTo(200, 6)
  })

  it('потрачено больше, чем переведено — добирает по последнему курсу и помечает перерасход', () => {
    const r = computeFifo([ex('x1', '2026-10-05', 10000, 3_000_000)], [sp('e1', '2026-10-06', 3_500_000)])
    expect(r.rubByExpense.get('e1')).toBeCloseTo(11666.67, 2)
    expect(r.overdraftVnd).toBe(500_000)
    expect(r.remainingVnd).toBe(0)
  })

  it('трата раньше первого перевода — курса нет, ноль и перерасход', () => {
    const r = computeFifo([ex('x1', '2026-10-10', 10000, 3_000_000)], [sp('e1', '2026-10-01', 300_000)])
    expect(r.rubByExpense.get('e1')).toBe(0)
    expect(r.overdraftVnd).toBe(300_000)
  })
})
