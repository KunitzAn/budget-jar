# Budget Jar — Документация

> Приложение для ведения бюджета по периодам. Деньги визуализируются как камушки в банке: чем больше баланс — тем полнее банка.

---

## Содержание

1. [Обзор](#обзор)
2. [Архитектура](#архитектура)
3. [Структура проекта](#структура-проекта)
4. [База данных](#база-данных)
5. [Backend API](#backend-api)
6. [Frontend](#frontend)
7. [Аутентификация](#аутентификация)
8. [Деплой](#деплой)
9. [Локальная разработка](#локальная-разработка)
10. [Переменные окружения](#переменные-окружения)

---

## Обзор

Budget Jar позволяет:
- задать бюджетный **период** (диапазон дат + сумма на весь период);
- добавлять **траты** внутри периода;
- видеть **текущий баланс** — сколько денег «накопилось» по дневной норме минус то, что потрачено;
- смотреть **историю** периодов и **сводную статистику** по всем периодам.

Вход — через **Telegram Login Widget**. Данные хранятся в PostgreSQL.

---

## Архитектура

```
┌─────────────────────────────────────────────────────┐
│                   Пользователь                       │
│                  (браузер / Telegram)                │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
          ┌──────────▼──────────┐
          │   Frontend (Vue 3)  │   Cloudflare Pages
          │   jar.kunitcan.online│   budget-jar.pages.dev
          └──────────┬──────────┘
                     │ REST / JSON
          ┌──────────▼──────────┐
          │  Backend (Hono)     │   Cloudflare Worker
          │  budget-jar-api     │   api-jar.kunitcan.online
          └──────────┬──────────┘
                     │ Prisma + @prisma/adapter-neon
          ┌──────────▼──────────┐
          │  PostgreSQL (Neon)  │   serverless, pooled connection
          └─────────────────────┘
```

Полностью serverless: нет своего VPS/сервера — только Cloudflare (Pages + Workers) и Neon. Подробности переезда с VPS — в [`MIGRATION_PLAN.md`](./MIGRATION_PLAN.md).

---

## Структура проекта

```
budget-jar/
├── worker/                  # Backend на Cloudflare Worker
│   ├── src/
│   │   ├── index.ts         # Точка входа (Hono app), CORS, регистрация роутов
│   │   ├── middleware/
│   │   │   └── auth.ts      # JWT-проверка (jose) для защищённых роутов
│   │   ├── routes/
│   │   │   ├── auth.ts      # POST /auth/telegram
│   │   │   ├── periods.ts   # CRUD периодов
│   │   │   ├── expenses.ts  # Добавление/удаление трат
│   │   │   └── settings.ts  # История правил зарплатного месяца
│   │   ├── lib/
│   │   │   ├── prisma.ts    # Prisma Client (adapter-neon, runtime = workerd)
│   │   │   ├── jwt.ts       # sign/verify JWT через jose
│   │   │   └── telegram.ts  # HMAC-проверка Telegram через Web Crypto
│   │   └── generated/       # Автогенерированный Prisma Client
│   ├── prisma/
│   │   ├── schema.prisma    # Схема БД
│   │   └── migrations/      # SQL-миграции
│   ├── wrangler.toml        # Конфиг Worker + custom domain
│   └── package.json
│
├── backend/                 # УСТАРЕЛО — старый Fastify-сервер под VPS, не используется.
│                             # Оставлен временно как архив/откат, см. MIGRATION_PLAN.md.
│
├── frontend/                # Vue 3 SPA
│   ├── src/
│   │   ├── main.ts          # Точка входа
│   │   ├── App.vue          # Корневой компонент
│   │   ├── router/
│   │   │   └── index.ts     # Маршруты + guard авторизации
│   │   ├── api/
│   │   │   ├── auth.ts      # loginWithTelegram, logout
│   │   │   ├── periods.ts   # getCurrentPeriod, getPeriods, createPeriod, deletePeriod
│   │   │   ├── expenses.ts  # addExpense, deleteExpense (офлайн-очередь)
│   │   │   └── settings.ts  # getPaydayRules, savePaydayRule
│   │   ├── pages/
│   │   │   ├── Login.vue      # Страница входа (Telegram Widget)
│   │   │   ├── PeriodView.vue # Экран периода — и "/" (текущий), и "/periods/:id"
│   │   │   ├── NewPeriod.vue  # Создание нового периода
│   │   │   ├── Periods.vue    # Список периодов
│   │   │   ├── Stats.vue      # Статистика: по периодам / по зарплатным месяцам
│   │   │   └── Settings.vue   # Зарплатный месяц, выход
│   │   ├── components/
│   │   │   ├── StoneJar.vue       # SVG-банка с камушками
│   │   │   ├── ExpenseForm.vue    # Форма добавления траты
│   │   │   ├── PeriodPicker.vue   # Выбор дат периода
│   │   │   ├── TabBar.vue         # Нижняя навигация
│   │   │   └── StatsBarChart.vue  # SVG-столбики для статистики
│   │   ├── types/
│   │   │   └── index.ts     # TypeScript-интерфейсы
│   │   └── lib/
│   │       ├── api.ts          # axios instance + офлайн-кэш GET-запросов
│   │       ├── periodMath.ts   # Расчёты периода (дни по МСК, баланс, остаток)
│   │       ├── salaryMonths.ts # Границы зарплатных месяцев по истории правил
│   │       ├── stats.ts        # Точки статистики по периодам/месяцам
│   │       ├── offlineCache.ts # Оптимистичные обновления localStorage-кэша
│   │       └── offlineQueue.ts # Очередь несинканных офлайн-мутаций
│   └── package.json
│
├── docker-compose.yml       # УСТАРЕЛО — не используется, оставлен как архив
├── DOCS.md                  # Этот файл
└── MIGRATION_PLAN.md        # План переезда с VPS на Neon + Cloudflare Worker
```

---

## База данных

### Схема (Prisma)

#### `User`
| Поле        | Тип      | Описание                       |
|-------------|----------|--------------------------------|
| `id`        | Int PK   | Автоинкремент                  |
| `telegramId`| BigInt   | Уникальный ID из Telegram      |
| `username`  | String?  | Имя пользователя (nullable)    |
| `createdAt` | DateTime | Дата регистрации               |

#### `Period`
| Поле        | Тип      | Описание                              |
|-------------|----------|---------------------------------------|
| `id`        | Int PK   | Автоинкремент                         |
| `userId`    | Int FK   | Ссылка на User                        |
| `startDate` | DateTime | Начало периода                        |
| `endDate`   | DateTime | Конец периода                         |
| `totalSum`  | Decimal  | Бюджет на весь период (10,2)          |
| `createdAt` | DateTime | Дата создания записи                  |

Индекс: `(userId, startDate)`.

#### `Expense`
| Поле        | Тип      | Описание                        |
|-------------|----------|---------------------------------|
| `id`        | Int PK   | Автоинкремент                   |
| `periodId`  | Int FK   | Ссылка на Period                |
| `amount`    | Decimal  | Сумма траты (10,2)              |
| `date`      | DateTime | Дата траты (default: now)       |
| `note`      | String?  | Заметка (nullable)              |

Индекс: `(periodId, date)`.

Удаление каскадное: удаление User → удаляет Period → удаляет Expense.

#### `PaydayRule`
История правил зарплатного месяца. Действует с `effectiveFrom` до `effectiveFrom` следующего правила (если есть).

| Поле            | Тип      | Описание                                          |
|------------------|----------|----------------------------------------------------|
| `id`             | Int PK   | Автоинкремент                                     |
| `userId`         | Int FK   | Ссылка на User                                    |
| `type`           | String   | `DAY_OF_MONTH` \| `FIRST_WEEKDAY`                 |
| `dayOfMonth`     | Int?     | 1–31 (для `DAY_OF_MONTH`; 31 в феврале → последний день) |
| `weekday`        | Int?     | 0=воскресенье..6=суббота (для `FIRST_WEEKDAY`)    |
| `effectiveFrom`  | DateTime | Дата, с которой действует правило                 |
| `createdAt`      | DateTime | Дата создания записи                              |

Выходные (сб/вс) всегда сдвигаются на предыдущую пятницу. Сохранение нового правила удаляет всю историю с `effectiveFrom >=` выбранной даты и позже — так работает применение «задним числом».

Индекс: `(userId, effectiveFrom)`.

---

## Backend API

**База URL:** `http://localhost:8787` (dev, `wrangler dev`) / `https://api-jar.kunitcan.online` (prod, Cloudflare Worker)

Все роуты кроме `/auth/telegram` и `/health` требуют заголовок:
```
Authorization: Bearer <JWT>
```

### Здоровье

| Метод | Путь      | Описание         |
|-------|-----------|------------------|
| GET   | `/health` | Проверка работы  |

Ответ: `{ "status": "ok" }`

---

### Аутентификация — `/auth`

#### `POST /auth/telegram`
Вход через Telegram Login Widget.

**Тело запроса:**
```json
{
  "id": 123456789,
  "first_name": "Анастасия",
  "username": "username",
  "auth_date": 1700000000,
  "hash": "abc123..."
}
```

**Процесс:** сервер проверяет HMAC-подпись через `TELEGRAM_BOT_TOKEN`. Если пользователь новый — создаёт запись в БД. Возвращает JWT.

**Ответ `200`:**
```json
{
  "token": "<JWT>",
  "user": { "id": 1, "username": "username" }
}
```

**Ошибки:** `401` — неверная подпись Telegram.

---

### Периоды — `/periods`

#### `GET /periods`
Все периоды пользователя (с тратами), отсортированные по `startDate desc`.

#### `GET /periods/current`
Активный период на текущий момент времени.
- `404` если нет периода, покрывающего текущую дату.

#### `GET /periods/:id`
Период по ID (только свой).
- `404` если не найден.

#### `POST /periods`
Создать новый период.

**Тело:**
```json
{
  "startDate": "2026-08-01T00:00:00.000Z",
  "endDate": "2026-08-31T23:59:59.000Z",
  "totalSum": 50000
}
```

**Валидация:** `endDate > startDate`, `totalSum > 0`.  
**Ответ `201`:** объект созданного периода.

#### `DELETE /periods/:id`
Удалить период (каскадно удаляет все его траты).
- **Ответ `204`:** без тела.

---

### Траты — `/periods/:periodId/expenses` и `/expenses`

#### `POST /periods/:periodId/expenses`
Добавить трату к периоду.

**Тело:**
```json
{
  "amount": 1500,
  "date": "2026-08-22T10:00:00.000Z",
  "note": "Продукты"
}
```

`date` и `note` — необязательны. Если `date` не указана, ставится текущее время.  
**Ответ `201`:** объект созданной траты.

#### `DELETE /expenses/:id`
Удалить трату (проверяется принадлежность через период пользователя).
- **Ответ `204`:** без тела.

---

### Настройки — `/settings`

Статистика (сэкономлено/потрачено, по периодам и по зарплатным месяцам) считается на клиенте из уже загруженных `/periods` — отдельного бэкенд-эндпоинта для неё нет, поэтому работает и офлайн.

#### `GET /settings/payday-rules`
Вся история правил зарплатного месяца пользователя, отсортированная по `effectiveFrom asc`.

#### `POST /settings/payday-rules`
Сохранить новое правило.

**Тело:**
```json
{
  "type": "DAY_OF_MONTH",
  "dayOfMonth": 10,
  "effectiveFrom": "2026-09-10T00:00:00.000Z"
}
```
Для `type: "FIRST_WEEKDAY"` вместо `dayOfMonth` передаётся `weekday` (0–6).

**Валидация:** `dayOfMonth` 1–31 или `weekday` 0–6 в зависимости от `type`.
**Ответ `201`:** `{ "rule": {...}, "rules": [...] }` — созданное правило и обновлённая история.

Удаляет (заменяет) все правила пользователя с `effectiveFrom >=` переданной даты.

---

## Frontend

**Стек:** Vue 3 (Composition API) + TypeScript + Vite + Tailwind CSS v4 + axios + vue-router v4.

### Маршруты

| Путь            | Компонент         | Auth | TabBar | Описание                         |
|-----------------|-------------------|------|--------|-----------------------------------|
| `/login`        | `Login.vue`       | нет  | нет    | Вход через Telegram              |
| `/`             | `PeriodView.vue`  | да   | да     | Активный период (список трат, «Останется, если не тратить») |
| `/periods/:id`  | `PeriodView.vue`  | да   | да     | Тот же экран для конкретного периода |
| `/new-period`   | `NewPeriod.vue`   | да   | нет    | Форма создания периода (офлайн недоступна) |
| `/periods`      | `Periods.vue`     | да   | да     | Список периодов                  |
| `/stats`        | `Stats.vue`       | да   | да     | Статистика по периодам/зарплатным месяцам |
| `/settings`     | `Settings.vue`    | да   | да     | Зарплатный месяц, выход          |

Guard в роутере: если нет `token` в `localStorage` и маршрут требует авторизации — редирект на `/login`. `TabBar` скрывается через `meta: { hideTabBar: true }`.

### Ключевые компоненты

#### `StoneJar.vue`
SVG-визуализация баланса. Принимает `currentBalance` и `maxPossible`. Рисует банку с камушками — количество и высота заполнения пропорциональны `currentBalance / maxPossible`. Если баланс отрицательный — банка пустая.

#### `ExpenseForm.vue`
Простая форма ввода суммы траты. Эмитит событие `add(amount: number)`.

#### `PeriodPicker.vue`
Компонент выбора дат начала и конца периода.

### Расчёт баланса на текущей странице

Все расчёты привязаны к **московскому времени (UTC+3)** — новый день начинается в 00:00 МСК.

```
dailyBudget  = totalSum / totalDays
earnedSoFar  = dailyBudget × daysPassed
currentBalance = earnedSoFar − spentSoFar
```

- `totalDays` — количество дней периода (включительно);
- `daysPassed` — сколько дней прошло от начала до сегодня (включая сегодня), ограничено `[0, totalDays]`;
- `spentSoFar` — сумма всех трат периода.

### TypeScript-типы

```typescript
interface Period {
  id: number
  startDate: string
  endDate: string
  totalSum: number
  expenses: Expense[]
}

interface Expense {
  // строковый id вида "local-..." — трата, добавленная офлайн и ещё
  // не отправленная на сервер (см. lib/offlineQueue.ts)
  id: number | string
  amount: number
  date: string
  note?: string
  periodId: number
}

interface PaydayRule {
  id: number
  type: 'DAY_OF_MONTH' | 'FIRST_WEEKDAY'
  dayOfMonth: number | null
  weekday: number | null // 0=воскресенье..6=суббота
  effectiveFrom: string
}

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}
```

---

## Аутентификация

Используется [Telegram Login Widget](https://core.telegram.org/widgets/login).

**Поток:**
1. Пользователь нажимает кнопку «Войти через Telegram».
2. Telegram возвращает объект `TelegramUser` с подписью `hash`.
3. Фронтенд отправляет объект на `POST /auth/telegram`.
4. Бэкенд верифицирует HMAC: `SHA256(botToken)` → HMAC-SHA256 по отсортированным полям.
5. При успехе — создаёт или находит пользователя, возвращает JWT.
6. JWT сохраняется в `localStorage` под ключом `token`.
7. Axios-инстанс автоматически добавляет `Authorization: Bearer <token>` к каждому запросу.

**Выход:** `logout()` удаляет токен из `localStorage`, редирект на `/login`.

---

## Деплой

### БД — Neon

PostgreSQL хостится в [Neon](https://neon.tech) (serverless Postgres, бесплатный tier). Проект `budget-jar`, база `neondb`.

- Для миграций используется **direct**-connection string (Neon Dashboard → Connection Details).
- Для рантайма Worker'а используется **pooled**-connection string (тот же экран, вариант с `-pooler` в хосте) — она прописана как секрет `DATABASE_URL`.

### Backend — Cloudflare Worker

```bash
cd worker
npm install
npx prisma generate     # сгенерировать Prisma Client (runtime = workerd)
npx wrangler deploy     # задеплоить Worker
```

`wrangler.toml` задаёт имя Worker'а (`budget-jar-api`) и custom domain (`api-jar.kunitcan.online` — привязывается автоматически при деплое, DNS-запись на домене должна отсутствовать/не быть занятой другим сервисом).

**Секреты** (не хранятся в репозитории, задаются один раз через Cloudflare):
```bash
npx wrangler secret put DATABASE_URL       # pooled connection string из Neon
npx wrangler secret put JWT_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

**Применить миграции Prisma** (если менялась схема) — с локальной машины, указав в `worker/.env`/окружении `DATABASE_URL` (direct-connection Neon):
```bash
cd worker
npx prisma migrate deploy
```

### Обновление продакшна

```bash
cd worker
git pull
npx prisma generate
npx wrangler deploy
```

Если есть новые миграции — прогнать `npx prisma migrate deploy` (см. выше) до или после деплоя Worker'а.

### Frontend — Cloudflare Pages

Фронтенд деплоится на Cloudflare Pages. Продакшн-URL:
- `https://jar.kunitcan.online`
- `https://budget-jar.pages.dev`

При сборке используется `.env.production` с `VITE_API_URL=https://api-jar.kunitcan.online`.

---

## Локальная разработка

### Предварительные требования
- Node.js 20+
- Аккаунт Neon (БД, общий для dev/prod, либо отдельная dev-ветка в Neon)
- Аккаунт Cloudflare + `wrangler login` (для локального запуска Worker'а и деплоя)

### Запуск

**1. Backend (Cloudflare Worker):**
```bash
cd worker
cp .dev.vars.example .dev.vars  # заполнить DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN
npm install
npm run prisma:generate
npx wrangler dev --port 8787
```
Worker запустится на `http://localhost:8787`. Секреты для `wrangler dev` читаются из `.dev.vars` (в `.gitignore`, в репозиторий не попадает).

**2. Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Приложение откроется на `http://localhost:5173`, `VITE_API_URL` из `.env.development` должен указывать на `http://localhost:8787`.

---

## Переменные окружения

### Backend (`worker/.dev.vars` локально, секреты Cloudflare в продакшне)

| Переменная            | Обязательная | Описание                                             |
|-----------------------|:------------:|------------------------------------------------------|
| `DATABASE_URL`        | да           | Строка подключения Neon Postgres (pooled в проде, direct/pooled для dev) |
| `JWT_SECRET`          | да           | Секрет для подписи JWT                               |
| `TELEGRAM_BOT_TOKEN`  | да           | Токен бота из @BotFather (используется для верификации) |

В продакшне переменные задаются через `npx wrangler secret put <NAME>` и не хранятся в файлах репозитория. Локально — в `worker/.dev.vars` (в `.gitignore`), по образцу `worker/.dev.vars.example`.

### Frontend (`frontend/.env.*`)

| Переменная      | Описание                         |
|-----------------|----------------------------------|
| `VITE_API_URL`  | Базовый URL backend API          |

Файлы:
- `.env.development` → `http://localhost:8787`
- `.env.production` → `https://api-jar.kunitcan.online`

---

## CORS

Backend разрешает запросы с:
- `http://localhost:5173` (локальная разработка)
- `https://jar.kunitcan.online` (продакшн)
- `https://budget-jar.pages.dev` (Cloudflare Pages preview)

Разрешённые методы: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
