# Миграция backend + БД с VPS на serverless (Neon + Cloudflare Workers)

## Контекст

Backend (Fastify+Prisma) и PostgreSQL сейчас живут на арендованном VPS (`docker-compose.yml`, деплой по SSH). После смены IP сервер стал недоступен, и пользователь хочет вообще отказаться от аренды VPS. Frontend уже на Cloudflare Pages и не требует изменений. Цель — перенести БД в Neon (serverless Postgres) и переписать Fastify-роуты в Cloudflare Worker, сохранив всю существующую бизнес-логику (JWT, Telegram HMAC-проверка, CRUD периодов/трат, статистика) практически без изменений в поведении API.

Сохраняем публичный контракт API (пути, тела запросов/ответов из `DOCS.md`) — фронтенду достаточно поменять `VITE_API_URL`.

## Что переносим один в один

Изучено в `backend/src/`:
- `server.ts` — регистрация cors/jwt, роуты, `/health`.
- `routes/auth.ts` — `POST /auth/telegram`, HMAC-проверка через `crypto`, поиск/создание User, выдача JWT.
- `routes/periods.ts`, `routes/expenses.ts`, `routes/stats.ts` — CRUD-логика на Prisma.
- `middleware/auth.ts` — `jwtVerify` → `request.userId`.
- `prisma/schema.prisma` — 3 модели (User, Period, Expense), без изменений.
- Данные для миграции: текущий `backend/.env` содержит `TELEGRAM_BOT_TOKEN`, `JWT_SECRET` — их нужно перенести как секреты Worker'а, не в код.

## Шаги

### 1. База данных → Neon
- Создать проект Neon (Postgres 15+), получить `DATABASE_URL` (pooled connection string для serverless).
- Прогнать существующие миграции Prisma (`backend/prisma/migrations/`) на новую БД (`prisma migrate deploy`).
- Если на старом VPS остались нужные данные — экспортировать `pg_dump` (по возможности достучаться до старого сервера) и импортировать в Neon; если сервер недоступен и данные не критичны — начать с чистой БД.

### 2. Backend → Cloudflare Worker
- Новый Worker-проект (может быть отдельная директория `worker/` в репозитории или переиспользование `backend/` с заменой рантайма — решим на этапе реализации).
- Заменить Fastify на лёгкий роутер, совместимый с Workers (Hono — ближе всего по эргономике к Fastify: middleware, `app.get/post`, легко переносится структура роутов).
- Prisma Client переключить на edge-совместимый рантайм: `@prisma/adapter-neon` + `@prisma/client` (driver adapters), вместо текущего `@prisma/adapter-pg`.
- JWT: заменить `@fastify/jwt` на `jose` (стандартная edge-совместимая библиотека) — та же логика sign/verify с `userId` в payload.
- Telegram HMAC-проверка (`routes/auth.ts`) переносится как есть — использует Web Crypto API вместо Node `crypto` (`crypto.subtle`), т.к. Workers не имеют Node crypto по умолчанию (либо включить `nodejs_compat` флаг, что тоже вариант и требует меньше правок кода).
- CORS: настроить в Worker вручную (сейчас список origin в `server.ts:14-18`) — тот же список origin.
- Роуты переносятся 1:1: `/auth/telegram`, `/periods`, `/periods/current`, `/periods/:id`, `/periods/:periodId/expenses`, `/expenses/:id`, `/stats`, `/health`.
- Секреты (`JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`) — через `wrangler secret put`, не в `wrangler.toml`.

### 3. Деплой
- `wrangler.toml`: имя Worker, роут на кастомный домен `api-jar.kunitcan.online` (через Cloudflare DNS — тот же поддомен, что уже используется, просто указывает на Worker вместо VPS).
- Заменить раздел "Порядок деплоя бэкенда" в `DOCS.md` (сейчас `ssh + docker compose`) на `wrangler deploy`.
- Убрать/архивировать `docker-compose.yml`, `backend/docker-compose.dev.yml`, `backend/Dockerfile` — для локальной разработки БД тоже можно продолжать поднимать Postgres в Docker локально (dev-контур не обязан жить в Neon), либо использовать сам Neon dev-ветку.

### 4. Frontend
- Никаких изменений в коде — только `frontend/.env.production`: `VITE_API_URL` остаётся `https://api-jar.kunitcan.online` (домен не меняется, меняется то, что за ним стоит), либо новый URL, если решим не переиспользовать поддомен.

### 5. Документация
- Обновить `DOCS.md`: архитектура (убрать VPS/Docker Compose из диаграммы, добавить Neon + Cloudflare Worker), раздел "Деплой", раздел "Локальная разработка" (если меняется способ поднятия БД локально), переменные окружения (если появляются новые, например формат Neon connection string).

## Открытые вопросы для этапа реализации (не блокируют план, но потребуют решения по ходу)
- Структура репозитория: переиспользовать `backend/` под Worker или завести новую директорию — решим при реализации, глядя на объём изменений в зависимостях.
- Нужно ли сохранять данные со старого VPS, или можно начать с чистой БД (зависит от доступности старого сервера по новому IP/паролю).

## Проверка
- Локально: `wrangler dev` поднимает Worker, фронтенд (`npm run dev` в `frontend/`) с `VITE_API_URL=http://localhost:8787` проходит полный цикл: логин через Telegram Widget → создание периода → добавление траты → удаление → `/stats`.
- `GET /health` отвечает `{ "status": "ok" }`.
- После `wrangler deploy`: те же проверки на `https://api-jar.kunitcan.online`, плюс проверка CORS с `https://jar.kunitcan.online`.
- Сверить структуру ответов API с `DOCS.md` (типы `Period`, `Expense`, `Stats`) — фронтенд не должен потребовать изменений.
