import { db, DEFAULT_CATEGORY_NAME, newId, today, type Category, type Exchange, type Expense } from './db'
import { getSyncedUserId, hasSynced, mergeDuplicateDefaults, refreshPendingCount, runSync } from './sync'

/**
 * Все изменения пишутся сначала в локальную базу и помечаются `dirty`, а
 * синхронизация идёт фоном. Поэтому запись никогда не ждёт сети: в поездке
 * это главное.
 */

function base() {
  const now = new Date().toISOString()
  return { createdAt: now, updatedAt: now, deletedAt: null, dirty: true as const }
}

function afterWrite(): void {
  void refreshPendingCount()
  void runSync()
}

export { DEFAULT_CATEGORY_NAME }

/**
 * Идентификатор «Другого» — один и тот же на всех устройствах пользователя.
 * Новое устройство открывает приложение с пустой локальной базой и заводит
 * статью раньше, чем успевает синхронизироваться; со случайным id после
 * синхронизации получались две одинаковые статьи.
 */
function defaultCategoryId(): string {
  const userId = getSyncedUserId()
  return userId === null ? newId() : `default-${userId}`
}

/**
 * Статья обязательна у каждой траты, поэтому «Другое» должна существовать
 * всегда — создаём её при первом открытии, если список пуст.
 */
export async function ensureDefaultCategory(): Promise<Category> {
  await mergeDuplicateDefaults()

  // Первый запуск на новом устройстве: база пуста просто потому, что данные
  // ещё не приехали. Дождёмся их, иначе заведём лишнюю копию «Другого».
  if ((await db.categories.count()) === 0 && !hasSynced() && navigator.onLine) {
    await runSync()
  }

  const existing = await db.categories.filter((c) => !c.deletedAt).toArray()
  if (existing.length > 0) {
    const other = existing.find((c) => c.name === DEFAULT_CATEGORY_NAME)
    return other ?? existing[0]!
  }

  const category: Category = {
    id: defaultCategoryId(),
    name: DEFAULT_CATEGORY_NAME,
    icon: 'Ellipsis',
    position: 999,
    ...base(),
  }
  await db.categories.put(category)
  afterWrite()
  return category
}

export async function addCategory(name: string, icon: string): Promise<Category> {
  const count = await db.categories.count()
  const category: Category = { id: newId(), name: name.trim(), icon, position: count, ...base() }
  await db.categories.put(category)
  afterWrite()
  return category
}

export async function updateCategory(id: string, patch: { name?: string; icon?: string }): Promise<void> {
  await db.categories.update(id, {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
    updatedAt: new Date().toISOString(),
    dirty: true,
  })
  afterWrite()
}

/** Мягкое удаление: строку нужно донести до сервера, а не стереть молча. */
export async function removeCategory(id: string): Promise<void> {
  await db.categories.update(id, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dirty: true })
  afterWrite()
}

export async function addExchange(input: { date?: string; rub: number; vnd: number }): Promise<Exchange> {
  const exchange: Exchange = {
    id: newId(),
    date: input.date ?? today(),
    rub: Math.round(input.rub),
    vnd: Math.round(input.vnd),
    ...base(),
  }
  await db.exchanges.put(exchange)
  afterWrite()
  return exchange
}

export async function updateExchange(id: string, patch: { date?: string; rub?: number; vnd?: number }): Promise<void> {
  await db.exchanges.update(id, {
    ...(patch.date !== undefined ? { date: patch.date } : {}),
    ...(patch.rub !== undefined ? { rub: Math.round(patch.rub) } : {}),
    ...(patch.vnd !== undefined ? { vnd: Math.round(patch.vnd) } : {}),
    updatedAt: new Date().toISOString(),
    dirty: true,
  })
  afterWrite()
}

export async function removeExchange(id: string): Promise<void> {
  await db.exchanges.update(id, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dirty: true })
  afterWrite()
}

export async function addExpense(input: {
  date?: string
  vnd: number
  categoryId: string
  comment?: string | null
}): Promise<Expense> {
  const expense: Expense = {
    id: newId(),
    date: input.date ?? today(),
    vnd: Math.round(input.vnd),
    categoryId: input.categoryId,
    comment: input.comment?.trim() || null,
    ...base(),
  }
  await db.expenses.put(expense)
  afterWrite()
  return expense
}

export async function updateExpense(
  id: string,
  patch: { date?: string; vnd?: number; categoryId?: string; comment?: string | null },
): Promise<void> {
  await db.expenses.update(id, {
    ...(patch.date !== undefined ? { date: patch.date } : {}),
    ...(patch.vnd !== undefined ? { vnd: Math.round(patch.vnd) } : {}),
    ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
    ...(patch.comment !== undefined ? { comment: patch.comment?.trim() || null } : {}),
    updatedAt: new Date().toISOString(),
    dirty: true,
  })
  afterWrite()
}

export async function removeExpense(id: string): Promise<void> {
  await db.expenses.update(id, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dirty: true })
  afterWrite()
}

/** Живые (неудалённые) строки — удалённые остаются в базе ради синка. */
export const alive = <T extends { deletedAt: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => !r.deletedAt)
