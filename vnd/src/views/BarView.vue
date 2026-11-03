<script setup lang="ts">
import { ChevronLeft, Pencil } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BarGauge from '../components/BarGauge.vue'
import ExchangeSheet from '../components/ExchangeSheet.vue'
import ExpenseRow from '../components/ExpenseRow.vue'
import ExpenseSheet from '../components/ExpenseSheet.vue'
import DayHeader from '../components/DayHeader.vue'
import Vnd from '../components/Vnd.vue'
import { alive, removeExpense } from '../lib/data'
import { db, type Expense } from '../lib/db'
import { formatRub, formatVnd } from '../lib/format'
import { fifoOf, groupByDay } from '../lib/stats'
import { iconComponent } from '../lib/icons'
import { useLiveQuery } from '../lib/useLiveQuery'

const props = defineProps<{ id: string }>()
const router = useRouter()

const categories = useLiveQuery(async () => alive(await db.categories.toArray()), [])
const exchanges = useLiveQuery(async () => alive(await db.exchanges.toArray()), [])
const expenses = useLiveQuery(async () => alive(await db.expenses.toArray()), [])

const fifo = computed(() => fifoOf(exchanges.value, expenses.value))
const bar = computed(() => fifo.value.bars.find((b) => b.id === props.id) ?? null)
const exchange = computed(() => exchanges.value.find((x) => x.id === props.id) ?? null)

const categoryById = computed(() => new Map(categories.value.map((c) => [c.id, c])))
const expenseById = computed(() => new Map(expenses.value.map((e) => [e.id, e])))

/**
 * Траты этой шкалы. Трата могла прийтись на две шкалы сразу — тогда здесь
 * показываем только ту часть, что ушла отсюда, иначе суммы не сойдутся с
 * остатком полосы.
 */
const rows = computed(() => {
  if (!bar.value) return []
  return bar.value.chunks
    .map((chunk) => {
      const expense = expenseById.value.get(chunk.expenseId)
      if (!expense) return null
      const whole = expense.vnd === chunk.vnd
      return { chunk, expense, whole }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .reverse()
})

const days = computed(() =>
  groupByDay(
    rows.value,
    (r) => r.expense.date,
    (r) => ({ vnd: r.chunk.vnd, rub: r.chunk.rub }),
  ),
)

const totals = computed(() => {
  if (!bar.value) return null
  // по кускам, не по тратам целиком — см. комментарий выше
  const byCategory = new Map<string, { vnd: number; rub: number }>()
  for (const { chunk, expense } of rows.value) {
    const group = byCategory.get(expense.categoryId) ?? { vnd: 0, rub: 0 }
    group.vnd += chunk.vnd
    group.rub += chunk.rub
    byCategory.set(expense.categoryId, group)
  }
  return [...byCategory.entries()]
    .map(([categoryId, group]) => ({
      categoryId,
      category: categoryById.value.get(categoryId),
      ...group,
      percent: bar.value!.spentVnd > 0 ? (group.vnd / bar.value!.spentVnd) * 100 : 0,
    }))
    .sort((a, b) => b.vnd - a.vnd)
})

const editingExpense = ref<Expense | null>(null)

/** Здесь видно только кусок траты — удаляется она целиком, об этом и спросим. */
async function askRemoveExpense(expense: Expense) {
  if (!confirm(`Удалить трату на ${formatVnd(expense.vnd)} целиком?`)) return
  await removeExpense(expense.id)
}
const showExchange = ref(false)

// Перевод могли удалить прямо из его формы — тогда смотреть тут уже не на что.
watch(exchange, (now, before) => {
  if (before && !now) void router.replace('/')
})
</script>

<template>
  <main class="min-h-dvh pb-10">
    <div class="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+1rem)] flex flex-col gap-4">
      <header class="flex items-center gap-2">
        <button type="button" class="p-1 -ml-1 text-muted" aria-label="Назад" @click="router.back()">
          <ChevronLeft :size="24" />
        </button>
        <h1 class="text-lg font-semibold text-ink">Шкала</h1>
        <button type="button" class="ml-auto p-2 text-muted" aria-label="Изменить перевод" @click="showExchange = true">
          <Pencil :size="18" />
        </button>
      </header>

      <template v-if="bar">
        <section class="glass glow rounded-3xl p-4" style="--glow: var(--vnd)">
          <BarGauge :bar="bar" large />
        </section>

        <section class="grid grid-cols-2 gap-3">
          <div class="glass rounded-2xl p-3.5 flex flex-col gap-1">
            <span class="text-xs text-muted">Переведено</span>
            <span class="text-base font-medium text-ink"><Vnd :value="bar.vnd" /></span>
            <span class="text-xs text-muted">{{ formatRub(bar.rub) }}</span>
          </div>
          <div class="glass rounded-2xl p-3.5 flex flex-col gap-1">
            <span class="text-xs text-muted">Потрачено</span>
            <span class="text-base font-medium" :style="{ color: 'var(--spend)' }"><Vnd :value="bar.spentVnd" /></span>
            <span class="text-xs text-muted">{{ formatRub(bar.spentVnd * bar.rate) }}</span>
          </div>
        </section>

        <section v-if="totals && totals.length > 0" class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold text-muted px-1">На что ушла</h2>
          <div class="glass rounded-3xl p-4 flex flex-col gap-3">
            <div v-for="row in totals" :key="row.categoryId" class="flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-sm">
                <component
                  :is="iconComponent(row.category?.icon ?? 'Ellipsis')"
                  :size="16"
                  :style="{ color: 'var(--spend)' }"
                />
                <span class="text-ink">{{ row.category?.name ?? 'Удалённая статья' }}</span>
                <span class="ml-auto text-muted text-xs">{{ Math.round(row.percent) }}%</span>
                <span class="text-ink font-medium"><Vnd :value="row.vnd" /></span>
              </div>
              <div class="h-1.5 rounded-full bg-line overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :style="{ width: `${row.percent}%`, background: 'var(--spend)' }"
                />
              </div>
            </div>
          </div>
        </section>

        <section v-if="rows.length > 0" class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold text-muted px-1">Траты из этой шкалы</h2>
          <div class="glass rounded-3xl overflow-hidden">
            <div v-for="day in days" :key="day.date" class="mt-2 first:mt-0">
              <DayHeader :date="day.date" :vnd="day.vnd" :rub="day.rub" />
              <div class="rows">
                <div v-for="row in day.rows" :key="row.chunk.expenseId + row.chunk.vnd">
                  <ExpenseRow
                    :expense="{ ...row.expense, vnd: row.chunk.vnd }"
                    :category="categoryById.get(row.expense.categoryId)"
                    :rub="row.chunk.rub"
                    @open="editingExpense = row.expense"
                    @remove="askRemoveExpense(row.expense)"
                  />
                  <p v-if="!row.whole" class="px-4 pb-2 -mt-1 text-[11px] text-muted">
                    часть траты на <Vnd :value="row.expense.vnd" /> — остальное из соседней шкалы
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <p v-else class="text-sm text-muted text-center py-4">Из этой шкалы ещё ничего не потрачено.</p>
      </template>

      <p v-else class="text-sm text-muted text-center py-10">Перевод не найден.</p>
    </div>

    <ExpenseSheet
      v-if="editingExpense"
      :categories="categories"
      :exchanges="exchanges"
      :expenses="expenses"
      :expense="editingExpense"
      @close="editingExpense = null"
    />
    <ExchangeSheet v-if="showExchange" :exchange="exchange" @close="showExchange = false" />
  </main>
</template>
