<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, ref } from 'vue'
import ExpenseRow from '../components/ExpenseRow.vue'
import ExpenseSheet from '../components/ExpenseSheet.vue'
import DayHeader from '../components/DayHeader.vue'
import { alive, removeExpense } from '../lib/data'
import { db } from '../lib/db'
import { formatDate, formatDateRange, formatRub, formatVnd, plural } from '../lib/format'
import Vnd from '../components/Vnd.vue'
import { iconComponent } from '../lib/icons'
import { fifoOf, groupByDay, inRange, presetRange, type Range, type RangePreset } from '../lib/stats'
import { useLiveQuery } from '../lib/useLiveQuery'
import type { Expense } from '../lib/db'

const categories = useLiveQuery(async () => alive(await db.categories.toArray()), [])
const exchanges = useLiveQuery(async () => alive(await db.exchanges.toArray()), [])
const expenses = useLiveQuery(async () => alive(await db.expenses.toArray()), [])

const fifo = computed(() => fifoOf(exchanges.value, expenses.value))
const categoryById = computed(() => new Map(categories.value.map((c) => [c.id, c])))

/** Два способа смотреть: по календарю и по конкретной шкале (переводу). */
const mode = ref<'calendar' | 'bars'>('calendar')

const preset = ref<RangePreset>('month')
const customFrom = ref('')
const customTo = ref('')

const range = computed<Range>(() => {
  if (preset.value === 'custom') {
    return { from: customFrom.value || '0000-01-01', to: customTo.value || '9999-12-31' }
  }
  return presetRange(preset.value)
})

/** Выбранная шкала в режиме «по шкалам»; пусто — последняя. */
const selectedBarId = ref<string | null>(null)
const bars = computed(() => [...fifo.value.bars].reverse())
const selectedBar = computed(
  () => bars.value.find((b) => b.id === selectedBarId.value) ?? bars.value[0] ?? null,
)

/** Фильтр по статьям: пусто — показываем все. */
const activeCategories = ref<Set<string>>(new Set())

function toggleCategory(id: string) {
  const next = new Set(activeCategories.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  activeCategories.value = next
}

const matchesCategory = (categoryId: string) =>
  activeCategories.value.size === 0 || activeCategories.value.has(categoryId)

/**
 * В режиме шкалы берём не траты целиком, а куски, ушедшие именно из неё:
 * трата могла прийтись на две шкалы, и иначе суммы разошлись бы с полосой.
 */
const shown = computed(() => {
  if (mode.value === 'bars') {
    const bar = selectedBar.value
    if (!bar) return []
    const byId = new Map(expenses.value.map((e) => [e.id, e]))
    return bar.chunks
      .map((chunk) => {
        const expense = byId.get(chunk.expenseId)
        if (!expense || !matchesCategory(expense.categoryId)) return null
        return { expense, vnd: chunk.vnd, rub: chunk.rub }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  }

  return expenses.value
    .filter((e) => inRange(e.date, range.value) && matchesCategory(e.categoryId))
    .map((expense) => ({ expense, vnd: expense.vnd, rub: fifo.value.rubByExpense.get(expense.id) ?? 0 }))
})

const totals = computed(() => {
  const vnd = shown.value.reduce((s, r) => s + r.vnd, 0)
  const rub = shown.value.reduce((s, r) => s + r.rub, 0)

  const groups = new Map<string, { vnd: number; rub: number; count: number }>()
  for (const row of shown.value) {
    const g = groups.get(row.expense.categoryId) ?? { vnd: 0, rub: 0, count: 0 }
    g.vnd += row.vnd
    g.rub += row.rub
    g.count += 1
    groups.set(row.expense.categoryId, g)
  }

  const byCategory = [...groups.entries()]
    .map(([categoryId, g]) => ({
      categoryId,
      category: categoryById.value.get(categoryId),
      ...g,
      percent: vnd > 0 ? (g.vnd / vnd) * 100 : 0,
    }))
    .sort((a, b) => b.vnd - a.vnd)

  return { vnd, rub, count: shown.value.length, byCategory }
})

/**
 * Провалились в одну статью: здесь видно, что именно и в какие дни по ней
 * уходило. Общего списка всех трат в статистике нет — он есть в кошельке.
 */
const drillId = ref<string | null>(null)
const drillCategory = computed(() =>
  drillId.value === null ? null : (categoryById.value.get(drillId.value) ?? null),
)

const drillDays = computed(() => {
  if (drillId.value === null) return []
  const rows = shown.value
    .filter((r) => r.expense.categoryId === drillId.value)
    .sort((a, b) =>
      a.expense.date === b.expense.date
        ? b.expense.createdAt.localeCompare(a.expense.createdAt)
        : b.expense.date.localeCompare(a.expense.date),
    )
  return groupByDay(
    rows,
    (r) => r.expense.date,
    (r) => ({ vnd: r.vnd, rub: r.rub }),
  )
})

const drillTotals = computed(() => {
  let vnd = 0
  let rub = 0
  let count = 0
  for (const day of drillDays.value) {
    vnd += day.vnd
    rub += day.rub
    count += day.rows.length
  }
  return { vnd, rub, count }
})

/** Подпись под названием статьи: за какой период показаны траты. */
const periodLabel = computed(() => {
  if (mode.value === 'bars') {
    const bar = selectedBar.value
    return bar ? `перевод от ${formatDate(bar.date)}` : ''
  }
  if (preset.value === 'all') return 'за всё время'
  return `за ${formatDateRange(range.value.from, range.value.to)}`
})

const editing = ref<Expense | null>(null)

async function askRemove(expense: Expense) {
  if (!confirm(`Удалить трату на ${formatVnd(expense.vnd)}?`)) return
  await removeExpense(expense.id)
}

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'all', label: 'Всё' },
  { value: 'custom', label: 'Свой' },
]
</script>

<template>
  <main class="min-h-dvh pb-28">
    <div class="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] flex flex-col gap-4">
      <template v-if="drillId !== null">
        <header class="flex items-center gap-2">
          <button type="button" class="p-1 -ml-1 text-muted" aria-label="Назад" @click="drillId = null">
            <ChevronLeft :size="24" />
          </button>
          <component
            :is="iconComponent(drillCategory?.icon ?? 'Ellipsis')"
            :size="20"
            :style="{ color: 'var(--spend)' }"
          />
          <div class="min-w-0 flex flex-col">
            <h1 class="text-lg font-semibold text-ink truncate">
              {{ drillCategory?.name ?? 'Удалённая статья' }}
            </h1>
            <span class="text-xs text-muted">{{ periodLabel }}</span>
          </div>
        </header>

        <section class="glass rounded-3xl p-4 flex flex-col gap-1">
          <span class="text-xs text-muted">Потрачено</span>
          <div class="flex items-baseline gap-3">
            <span class="text-2xl font-bold" :style="{ color: 'var(--spend)' }">
              <Vnd :value="drillTotals.vnd" />
            </span>
            <span class="text-base text-muted">{{ formatRub(drillTotals.rub) }}</span>
          </div>
          <span class="text-xs text-muted">
            {{ drillTotals.count }} {{ plural(drillTotals.count, 'трата', 'траты', 'трат') }} ·
            {{ drillDays.length }} {{ plural(drillDays.length, 'день', 'дня', 'дней') }}
          </span>
        </section>

        <section v-if="drillDays.length > 0" class="glass rounded-3xl overflow-hidden">
          <div v-for="day in drillDays" :key="day.date" class="mt-2 first:mt-0">
            <DayHeader :date="day.date" :vnd="day.vnd" :rub="day.rub" />
            <div class="rows">
              <ExpenseRow
                v-for="row in day.rows"
                :key="row.expense.id + row.vnd"
                :expense="{ ...row.expense, vnd: row.vnd }"
                :category="categoryById.get(row.expense.categoryId)"
                :rub="row.rub"
                hide-category
                @open="editing = row.expense"
                @remove="askRemove(row.expense)"
              />
            </div>
          </div>
        </section>

        <p v-else class="text-sm text-muted text-center py-6">По этой статье трат за период нет.</p>
      </template>

      <template v-else>
        <h1 class="text-2xl font-bold text-ink">Статистика</h1>

        <div class="glass rounded-2xl p-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            class="rounded-xl py-2 text-sm font-medium transition-colors"
            :style="
              mode === 'calendar'
                ? { background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }
                : { color: 'var(--muted)' }
            "
            @click="mode = 'calendar'"
          >
            По датам
          </button>
          <button
            type="button"
            class="rounded-xl py-2 text-sm font-medium transition-colors"
            :style="
              mode === 'bars'
                ? { background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }
                : { color: 'var(--muted)' }
            "
            @click="mode = 'bars'"
          >
            По шкалам
          </button>
        </div>

        <template v-if="mode === 'calendar'">
          <div class="flex gap-1.5 overflow-x-auto pb-1">
            <button
              v-for="p in PRESETS"
              :key="p.value"
              type="button"
              class="shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors"
              :style="
                preset === p.value
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--card)', color: 'var(--muted)' }
              "
              @click="preset = p.value"
            >
              {{ p.label }}
            </button>
          </div>
          <div v-if="preset === 'custom'" class="flex items-center gap-2">
            <input v-model="customFrom" type="date" class="field" />
            <span class="text-muted">—</span>
            <input v-model="customTo" type="date" class="field" />
          </div>
        </template>

        <template v-else>
          <div v-if="bars.length > 0" class="flex gap-1.5 overflow-x-auto pb-1">
            <button
              v-for="bar in bars"
              :key="bar.id"
              type="button"
              class="shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors"
              :style="
                selectedBar?.id === bar.id
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--card)', color: 'var(--muted)' }
              "
              @click="selectedBarId = bar.id"
            >
              {{ formatDate(bar.date) }} · <Vnd :value="bar.vnd" />
            </button>
          </div>
          <p v-else class="text-sm text-muted">Переводов пока нет.</p>
        </template>

        <div v-if="categories.length > 0" class="flex flex-wrap gap-1.5">
          <button
            v-for="c in categories"
            :key="c.id"
            type="button"
            class="rounded-full px-3 py-1.5 text-xs flex items-center gap-1.5 border transition-colors"
            :style="
              activeCategories.has(c.id)
                ? { borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--ink)' }
                : { borderColor: 'var(--line)', color: 'var(--muted)' }
            "
            @click="toggleCategory(c.id)"
          >
            <component :is="iconComponent(c.icon)" :size="13" />
            {{ c.name }}
          </button>
        </div>

        <section class="glass rounded-3xl p-4 flex flex-col gap-1">
          <span class="text-xs text-muted">Потрачено{{ activeCategories.size > 0 ? ' (с фильтром)' : '' }}</span>
          <div class="flex items-baseline gap-3">
            <span class="text-2xl font-bold" :style="{ color: 'var(--spend)' }"><Vnd :value="totals.vnd" /></span>
            <span class="text-base text-muted">{{ formatRub(totals.rub) }}</span>
          </div>
          <span class="text-xs text-muted">
            {{ totals.count }} {{ plural(totals.count, 'трата', 'траты', 'трат') }}
          </span>
        </section>

        <!-- Статья открывается нажатием: внутри видно сами траты и дни. -->
        <section v-if="totals.byCategory.length > 0" class="glass rounded-3xl p-2 flex flex-col">
          <h2 class="text-sm font-semibold text-muted px-2 pt-2 pb-1">По статьям</h2>
          <button
            v-for="row in totals.byCategory"
            :key="row.categoryId"
            type="button"
            class="rounded-2xl px-2 py-2 flex flex-col gap-1.5 text-left active:bg-line"
            @click="drillId = row.categoryId"
          >
            <div class="flex items-center gap-2 text-sm w-full">
              <component
                :is="iconComponent(row.category?.icon ?? 'Ellipsis')"
                :size="16"
                :style="{ color: 'var(--spend)' }"
              />
              <span class="text-ink truncate">{{ row.category?.name ?? 'Удалённая статья' }}</span>
              <span class="ml-auto text-xs text-muted">{{ Math.round(row.percent) }}%</span>
              <span class="font-medium text-ink"><Vnd :value="row.vnd" /></span>
              <ChevronRight :size="14" class="text-muted shrink-0" />
            </div>
            <div class="h-1.5 w-full rounded-full bg-line overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: `${row.percent}%`, background: 'var(--spend)' }" />
            </div>
            <span class="text-[11px] text-muted">
              {{ formatRub(row.rub) }} · {{ row.count }} {{ plural(row.count, 'трата', 'траты', 'трат') }}
            </span>
          </button>
        </section>

        <p v-else class="text-sm text-muted text-center py-6">За этот период трат нет.</p>
      </template>
    </div>

    <ExpenseSheet
      v-if="editing"
      :categories="categories"
      :exchanges="exchanges"
      :expenses="expenses"
      :expense="editing"
      @close="editing = null"
    />
  </main>
</template>
