<template>
  <div class="page">
    <header class="header">
      <h1>Budget <em>Jar</em></h1>
      <button @click="goBack" class="btn-secondary">← Все периоды</button>
    </header>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="goBack" class="btn-primary">К списку периодов</button>
    </div>

    <div v-else-if="period" class="content">
      <div class="period-header">
        <span class="pill">{{ formatDateRange(period.startDate, period.endDate) }}</span>
        <p class="days-left">
          <template v-if="isActive">Осталось дней: {{ daysLeft }}</template>
          <template v-else-if="isFuture">Период ещё не начался</template>
          <template v-else>Период завершён</template>
        </p>
      </div>

      <StoneJar :current-balance="currentBalance" :max-possible="period.totalSum" />

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Заработано на сегодня</span>
          <span class="stat-value">{{ formatCurrency(earnedSoFar) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Потрачено</span>
          <span class="stat-value negative">{{ formatCurrency(spentSoFar) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Дневная норма</span>
          <span class="stat-value small">{{ formatCurrency(dailyBudget) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Бюджет периода</span>
          <span class="stat-value small">{{ formatCurrency(period.totalSum) }}</span>
        </div>
      </div>

      <ExpenseForm @add="handleAddExpense" />

      <div v-if="period.expenses.length > 0" class="expenses-section">
        <h3>Траты ({{ period.expenses.length }})</h3>
        <div class="expenses-list">
          <div v-for="exp in sortedExpenses" :key="exp.id" class="expense-row">
            <span class="expense-date">{{ formatDate(exp.date) }}</span>
            <span class="expense-amount">−{{ formatCurrency(exp.amount) }}</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <button @click="goBack" class="btn-secondary">← Все периоды</button>
        <button @click="handleDeletePeriod" class="btn-danger">Удалить период</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getPeriod, deletePeriod } from '../api/periods'
import { addExpense } from '../api/expenses'
import StoneJar from '../components/StoneJar.vue'
import ExpenseForm from '../components/ExpenseForm.vue'
import type { Period } from '../types'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const period = ref<Period | null>(null)

const periodId = computed(() => parseInt(route.params.id as string))

const MS_PER_DAY = 1000 * 60 * 60 * 24

// нормализуем дату к «дню» в UTC — убирает сдвиг из-за времени и таймзоны
const toUTCDay = (d: string | Date) => {
  const dt = new Date(d)
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
}

const totalDays = computed(() => {
  if (!period.value) return 0
  return Math.round((toUTCDay(period.value.endDate) - toUTCDay(period.value.startDate)) / MS_PER_DAY) + 1
})

const dailyBudget = computed(() => {
  if (!period.value || totalDays.value <= 0) return 0
  return period.value.totalSum / totalDays.value
})

const daysPassed = computed(() => {
  if (!period.value) return 0
  const start = toUTCDay(period.value.startDate)
  const today = toUTCDay(new Date())
  const passed = Math.round((today - start) / MS_PER_DAY) + 1
  return Math.max(0, Math.min(passed, totalDays.value))
})

const daysLeft = computed(() => {
  if (!period.value) return 0
  const end = toUTCDay(period.value.endDate)
  const today = toUTCDay(new Date())
  return Math.max(0, Math.round((end - today) / MS_PER_DAY))
})

const isActive = computed(() => {
  if (!period.value) return false
  const today = toUTCDay(new Date())
  return today >= toUTCDay(period.value.startDate) && today <= toUTCDay(period.value.endDate)
})

const isFuture = computed(() => {
  if (!period.value) return false
  return toUTCDay(new Date()) < toUTCDay(period.value.startDate)
})

const earnedSoFar = computed(() => dailyBudget.value * daysPassed.value)

const spentSoFar = computed(() => {
  if (!period.value) return 0
  return period.value.expenses.reduce((sum, exp) => sum + exp.amount, 0)
})

const currentBalance = computed(() => earnedSoFar.value - spentSoFar.value)

const sortedExpenses = computed(() => {
  if (!period.value) return []
  return [...period.value.expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
})

const fetchPeriod = async () => {
  try {
    loading.value = true
    error.value = ''
    const { data } = await getPeriod(periodId.value)
    period.value = data
  } catch (err: any) {
    if (err.response?.status === 404) {
      error.value = 'Период не найден'
    } else {
      error.value = 'Ошибка загрузки данных'
    }
  } finally {
    loading.value = false
  }
}

const handleAddExpense = async (amount: number) => {
  if (!period.value) return
  try {
    await addExpense(period.value.id, { amount })
    await fetchPeriod()
  } catch (err) {
    alert('Ошибка добавления траты')
  }
}

const handleDeletePeriod = async () => {
  if (!period.value) return
  if (!confirm('Удалить этот период? Все траты периода будут потеряны.')) return
  try {
    await deletePeriod(period.value.id)
    router.push('/periods')
  } catch (err) {
    alert('Не удалось удалить период.')
  }
}

const goBack = () => router.push('/periods')

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(value)

const formatDateRange = (start: string, end: string) => {
  const s = new Date(start)
  const e = new Date(end)
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt.format(s)} — ${fmt.format(e)}`
}

const formatDate = (d: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))

onMounted(fetchPeriod)
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #F7F4EF;
}

.header {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #E7E1D7;
  padding: 1.25rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header h1 {
  font-family: 'Playfair Display', serif;
  font-size: 1.75rem;
  margin: 0;
  color: #1F2421;
}

.header h1 em {
  color: #C4612F;
  font-style: italic;
}

.content {
  max-width: 800px;
  margin: 0 auto;
  padding: 3rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.period-header {
  text-align: center;
}

.pill {
  display: inline-block;
  background: #F2E3D6;
  color: #C4612F;
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.days-left {
  margin: 0.75rem 0 0;
  color: #5C635D;
  font-size: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.25rem;
}

.stat-card {
  background: #FFFFFF;
  border: 1px solid #E7E1D7;
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #5C635D;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1F2421;
}

.stat-value.negative {
  color: #dc2626;
}

.stat-value.small {
  font-size: 1.125rem;
}

.expenses-section h3 {
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem;
  color: #1F2421;
  margin: 0 0 1.25rem;
}

.expenses-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.expense-row {
  background: #FFFFFF;
  border: 1px solid #E7E1D7;
  border-radius: 12px;
  padding: 0.875rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.expense-date {
  color: #5C635D;
  font-size: 0.9375rem;
}

.expense-amount {
  color: #dc2626;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary, .btn-secondary, .btn-danger {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #C4612F;
  color: white;
}

.btn-primary:hover {
  background: #A94E22;
  transform: translateY(-2px);
}

.btn-secondary {
  background: #FBF9F5;
  color: #1F2421;
  border: 1px solid #E7E1D7;
}

.btn-secondary:hover {
  background: #F7F4EF;
  transform: translateY(-2px);
}

.btn-danger {
  background: #FBF9F5;
  color: #dc2626;
  border: 1px solid #f0c9c0;
}

.btn-danger:hover {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
  transform: translateY(-2px);
}

.loading, .error-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #5C635D;
}

.error-state {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
}
</style>