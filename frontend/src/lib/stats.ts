import type { Category, PaydayRule, Period } from '../types'
import * as pm from './periodMath'
import * as sm from './salaryMonths'
import { NO_CATEGORY_COLOR, NO_CATEGORY_NAME, findCategory } from './categories'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export interface StatPoint {
  key: string
  label: string
  start: string
  end: string
  budget: number // сколько всего распределено на этот период/месяц
  earned: number // сколько из budget уже "накоплено" по сегодня
  spent: number
  savedProjected: number // budget - spent (если больше не тратить)
  savedAccrued: number // earned - spent (накоплено на сегодня)
  daysPassed: number
  status: 'past' | 'current' | 'future'
  uncoveredDays?: number // только для месяцев: дни без ни одного периода
}

export interface StatTotals {
  budget: number
  earned: number
  spent: number
  savedProjected: number
  savedAccrued: number
  savedPercent: number
  avgDailySpend: number
}

function statusFor(startDay: number, endDay: number, todayDay: number): 'past' | 'current' | 'future' {
  if (todayDay < startDay) return 'future'
  if (todayDay > endDay) return 'past'
  return 'current'
}

export function periodStatPoints(periods: Period[]): StatPoint[] {
  const sorted = [...periods].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  const today = pm.toUTCDay(new Date())

  return sorted.map((p) => {
    const budget = Number(p.totalSum)
    const earned = pm.earnedSoFar(p)
    const spent = pm.spentSoFar(p)
    return {
      key: `period-${p.id}`,
      label: pm.formatDateRange(p.startDate, p.endDate, false),
      start: p.startDate,
      end: p.endDate,
      budget,
      earned,
      spent,
      savedProjected: budget - spent,
      savedAccrued: earned - spent,
      daysPassed: pm.daysPassed(p),
      status: statusFor(pm.toUTCDay(p.startDate), pm.toUTCDay(p.endDate), today),
    }
  })
}

function daysOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number, cap?: number): number {
  const start = Math.max(aStart, bStart)
  const end = Math.min(aEnd, bEnd, cap ?? Infinity)
  if (end < start) return 0
  return Math.round((end - start) / MS_PER_DAY) + 1
}

export function monthStatPoints(periods: Period[], rules: PaydayRule[], rangeStart: Date, rangeEnd: Date): StatPoint[] {
  const months = sm.salaryMonthsInRange(rules, rangeStart, rangeEnd)
  const today = pm.toUTCDay(new Date())

  return months.map((month) => {
    const startDay = pm.toUTCDay(month.start)
    const endDay = pm.toUTCDay(month.end)

    let budget = 0
    let earned = 0
    let coveredDays = 0
    let daysPassed = 0

    for (const p of periods) {
      const pStart = pm.toUTCDay(p.startDate)
      const pEnd = pm.toUTCDay(p.endDate)
      const overlap = daysOverlap(pStart, pEnd, startDay, endDay)
      if (overlap === 0) continue

      const daily = pm.dailyBudget(p)
      budget += daily * overlap
      coveredDays += overlap

      const overlapPassed = daysOverlap(pStart, pEnd, startDay, endDay, today)
      earned += daily * overlapPassed
      daysPassed += overlapPassed
    }

    let spent = 0
    for (const p of periods) {
      for (const e of p.expenses) {
        const day = pm.toUTCDay(e.date)
        if (day >= startDay && day <= endDay) spent += Number(e.amount)
      }
    }

    const totalDays = sm.daysInclusive(month.start, month.end)

    return {
      key: `month-${month.start.toISOString()}`,
      label: pm.formatDateRange(month.start.toISOString(), month.end.toISOString(), false),
      start: month.start.toISOString(),
      end: month.end.toISOString(),
      budget,
      earned,
      spent,
      savedProjected: budget - spent,
      savedAccrued: earned - spent,
      daysPassed,
      status: statusFor(startDay, endDay, today),
      uncoveredDays: totalDays - coveredDays,
    }
  })
}

export interface CategoryStat {
  key: string
  name: string
  color: string
  spent: number
  percent: number
}

/**
 * Разбивка трат по категориям за показанный на экране диапазон.
 * На вход идут периоды, уже отфильтрованные по флагу inStats, поэтому
 * выключенных категорий здесь не будет по построению.
 */
export function categoryBreakdown(
  periods: Period[],
  categories: Category[],
  rangeStart: string | Date,
  rangeEnd: string | Date,
): CategoryStat[] {
  const startDay = pm.toUTCDay(rangeStart)
  const endDay = pm.toUTCDay(rangeEnd)
  const sums = new Map<number | null, number>()

  for (const p of periods) {
    for (const e of p.expenses) {
      const day = pm.toUTCDay(e.date)
      if (day < startDay || day > endDay) continue
      // категории уже нет (например, в устаревшем офлайн-кэше) — в «Без категории»
      const key = findCategory(categories, e.categoryId)?.id ?? null
      sums.set(key, (sums.get(key) ?? 0) + Number(e.amount))
    }
  }

  const total = [...sums.values()].reduce((s, v) => s + v, 0)

  return [...sums.entries()]
    .map(([id, spent]) => {
      const category = findCategory(categories, id)
      return {
        key: id === null ? 'none' : `category-${id}`,
        name: category?.name ?? NO_CATEGORY_NAME,
        color: category?.color ?? NO_CATEGORY_COLOR,
        spent,
        percent: total > 0 ? (spent / total) * 100 : 0,
      }
    })
    .sort((a, b) => b.spent - a.spent)
}

export function totals(points: StatPoint[]): StatTotals {
  const budget = points.reduce((s, p) => s + p.budget, 0)
  const earned = points.reduce((s, p) => s + p.earned, 0)
  const spent = points.reduce((s, p) => s + p.spent, 0)
  const daysPassed = points.reduce((s, p) => s + p.daysPassed, 0)
  const savedProjected = budget - spent
  const savedAccrued = earned - spent

  return {
    budget,
    earned,
    spent,
    savedProjected,
    savedAccrued,
    savedPercent: budget > 0 ? (savedProjected / budget) * 100 : 0,
    avgDailySpend: daysPassed > 0 ? spent / daysPassed : 0,
  }
}
