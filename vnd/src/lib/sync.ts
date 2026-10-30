import type { Table } from 'dexie'
import { ref } from 'vue'
import { api, ApiError } from './api'
import { checkSession, me } from './auth'
import { db, DEFAULT_CATEGORY_NAME, type Category, type Exchange, type Expense } from './db'

const LAST_SYNCED_AT_KEY = 'vnd:lastSyncedAt'
const SYNCED_USER_ID_KEY = 'vnd:syncedUserId'

export const syncing = ref(false)
export const pendingCount = ref(0)
export const lastSyncError = ref<string | null>(null)

type ServerRow<T> = Omit<T, 'dirty'>

interface SyncResponse {
  serverTime: string
  categories: ServerRow<Category>[]
  exchanges: ServerRow<Exchange>[]
  expenses: ServerRow<Expense>[]
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // приватный режим — синк просто будет каждый раз полным
  }
}

/**
 * С какого пользователя лежит локальная копия. Роутер пускает по ней в
 * приложение, не дожидаясь сети: на iOS в авиарежиме запрос не падает, а
 * висит, и холодный офлайн-старт иначе застревал бы на экране входа.
 */
/** Была ли хоть одна удачная синхронизация на этом устройстве. */
export function hasSynced(): boolean {
  return Boolean(readLocal(LAST_SYNCED_AT_KEY))
}

export function getSyncedUserId(): number | null {
  const raw = readLocal(SYNCED_USER_ID_KEY)
  return raw ? Number(raw) : null
}

async function countDirty(): Promise<number> {
  const [c, x, e] = await Promise.all([
    db.categories.filter((r) => r.dirty).count(),
    db.exchanges.filter((r) => r.dirty).count(),
    db.expenses.filter((r) => r.dirty).count(),
  ])
  return c + x + e
}

export async function refreshPendingCount(): Promise<void> {
  pendingCount.value = await countDirty()
}

/**
 * Кладёт строки сервера поверх локальных. Строку, которую правили локально
 * и ещё не отправили (`dirty`), не трогаем — её отправит ближайший push, а
 * затирать несохранённую правку чужой версией нельзя.
 */
async function applyServerRows<T extends { id: string; dirty: boolean }>(
  table: Table<T, string>,
  rows: ServerRow<T>[],
): Promise<void> {
  for (const row of rows) {
    const local = await table.get(row.id)
    if (local?.dirty) continue
    await table.put({ ...(row as T), dirty: false })
  }
}

async function pushDirty(since: string | null): Promise<SyncResponse | null> {
  const [categories, exchanges, expenses] = await Promise.all([
    db.categories.filter((r) => r.dirty).toArray(),
    db.exchanges.filter((r) => r.dirty).toArray(),
    db.expenses.filter((r) => r.dirty).toArray(),
  ])

  if (categories.length === 0 && exchanges.length === 0 && expenses.length === 0) return null

  const strip = <T extends { dirty: boolean }>(rows: T[]) => rows.map(({ dirty: _dirty, ...rest }) => rest)

  const query = since ? `?since=${encodeURIComponent(since)}` : ''
  const res = await api.post<SyncResponse & { accepted: Record<string, string[]> }>(`/api/sync${query}`, {
    categories: strip(categories),
    exchanges: strip(exchanges),
    expenses: strip(expenses),
  })

  // сервер принял — снимаем флаг «ждёт отправки»
  for (const id of res.accepted.categories ?? []) await db.categories.update(id, { dirty: false })
  for (const id of res.accepted.exchanges ?? []) await db.exchanges.update(id, { dirty: false })
  for (const id of res.accepted.expenses ?? []) await db.expenses.update(id, { dirty: false })

  return res
}

/**
 * Схлопывает одинаковые «Другое». Устройство заводит эту статью при первом
 * открытии, ещё не зная, что она уже есть на сервере, — и после обмена их
 * оказывается две. Оставляем самую старую, траты переводим на неё, лишние
 * помечаем удалёнными; удаление уедет на сервер обычным push.
 */
export async function mergeDuplicateDefaults(): Promise<boolean> {
  const duplicates = (await db.categories.toArray())
    .filter((c) => !c.deletedAt && c.name === DEFAULT_CATEGORY_NAME)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  if (duplicates.length < 2) return false

  const [keep, ...extra] = duplicates
  const now = new Date().toISOString()
  for (const dup of extra) {
    const orphans = await db.expenses.where('categoryId').equals(dup.id).toArray()
    for (const e of orphans) {
      await db.expenses.update(e.id, { categoryId: keep!.id, updatedAt: now, dirty: true })
    }
    await db.categories.update(dup.id, { deletedAt: now, updatedAt: now, dirty: true })
  }
  return true
}

/**
 * Один проход синхронизации: сначала отправляем локальные правки, потом
 * забираем всё, что сервер видел после прошлого раза. Возвращает признак
 * того, что пришлось схлопнуть дубли — их отправит второй проход.
 */
async function syncOnce(): Promise<boolean> {
  syncing.value = true
  let merged = false
  try {
    if (!me.value) await checkSession()
    if (!me.value) return false

    // сменился пользователь — локальная копия чужая, начинаем с нуля
    const syncedUser = readLocal(SYNCED_USER_ID_KEY)
    if (syncedUser && syncedUser !== String(me.value.userId)) {
      await Promise.all([db.categories.clear(), db.exchanges.clear(), db.expenses.clear()])
      writeLocal(LAST_SYNCED_AT_KEY, '')
    }
    writeLocal(SYNCED_USER_ID_KEY, String(me.value.userId))

    const since = readLocal(LAST_SYNCED_AT_KEY) || null

    const pushed = await pushDirty(since)
    const res = pushed ?? (await api.get<SyncResponse>(`/api/sync${since ? `?since=${encodeURIComponent(since)}` : ''}`))

    await applyServerRows(db.categories as Table<Category, string>, res.categories)
    await applyServerRows(db.exchanges as Table<Exchange, string>, res.exchanges)
    await applyServerRows(db.expenses as Table<Expense, string>, res.expenses)
    merged = await mergeDuplicateDefaults()

    writeLocal(LAST_SYNCED_AT_KEY, res.serverTime)
    lastSyncError.value = null
  } catch (err) {
    // 401 — сессия кончилась, роутер сам отправит на вход; остальное
    // (нет сети, таймаут) не ошибка пользователя, просто попробуем позже
    if (!(err instanceof ApiError && err.status === 401)) {
      lastSyncError.value = err instanceof Error ? err.message : String(err)
    }
  } finally {
    await refreshPendingCount()
    syncing.value = false
  }
  return merged
}

let current: Promise<void> | null = null

/**
 * Синхронизация. Если проход уже идёт, отдаём его же обещание: вызывающий
 * ждёт настоящего результата, а не возвращается с пустыми руками (на этом
 * раньше спотыкалась проверка «есть ли уже статья „Другое“»).
 */
export function runSync(): Promise<void> {
  if (current) return current
  current = (async () => {
    // склейка дублей происходит уже после push — отправляем её вторым проходом
    if (await syncOnce()) await syncOnce()
  })().finally(() => {
    current = null
  })
  return current
}

export function installSyncTriggers(): void {
  window.addEventListener('online', () => void runSync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void runSync()
  })
}
