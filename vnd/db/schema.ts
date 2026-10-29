import { bigint, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Все таблицы с префиксом `vnd_`: база общая с Budget Jar (тот же проект
 * Neon), но данные независимые. Банкой управляет Prisma, этим приложением —
 * drizzle; пересечься по именам они не должны.
 */

export const users = pgTable('vnd_users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Коды входа (6 цифр письмом). Хранится хеш, не сам код. Не ссылка:
 * почтовые сервисы заворачивают ссылки в click-tracking редиректы,
 * которые рвутся сами по себе — код вводится руками, ломать нечему.
 */
export const loginCodes = pgTable(
  'vnd_login_codes',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('vnd_login_codes_hash_uidx').on(t.codeHash)],
)

/** Только для rate-limit в API — фронтендом не читается. */
export const loginCodeRequests = pgTable('vnd_login_code_requests', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  ip: text('ip').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Face ID (WebAuthn). Приватного ключа тут нет и быть не может — он не
 * покидает устройство; храним публичный, им только проверяется подпись.
 */
export const passkeys = pgTable(
  'vnd_passkeys',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: text('public_key').notNull(),
    /** uint32 по спеке — в знаковый int4 не влезает. */
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    transports: text('transports'),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [index('vnd_passkeys_user_idx').on(t.userId)],
)

/**
 * Общие колонки синкаемых таблиц:
 * - `updatedAt` ставит клиент — по ней last-write-wins при push
 * - `serverUpdatedAt` ставит сервер — по ней идёт pull (`?since=`), иначе
 *   офлайн-правка, доехавшая позже чужой синхронизации, потерялась бы
 * - `deletedAt` — мягкое удаление, чтобы синк отличал «удалено» от «ещё не доехало»
 */
const syncColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  serverUpdatedAt: timestamp('server_updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}

/** Статьи трат — задаются в приложении, у каждой иконка. */
export const categories = pgTable(
  'vnd_categories',
  {
    id: text('id').primaryKey(), // uuid с клиента — тот же, что в Dexie
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Имя иконки из набора lucide (src/lib/icons.ts). */
    icon: text('icon').notNull(),
    position: integer('position').notNull().default(0),
    ...syncColumns,
  },
  (t) => [index('vnd_categories_user_sync_idx').on(t.userId, t.serverUpdatedAt)],
)

/**
 * Перевод рублей в донги — это и есть «шкала». Курс не хранится, он
 * выводится из пары сумм. Перевод не трата: он создаёт партию валюты,
 * из которой потом уходят траты (FIFO, src/lib/fifo.ts).
 */
export const exchanges = pgTable(
  'vnd_exchanges',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // YYYY-MM-DD, локальная дата клиента
    /** Отдано рублей. */
    rub: bigint('rub', { mode: 'number' }).notNull(),
    /** Получено донгов. */
    vnd: bigint('vnd', { mode: 'number' }).notNull(),
    ...syncColumns,
  },
  (t) => [index('vnd_exchanges_user_sync_idx').on(t.userId, t.serverUpdatedAt)],
)

/**
 * Трата в донгах. Рублёвая стоимость не хранится: она считается по FIFO из
 * истории переводов, поэтому забытый и внесённый задним числом перевод сам
 * чинит курс у всех трат после него.
 */
export const expenses = pgTable(
  'vnd_expenses',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // YYYY-MM-DD
    /** Сумма в донгах. */
    vnd: bigint('vnd', { mode: 'number' }).notNull(),
    /** Статья обязательна — хотя бы «Другое». Без FK: строка может доехать
     *  раньше своей категории, синк не гарантирует порядок таблиц. */
    categoryId: text('category_id').notNull(),
    comment: text('comment'),
    ...syncColumns,
  },
  (t) => [index('vnd_expenses_user_sync_idx').on(t.userId, t.serverUpdatedAt)],
)
