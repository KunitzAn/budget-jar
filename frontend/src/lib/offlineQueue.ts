import api from './api'
import type { Expense } from '../types'
import {
  applyOptimisticExpenseAdd,
  applyOptimisticExpenseRemove,
  applyOptimisticPeriodRemove,
  replaceOptimisticExpenseId,
} from './offlineCache'

type ExpenseBody = { amount: number; date?: string; note?: string }

type QueuedMutation = { id: string; createdAt: number } & (
  | { type: 'addExpense'; tempId: string; periodId: number; body: ExpenseBody }
  | { type: 'deleteExpense'; id_: number; periodId: number }
  | { type: 'deletePeriod'; periodId: number }
)

const QUEUE_KEY = 'offline:queue'

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : []
  } catch {
    return []
  }
}

function setQueue(queue: QueuedMutation[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // ignore
  }
}

/** Убирает из очереди ровно одну мутацию по её id, всегда поверх свежего
 *  состояния — не задевает мутации, добавленные параллельно (например, пока
 *  идёт синхронизация предыдущей записи в flushQueue). */
function removeFromQueue(mutationId: string) {
  setQueue(getQueue().filter((m) => m.id !== mutationId))
}

export function enqueueAddExpense(periodId: number, body: ExpenseBody): Expense {
  const tempId = `local-${genId()}`
  const expense: Expense = {
    id: tempId,
    periodId,
    amount: body.amount,
    date: body.date ?? new Date().toISOString(),
    note: body.note,
  }

  const queue = getQueue()
  queue.push({ id: genId(), type: 'addExpense', tempId, periodId, body, createdAt: Date.now() })
  setQueue(queue)

  applyOptimisticExpenseAdd(periodId, expense)
  return expense
}

export function enqueueDeleteExpense(id: number, periodId: number) {
  const queue = getQueue()
  queue.push({ id: genId(), type: 'deleteExpense', id_: id, periodId, createdAt: Date.now() })
  setQueue(queue)

  applyOptimisticExpenseRemove(periodId, id)
}

/** Удаляет ещё не отправленную (local-...) трату — на сервер идти не нужно. */
export function dequeueLocalExpense(tempId: string, periodId: number) {
  const queue = getQueue().filter((m) => !(m.type === 'addExpense' && m.tempId === tempId))
  setQueue(queue)

  applyOptimisticExpenseRemove(periodId, tempId)
}

export function enqueueDeletePeriod(periodId: number) {
  // период всё равно удалится — несинканные мутации по нему бессмысленны
  const queue = getQueue().filter((m) => {
    if (m.type === 'addExpense' && m.periodId === periodId) return false
    if (m.type === 'deleteExpense' && m.periodId === periodId) return false
    return true
  })
  queue.push({ id: genId(), type: 'deletePeriod', periodId, createdAt: Date.now() })
  setQueue(queue)

  applyOptimisticPeriodRemove(periodId)
}

async function syncOne(mutation: QueuedMutation) {
  if (mutation.type === 'addExpense') {
    const { data } = await api.post<Expense>(`/periods/${mutation.periodId}/expenses`, mutation.body)
    replaceOptimisticExpenseId(mutation.periodId, mutation.tempId, data)
  } else if (mutation.type === 'deleteExpense') {
    await api.delete(`/expenses/${mutation.id_}`)
  } else {
    await api.delete(`/periods/${mutation.periodId}`)
  }
}

let flushing = false

/**
 * Пытается отправить всю накопленную офлайн-очередь на сервер.
 * Каждая мутация обрабатывается по одной, очередь перечитывается заново перед
 * каждым шагом — так мутация, добавленная параллельно (пока эта функция ждёт
 * сеть), никогда не будет потеряна затиранием устаревшего снепшота.
 */
export async function flushQueue() {
  if (flushing) return
  flushing = true
  try {
    while (true) {
      const queue = getQueue()
      if (queue.length === 0) return
      const mutation = queue[0]
      try {
        await syncOne(mutation)
        removeFromQueue(mutation.id)
      } catch (error: unknown) {
        const hasResponse = !!(error as { response?: unknown })?.response
        if (!hasResponse) {
          // сеть пропала посреди синка — оставляем как есть, попробуем в следующий раз
          return
        }
        // настоящая ошибка API (ресурс уже не существует и т.п.) — тихо пропускаем мутацию
        console.warn('offline sync: dropping mutation after API error', mutation, error)
        removeFromQueue(mutation.id)
      }
    }
  } finally {
    flushing = false
  }
}
