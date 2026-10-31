<script setup lang="ts">
import { ArrowRightLeft, Plus, TriangleAlert } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BarGauge from '../components/BarGauge.vue'
import ExchangeSheet from '../components/ExchangeSheet.vue'
import ExpenseRow from '../components/ExpenseRow.vue'
import ExpenseSheet from '../components/ExpenseSheet.vue'
import DayHeader from '../components/DayHeader.vue'
import Vnd from '../components/Vnd.vue'
import { alive, ensureDefaultCategory } from '../lib/data'
import { db, type Expense } from '../lib/db'
import { formatRub } from '../lib/format'
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

const recent = computed(() =>
  groupByDay(
    [...expenses.value]
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
      .slice(0, 12),
    (e) => e.date,
    (e) => e.vnd,
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

        <button
          v-for="bar in openBars.slice(1)"
          :key="bar.id"
          type="button"
          class="glass rounded-2xl p-3.5 text-left"
          @click="router.push(`/bar/${bar.id}`)"
        >
          <BarGauge :bar="bar" />
        </button>
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
          <div v-for="day in recent" :key="day.date">
            <DayHeader :date="day.date" :total="day.total" />
            <div class="divide-y" style="border-color: var(--line)">
              <ExpenseRow
                v-for="e in day.rows"
                :key="e.id"
                :expense="e"
                :category="categoryById.get(e.categoryId)"
                :rub="fifo.rubByExpense.get(e.id) ?? 0"
                @open="openExpense(e)"
              />
            </div>
          </div>
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
