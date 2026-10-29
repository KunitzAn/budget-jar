import { and, eq, gt } from 'drizzle-orm'
import { categories, exchanges, expenses } from '../../db/schema'
import type { AuthedData } from '../_lib/context'
import { getDb, type Db } from '../_lib/db'
import type { Env } from '../_lib/env'
import { error, json, readJson, sameOrigin } from '../_lib/http'

/**
 * Синхронизация офлайн-данных: GET отдаёт всё, что сервер видел после
 * `?since=`, POST принимает локальные правки и возвращает то же самое.
 *
 * Курсор идёт по `serverUpdatedAt` (время сервера), а не по `updatedAt`
 * (время телефона): иначе правка, сделанная офлайн и отправленная позже,
 * чем другое устройство успело синхронизироваться, никогда бы до него не
 * доехала — курсор сравнивался бы с чужими часами.
 *
 * Конфликт правок одной строки — last-write-wins по `updatedAt`. У
 * приложения один владелец, более сложная схема тут только мешала бы.
 */

interface IncomingRow {
  id?: unknown
  updatedAt?: unknown
  deletedAt?: unknown
  [key: string]: unknown
}

interface Incoming {
  categories?: IncomingRow[]
  exchanges?: IncomingRow[]
  expenses?: IncomingRow[]
}

function parseSince(url: URL): Date {
  const raw = url.searchParams.get('since')
  if (!raw) return new Date(0)
  const d = new Date(raw)
  return isNaN(d.getTime()) ? new Date(0) : d
}

/**
 * Общее для всех строк: id и время с клиента. `createdAt` именно клиентский,
 * а не now() по умолчанию: по нему FIFO разрешает порядок трат одного дня, и
 * после переустановки приложения он должен вернуться с сервера тем же.
 */
function baseOf(
  row: IncomingRow,
): { id: string; updatedAt: Date; deletedAt: Date | null; createdAt: Date } | null {
  if (typeof row.id !== 'string' || !row.id) return null
  const updatedAt = new Date(String(row.updatedAt ?? ''))
  if (isNaN(updatedAt.getTime())) return null
  const deletedAt = row.deletedAt ? new Date(String(row.deletedAt)) : null
  const createdAt = new Date(String(row.createdAt ?? ''))
  return {
    id: row.id,
    updatedAt,
    deletedAt: deletedAt && !isNaN(deletedAt.getTime()) ? deletedAt : null,
    createdAt: isNaN(createdAt.getTime()) ? updatedAt : createdAt,
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

async function pullAll(db: Db, userId: number, since: Date) {
  const [cats, exs, exps] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, userId), gt(categories.serverUpdatedAt, since))),
    db
      .select()
      .from(exchanges)
      .where(and(eq(exchanges.userId, userId), gt(exchanges.serverUpdatedAt, since))),
    db
      .select()
      .from(expenses)
      .where(and(eq(expenses.userId, userId), gt(expenses.serverUpdatedAt, since))),
  ])
  return { categories: cats, exchanges: exs, expenses: exps }
}

export const onRequestGet: PagesFunction<Env, string, AuthedData> = async (ctx) => {
  const db = getDb(ctx.env)
  const data = await pullAll(db, ctx.data.userId, parseSince(new URL(ctx.request.url)))
  return json({ serverTime: new Date().toISOString(), ...data })
}

async function pushCategories(db: Db, rows: IncomingRow[], userId: number): Promise<string[]> {
  const accepted: string[] = []
  for (const row of rows) {
    const base = baseOf(row)
    if (!base) continue
    const name = str(row.name)
    const icon = str(row.icon)
    if (name === null || icon === null) continue

    const values = {
      ...base,
      userId,
      name,
      icon,
      position: num(row.position) ?? 0,
      serverUpdatedAt: new Date(),
    }

    const [existing] = await db
      .select({ updatedAt: categories.updatedAt })
      .from(categories)
      .where(and(eq(categories.id, base.id), eq(categories.userId, userId)))
      .limit(1)

    if (existing) {
      if (existing.updatedAt >= base.updatedAt) continue
      const { createdAt: _createdAt, ...patch } = values
      await db.update(categories).set(patch).where(eq(categories.id, base.id))
    } else {
      await db.insert(categories).values(values)
    }
    accepted.push(base.id)
  }
  return accepted
}

async function pushExchanges(db: Db, rows: IncomingRow[], userId: number): Promise<string[]> {
  const accepted: string[] = []
  for (const row of rows) {
    const base = baseOf(row)
    if (!base) continue
    const date = str(row.date)
    const rub = num(row.rub)
    const vnd = num(row.vnd)
    if (date === null || rub === null || vnd === null) continue

    const values = { ...base, userId, date, rub, vnd, serverUpdatedAt: new Date() }

    const [existing] = await db
      .select({ updatedAt: exchanges.updatedAt })
      .from(exchanges)
      .where(and(eq(exchanges.id, base.id), eq(exchanges.userId, userId)))
      .limit(1)

    if (existing) {
      if (existing.updatedAt >= base.updatedAt) continue
      const { createdAt: _createdAt, ...patch } = values
      await db.update(exchanges).set(patch).where(eq(exchanges.id, base.id))
    } else {
      await db.insert(exchanges).values(values)
    }
    accepted.push(base.id)
  }
  return accepted
}

async function pushExpenses(db: Db, rows: IncomingRow[], userId: number): Promise<string[]> {
  const accepted: string[] = []
  for (const row of rows) {
    const base = baseOf(row)
    if (!base) continue
    const date = str(row.date)
    const vnd = num(row.vnd)
    const categoryId = str(row.categoryId)
    if (date === null || vnd === null || categoryId === null) continue

    const values = {
      ...base,
      userId,
      date,
      vnd,
      categoryId,
      comment: str(row.comment),
      serverUpdatedAt: new Date(),
    }

    const [existing] = await db
      .select({ updatedAt: expenses.updatedAt })
      .from(expenses)
      .where(and(eq(expenses.id, base.id), eq(expenses.userId, userId)))
      .limit(1)

    if (existing) {
      if (existing.updatedAt >= base.updatedAt) continue
      const { createdAt: _createdAt, ...patch } = values
      await db.update(expenses).set(patch).where(eq(expenses.id, base.id))
    } else {
      await db.insert(expenses).values(values)
    }
    accepted.push(base.id)
  }
  return accepted
}

export const onRequestPost: PagesFunction<Env, string, AuthedData> = async (ctx) => {
  if (!sameOrigin(ctx.request, ctx.env.APP_URL)) return error(403, 'forbidden')

  const body = await readJson<Incoming>(ctx.request)
  if (!body) return error(400, 'invalid_body')

  const db = getDb(ctx.env)
  const userId = ctx.data.userId

  const accepted = {
    categories: await pushCategories(db, body.categories ?? [], userId),
    exchanges: await pushExchanges(db, body.exchanges ?? [], userId),
    expenses: await pushExpenses(db, body.expenses ?? [], userId),
  }

  // Тем же ответом отдаём свежие строки: клиент сразу узнает серверное время
  // и не пойдёт за ними отдельным запросом.
  const data = await pullAll(db, userId, parseSince(new URL(ctx.request.url)))

  return json({ serverTime: new Date().toISOString(), accepted, ...data })
}
