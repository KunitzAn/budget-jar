import type { Category, Expense, Period } from '../types'

export const NO_CATEGORY_NAME = 'Без категории'
export const NO_CATEGORY_COLOR = '#c3c3d4'

// inStats — вкладка «Статистика», inBalance — банка и остаток периода.
export type CategoryFlag = 'inStats' | 'inBalance'

/** id категорий, выключенных этим флагом. */
function excludedIds(categories: Category[], flag: CategoryFlag): Set<number> {
  return new Set(categories.filter((c) => !c[flag]).map((c) => c.id))
}

/** Трата без категории — а также с категорией, которой уже нет, — считается везде. */
function isCounted(expense: Expense, excluded: Set<number>): boolean {
  return expense.categoryId == null || !excluded.has(expense.categoryId)
}

export function filterPeriod(period: Period, categories: Category[], flag: CategoryFlag): Period {
  const excluded = excludedIds(categories, flag)
  if (excluded.size === 0) return period
  return { ...period, expenses: period.expenses.filter((e) => isCounted(e, excluded)) }
}

export function filterPeriods(periods: Period[], categories: Category[], flag: CategoryFlag): Period[] {
  const excluded = excludedIds(categories, flag)
  if (excluded.size === 0) return periods
  return periods.map((p) => ({ ...p, expenses: p.expenses.filter((e) => isCounted(e, excluded)) }))
}

export function findCategory(categories: Category[], id: number | null | undefined): Category | undefined {
  return id == null ? undefined : categories.find((c) => c.id === id)
}
