import type { PaydayRule } from '../types'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export interface SalaryMonth {
  start: Date
  end: Date // включительно — последний день месяца, день перед следующей границей
}

// заготовка правила для превью ещё не сохранённого варианта (нет id/effectiveFrom)
export type DraftRule = Pick<PaydayRule, 'type' | 'dayOfMonth' | 'weekday'>

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

// суббота/воскресенье -> ближайшая предыдущая пятница
function shiftWeekend(date: Date): Date {
  const dow = date.getUTCDay()
  if (dow === 0) return addDays(date, -2)
  if (dow === 6) return addDays(date, -1)
  return date
}

/** Граница зарплатного месяца в заданном (year, month) по правилу rule. */
export function ruleBoundaryForMonth(rule: DraftRule, year: number, month: number): Date {
  let raw: Date
  if (rule.type === 'DAY_OF_MONTH') {
    const day = Math.min(rule.dayOfMonth ?? 1, daysInMonth(year, month))
    raw = new Date(Date.UTC(year, month, day))
  } else {
    const first = new Date(Date.UTC(year, month, 1))
    const diff = ((rule.weekday ?? 1) - first.getUTCDay() + 7) % 7
    raw = addDays(first, diff)
  }
  return shiftWeekend(raw)
}

/** Список дат-кандидатов для "применить с": по formatMonth месяцев в обе стороны от сегодня. */
export function candidateBoundaries(rule: DraftRule, monthsBack = 12, monthsForward = 3): Date[] {
  const now = new Date()
  const y0 = now.getUTCFullYear()
  const m0 = now.getUTCMonth()
  const result: Date[] = []
  for (let offset = -monthsBack; offset <= monthsForward; offset++) {
    const total = m0 + offset
    const year = y0 + Math.floor(total / 12)
    const month = ((total % 12) + 12) % 12
    result.push(ruleBoundaryForMonth(rule, year, month))
  }
  return result
}

function sortByEffectiveFrom(rules: PaydayRule[]): PaydayRule[] {
  return [...rules].sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime())
}

/**
 * Все зарплатные месяцы, пересекающие [rangeStart, rangeEnd], с учётом истории
 * правил (переход на новое правило укорачивает/удлиняет текущий месяц).
 */
export function salaryMonthsInRange(rules: PaydayRule[], rangeStart: Date, rangeEnd: Date): SalaryMonth[] {
  if (rules.length === 0) return []
  const sorted = sortByEffectiveFrom(rules)

  let current = new Date(sorted[0].effectiveFrom)
  const boundaries: Date[] = [current]

  // отдельный курсор года/месяца для расчёта СЛЕДУЮЩЕЙ границы — не выводим
  // его из уже сдвинутой (из-за выходных) даты current: если граница сдвинулась
  // назад на пятницу и осталась в том же календарном месяце, что и предыдущая,
  // расчёт "следующего месяца от current" даст ту же дату повторно (зацикливание)
  let cursorYear = current.getUTCFullYear()
  let cursorMonth = current.getUTCMonth()

  let ruleIndex = 0
  let safety = 0
  while (current.getTime() < rangeEnd.getTime() && safety++ < 2000) {
    const activeRule = sorted[ruleIndex]
    const nextRuleFrom = ruleIndex + 1 < sorted.length ? new Date(sorted[ruleIndex + 1].effectiveFrom) : null

    cursorMonth++
    if (cursorMonth > 11) {
      cursorMonth = 0
      cursorYear++
    }

    let next = ruleBoundaryForMonth(activeRule, cursorYear, cursorMonth)

    if (nextRuleFrom && next.getTime() >= nextRuleFrom.getTime()) {
      next = nextRuleFrom
      ruleIndex++
      // курсор синхронизируем с фактической датой перехода — дальше считаем
      // месяцы нового правила от неё, а не от той, что использовалась для старого
      cursorYear = next.getUTCFullYear()
      cursorMonth = next.getUTCMonth()
    }

    boundaries.push(next)
    current = next
  }

  const months: SalaryMonth[] = []
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]
    const end = addDays(boundaries[i + 1], -1)
    if (end.getTime() >= rangeStart.getTime() && start.getTime() <= rangeEnd.getTime()) {
      months.push({ start, end })
    }
  }
  return months
}

/**
 * Переходный (укороченный/удлинённый) месяц, который получится при смене
 * правила: от последней границы старого правила до дня перед newEffectiveFrom.
 * null, если правил ещё не было или newEffectiveFrom раньше самого первого правила.
 */
export function previewTransitionMonth(rules: PaydayRule[], newEffectiveFrom: Date): SalaryMonth | null {
  const prior = sortByEffectiveFrom(rules).filter(
    (r) => new Date(r.effectiveFrom).getTime() < newEffectiveFrom.getTime(),
  )
  if (prior.length === 0) return null
  const lastRule = prior[prior.length - 1]

  let boundary = new Date(lastRule.effectiveFrom)
  let safety = 0
  while (safety++ < 120) {
    const y = boundary.getUTCFullYear()
    const m = boundary.getUTCMonth()
    const next = ruleBoundaryForMonth(lastRule, y, m + 1)
    if (next.getTime() >= newEffectiveFrom.getTime()) break
    boundary = next
  }

  return { start: boundary, end: addDays(newEffectiveFrom, -1) }
}

export function daysInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1
}

// с согласованием рода ("первый вторник", но "первую среду"/"первое воскресенье")
const FIRST_WEEKDAY_PHRASES = [
  'первое воскресенье',
  'первый понедельник',
  'первый вторник',
  'первую среду',
  'первый четверг',
  'первую пятницу',
  'первую субботу',
]

export function describeRule(rule: DraftRule): string {
  if (rule.type === 'DAY_OF_MONTH') {
    return `${rule.dayOfMonth}-го числа каждого месяца`
  }
  return `в ${FIRST_WEEKDAY_PHRASES[rule.weekday ?? 1]} месяца`
}
