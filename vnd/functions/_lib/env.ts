/** Переменные окружения Pages Functions (secrets + vars). */
export interface Env {
  /** Тот же проект Neon, что у Budget Jar — но свои таблицы с префиксом `vnd_`. */
  DATABASE_URL: string
  /** Секрет подписи session-куки. */
  SESSION_SECRET: string
  RESEND_API_KEY: string
  /** "Name <email>" — отправитель писем с кодом входа. */
  LOGIN_EMAIL_FROM: string
  /** Базовый URL приложения — для проверки Origin. */
  APP_URL: string
}
