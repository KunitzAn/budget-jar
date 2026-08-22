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
          │   Backend (Fastify) │   api-jar.kunitcan.online
          │   Node.js + Prisma  │   порт 3001
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
          │    PostgreSQL 15    │   Docker volume
          └─────────────────────┘
```

---

## Структура проекта

```
budget-jar/
├── backend/                 # Node.js сервер
│   ├── src/
│   │   ├── server.ts        # Точка входа, регистрация плагинов и роутов
│   │   ├── middleware/
│   │   │   └── auth.ts      # JWT-проверка для защищённых роутов
│   │   ├── routes/
│   │   │   ├── auth.ts      # POST /auth/telegram
│   │   │   ├── periods.ts   # CRUD периодов
│   │   │   ├── expenses.ts  # Добавление/удаление трат
│   │   │   └── stats.ts     # Сводная статистика
│   │   ├── lib/
│   │   │   └── prisma.ts    # Singleton Prisma Client
│   │   └── generated/       # Автогенерированный Prisma Client
│   ├── prisma/
│   │   ├── schema.prisma    # Схема БД
│   │   └── migrations/      # SQL-миграции
│   ├── Dockerfile
│   ├── docker-compose.dev.yml
│   └── package.json
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
│   │   │   ├── expenses.ts  # addExpense, deleteExpense
│   │   │   └── stats.ts     # getStats
│   │   ├── pages/
│   │   │   ├── Login.vue         # Страница входа (Telegram Widget)
│   │   │   ├── CurrentPeriod.vue # Главная — активный период
│   │   │   ├── NewPeriod.vue     # Создание нового периода
│   │   │   ├── Periods.vue       # Список всех периодов
│   │   │   ├── PeriodDetail.vue  # Детальная страница периода
│   │   │   └── Stats.vue         # Сводная статистика
│   │   ├── components/
│   │   │   ├── StoneJar.vue      # SVG-банка с камушками
│   │   │   ├── ExpenseForm.vue   # Форма добавления траты
│   │   │   └── PeriodPicker.vue  # Выбор дат периода
│   │   ├── types/
│   │   │   └── index.ts     # TypeScript-интерфейсы
│   │   └── lib/
│   │       └── api.ts       # axios instance с Authorization header
│   └── package.json
│
├── docker-compose.yml       # Продакшн: postgres + backend
└── DOCS.md                  # Этот файл
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

---

## Backend API

**База URL:** `http://localhost:3001` (dev) / `https://api-jar.kunitcan.online` (prod)

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

### Статистика — `/stats`

#### `GET /stats`
Сводная статистика по всем периодам.

**Ответ:**
```json
{
  "totalIncome": 150000,
  "totalExpenses": 87500,
  "balance": 62500
}
```

- `totalIncome` — сумма `totalSum` всех периодов;
- `totalExpenses` — сумма всех трат по всем периодам;
- `balance` — разница.

---

## Frontend

**Стек:** Vue 3 (Composition API) + TypeScript + Vite + Tailwind CSS v4 + axios + vue-router v4.

### Маршруты

| Путь            | Компонент         | Auth | Описание                         |
|-----------------|-------------------|------|----------------------------------|
| `/login`        | `Login.vue`       | нет  | Вход через Telegram              |
| `/`             | `CurrentPeriod.vue` | да | Активный период                  |
| `/new-period`   | `NewPeriod.vue`   | да   | Форма создания периода           |
| `/periods`      | `Periods.vue`     | да   | Список всех периодов             |
| `/periods/:id`  | `PeriodDetail.vue`| да   | Детальная страница периода       |
| `/stats`        | `Stats.vue`       | да   | Сводная статистика               |

Guard в роутере: если нет `token` в `localStorage` и маршрут требует авторизации — редирект на `/login`.

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
  id: number
  amount: number
  date: string
  note?: string
  periodId: number
}

interface Stats {
  totalIncome: number
  totalExpenses: number
  balance: number
  periods: Period[]
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

### Backend + PostgreSQL — Docker Compose

```bash
# Продакшн запуск
docker-compose up -d

# Применить миграции
docker exec budget-jar-app npx prisma migrate deploy
```

`docker-compose.yml` поднимает два сервиса:
- `postgres` — PostgreSQL 15 Alpine, данные в named volume `postgres_data`;
- `app` — бэкенд на порту `3001`.

### Frontend — Cloudflare Pages

Фронтенд деплоится на Cloudflare Pages. Продакшн-URL:
- `https://jar.kunitcan.online`
- `https://budget-jar.pages.dev`

При сборке используется `.env.production` с `VITE_API_URL=https://api-jar.kunitcan.online`.

---

## Локальная разработка

### Предварительные требования
- Node.js 20+
- Docker и Docker Compose (для PostgreSQL)

### Запуск

**1. База данных (через Docker):**
```bash
cd backend
docker-compose -f docker-compose.dev.yml up -d
```

**2. Backend:**
```bash
cd backend
cp .env.example .env  # заполнить DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
Сервер запустится на `http://localhost:3001`.

**3. Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Приложение откроется на `http://localhost:5173`.

---

## Переменные окружения

### Backend (`backend/.env`)

| Переменная            | Обязательная | Описание                                             |
|-----------------------|:------------:|------------------------------------------------------|
| `DATABASE_URL`        | да           | Строка подключения PostgreSQL                        |
| `JWT_SECRET`          | да           | Секрет для подписи JWT (менять в продакшне!)         |
| `TELEGRAM_BOT_TOKEN`  | да           | Токен бота из @BotFather (используется для верификации) |
| `PORT`                | нет          | Порт сервера (default: `3001`)                       |
| `HOST`                | нет          | Хост сервера (default: `0.0.0.0`)                    |

### Frontend (`frontend/.env.*`)

| Переменная      | Описание                         |
|-----------------|----------------------------------|
| `VITE_API_URL`  | Базовый URL backend API          |

Файлы:
- `.env.development` → `http://localhost:3001`
- `.env.production` → `https://api-jar.kunitcan.online`

---

## CORS

Backend разрешает запросы с:
- `http://localhost:5173` (локальная разработка)
- `https://jar.kunitcan.online` (продакшн)
- `https://budget-jar.pages.dev` (Cloudflare Pages preview)

Разрешённые методы: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
