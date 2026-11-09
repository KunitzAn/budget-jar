<script setup lang="ts">
import { ArrowRightLeft, ChevronDown, Plus, TriangleAlert } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BarGauge from '../components/BarGauge.vue'
import ExchangeSheet from '../components/ExchangeSheet.vue'
import ExpenseRow from '../components/ExpenseRow.vue'
import ExpenseSheet from '../components/ExpenseSheet.vue'
import DayHeader from '../components/DayHeader.vue'
import Vnd from '../components/Vnd.vue'
import { alive, ensureDefaultCategory, removeExpense } from '../lib/data'
import { db, type Expense } from '../lib/db'
import { formatRub, formatVnd, plural } from '../lib/format'
import { fifoOf, groupByDay } from '../lib/stats'
import { useLiveQuery } from '../lib/useLiveQuery'

const router = useRouter()

const categories = useLiveQuery(async () => alive(await db.categories.toArray()), [])
const exchanges = useLiveQuery(async () => alive(await db.exchanges.toArray()), [])
const expenses = useLiveQuery(async () => alive(await db.expenses.toArray()), [])

onMounted(() => {
  void ensureDefaultCategory()
})

const fifo = computed(() => fifoOf(exchanges.value, expenses.value))

// Шкалы сверху вниз: сначала та, из которой тратим сейчас (самая старая
// непотраченная) — следующая начнёт расходоваться только после неё.
const openBars = computed(() => fifo.value.bars.filter((b) => b.remainingVnd > 0))
const spentBars = computed(() => fifo.value.bars.filter((b) => b.remainingVnd <= 0).reverse())

/** Переводы, до которых очередь ещё не дошла: лежат сложенными. */
const queuedBars = computed(() => openBars.value.slice(1))
const queuedVnd = computed(() => queuedBars.value.reduce((sum, b) => sum + b.remainingVnd, 0))
const queuedOpen = ref(false)

const sorted = computed(() =>
  [...expenses.value].sort((a, b) =>
    a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
  ),
)

// Список растёт по кнопке: на главной нужны последние траты, но иногда надо
// долистать и до старых — отдельный экран ради этого заводить незачем.
const PAGE = 20
const limit = ref(PAGE)
const hasMore = computed(() => sorted.value.length > limit.value)

const recent = computed(() =>
  groupByDay(
    sorted.value.slice(0, limit.value),
    (e) => e.date,
    (e) => ({ vnd: e.vnd, rub: fifo.value.rubByExpense.get(e.id) ?? 0 }),
  ),
)

const categoryById = computed(() => new Map(categories.value.map((c) => [c.id, c])))

const showExpense = ref(false)
const showExchange = ref(false)
const editing = ref<Expense | null>(null)

function openExpense(expense: Expense | null) {
  editing.value = expense
  showExpense.value = true
}

function closeExpense() {
  showExpense.value = false
  editing.value = null
}

async function askRemove(expense: Expense) {
  if (!confirm(`Удалить трату на ${formatVnd(expense.vnd)}?`)) return
  await removeExpense(expense.id)
}
</script>

<template>
  <main class="min-h-dvh pb-28">
    <div class="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] flex flex-col gap-4">
      <header class="flex flex-col gap-1">
        <span class="text-xs text-muted">На руках</span>
        <div class="flex items-baseline gap-3">
          <span class="text-3xl font-bold text-ink"><Vnd :value="fifo.remainingVnd" /></span>
          <span class="text-base text-muted">≈ {{ formatRub(fifo.remainingRub) }}</span>
        </div>
      </header>

      <div
        v-if="fifo.overdraftVnd > 0"
        class="glass rounded-2xl p-3 flex items-start gap-2 text-sm"
        :style="{ color: 'var(--warn)' }"
      >
        <TriangleAlert :size="18" class="shrink-0 mt-0.5" />
        <span>
          Трат на <Vnd :value="fifo.overdraftVnd" /> больше, чем переведено. Эта часть посчитана по
          последнему курсу — добавьте недостающий перевод.
        </span>
      </div>

      <section v-if="openBars.length > 0" class="flex flex-col gap-3">
        <button
          type="button"
          class="glass glow rounded-3xl p-4 text-left"
          style="--glow: var(--vnd)"
          @click="router.push(`/bar/${openBars[0]!.id}`)"
        >
          <BarGauge :bar="openBars[0]!" large />
        </button>

        <template v-if="queuedBars.length > 0">
          <button
            type="button"
            class="glass rounded-2xl px-4 py-3 flex items-center gap-2 text-left"
            @click="queuedOpen = !queuedOpen"
          >
            <ChevronDown
              :size="18"
              class="text-muted transition-transform"
              :class="queuedOpen ? 'rotate-180' : ''"
            />
            <span class="text-sm text-ink">
              Ещё {{ queuedBars.length }}
              {{ plural(queuedBars.length, 'перевод', 'перевода', 'переводов') }}
            </span>
            <span class="ml-auto text-sm text-muted"><Vnd :value="queuedVnd" /></span>
          </button>

          <button
            v-for="bar in queuedOpen ? queuedBars : []"
            :key="bar.id"
            type="button"
            class="glass rounded-2xl p-3.5 text-left"
            @click="router.push(`/bar/${bar.id}`)"
          >
            <BarGauge :bar="bar" />
          </button>
        </template>
      </section>

      <section v-else class="glass rounded-3xl p-5 text-center flex flex-col gap-3">
        <p class="text-sm text-muted">
          Пока нет переведённых донгов. Добавьте перевод — появится шкала, и из неё пойдут траты.
        </p>
      </section>

      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="rounded-2xl py-3.5 flex items-center justify-center gap-2 text-white font-medium"
          :style="{ background: 'var(--spend)' }"
          @click="openExpense(null)"
        >
          <Plus :size="18" /> Трата
        </button>
        <button
          type="button"
          class="rounded-2xl py-3.5 flex items-center justify-center gap-2 text-white font-medium"
          :style="{ background: 'var(--exchange)' }"
          @click="showExchange = true"
        >
          <ArrowRightLeft :size="18" /> Перевод
        </button>
      </div>

      <section v-if="recent.length > 0" class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold text-muted px-1">Последние траты</h2>
        <div class="glass rounded-3xl overflow-hidden">
          <div v-for="day in recent" :key="day.date" class="mt-2 first:mt-0">
            <DayHeader :date="day.date" :vnd="day.vnd" :rub="day.rub" />
            <div class="rows">
              <ExpenseRow
                v-for="e in day.rows"
                :key="e.id"
                :expense="e"
                :category="categoryById.get(e.categoryId)"
                :rub="fifo.rubByExpense.get(e.id) ?? 0"
                @open="openExpense(e)"
                @remove="askRemove(e)"
              />
            </div>
          </div>

          <button
            v-if="hasMore"
            type="button"
            class="w-full py-3 text-sm font-medium border-t"
            :style="{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--line) 75%, transparent)' }"
            @click="limit += PAGE"
          >
            Показать ещё
          </button>
        </div>
      </section>

      <section v-if="spentBars.length > 0" class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold text-muted px-1">Потраченные шкалы</h2>
        <button
          v-for="bar in spentBars"
          :key="bar.id"
          type="button"
          class="glass rounded-2xl p-3.5 text-left opacity-70"
          @click="router.push(`/bar/${bar.id}`)"
        >
          <BarGauge :bar="bar" />
        </button>
      </section>
    </div>

    <ExpenseSheet
      v-if="showExpense"
      :categories="categories"
      :exchanges="exchanges"
      :expenses="expenses"
      :expense="editing"
      @close="closeExpense"
    />
    <ExchangeSheet v-if="showExchange" @close="showExchange = false" />
  </main>
</template>
