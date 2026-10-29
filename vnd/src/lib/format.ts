const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export function formatVnd(value: number): string {
  return `${nf.format(Math.round(value))} ₫`
}

export function formatRub(value: number): string {
  return `${nf.format(Math.round(value))} ₽`
}

/** Курс человеческим языком: сколько донгов за рубль. */
export function formatRate(rub: number, vnd: number): string {
  if (rub <= 0) return '—'
  const perRub = vnd / rub
  return `1 ₽ = ${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: perRub < 100 ? 1 : 0 }).format(perRub)} ₫`
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const dateFmtFull = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })

/** Дата хранится как YYYY-MM-DD — разбираем руками, без часовых поясов. */
function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function formatDate(date: string, withYear = false): string {
  const parsed = parseLocalDate(date)
  return (withYear ? dateFmtFull : dateFmt).format(parsed)
}

export function formatDateRange(from: string, to: string): string {
  return from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`
}
