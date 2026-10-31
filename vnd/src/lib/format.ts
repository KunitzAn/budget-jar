const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export function formatVnd(value: number): string {
  return `${nf.format(Math.round(value))} ₫`
}

/**
 * Делит сумму на значащую часть и хвост из трёх нулей: в донгах они есть
 * почти всегда и только мешают разглядеть число. Хвост рисуется бледным —
 * см. компонент Vnd.
 */
export function splitVnd(value: number): { head: string; tail: string } {
  const text = nf.format(Math.round(value))
  const match = /^(.*)([\s ]000)$/.exec(text)
  return match ? { head: match[1]!, tail: match[2]! } : { head: text, tail: '' }
}

/** Сколько тысяч донгов — в этом виде суммы и вводятся. */
export const VND_UNIT = 1000

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

/** «Сегодня»/«Вчера» вместо даты — так список дней читается быстрее. */
export function todayLabel(date: string): string | null {
  const now = new Date()
  const diff = Math.round((now.setHours(0, 0, 0, 0) - parseLocalDate(date).getTime()) / 86_400_000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return null
}

export function formatDateRange(from: string, to: string): string {
  return from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`
}
