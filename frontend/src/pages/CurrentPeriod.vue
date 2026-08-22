<template>
  <div class="page">
    <header class="header">
      <h1>Budget <em>Jar</em></h1>
      <button @click="handleLogout" class="btn-secondary">Выйти</button>
    </header>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <div class="actions">
        <button @click="goToNewPeriod" class="btn-primary">Создать период</button>
        <button @click="goToPeriods" class="btn-secondary">Все периоды</button>
      </div>
    </div>

    <div v-else-if="period" class="content">
      <div class="period-header">
        <span class="pill">{{ formatDateRange(period.startDate, period.endDate) }}</span>
        <p class="days-left">Осталось дней: {{ daysLeft }}</p>
      </div>

      <StoneJar :current-balance="currentBalance" :total-sum="Number(period.totalSum)" />

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
          <span class="stat-label">Потрачено сегодня</span>
          <span class="stat-value negative">{{ formatCurrency(spentToday) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Дневная норма</span>
          <span class="stat-value small">{{ formatCurrency(dailyBudget) }}</span>
        </div>
      </div>

      <ExpenseForm @add="handleAddExpense" />

      <div class="actions">
        <button @click="goToNewPeriod" class="btn-secondary">Новый период</button>
        <button @click="goToPeriods" class="btn-secondary">Все периоды</button>
        <button @click="handleDeletePeriod" class="btn-danger">Удалить период</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentPeriod, deletePeriod } from '../api/periods'
import { addExpense } from '../api/expenses'
import { logout } from '../api/auth'
import StoneJar from '../components/StoneJar.vue'
import ExpenseForm from '../components/ExpenseForm.vue'
import type { Period } from '../types'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const period = ref<Period | null>(null)

const MS_PER_DAY = 1000 * 60 * 60 * 24
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000 // МСК = UTC+3

// округляем момент до «дня» по московскому времени
// (новый день наступает в 00:00 МСК, а не 00:00 UTC)
const toUTCDay = (d: string | Date) => {
  const t = new Date(d).getTime() + MSK_OFFSET_MS
  const dt = new Date(t)
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
}

const totalDays = computed(() => {
  if (!period.value) return 0
  return Math.round((toUTCDay(period.value.endDate) - toUTCDay(period.value.startDate)) / MS_PER_DAY) + 1
})

const dailyBudget = computed(() => {
  if (!period.value || totalDays.value <= 0) return 0
  return Number(period.value.totalSum) / totalDays.value
})

const daysPassed = computed(() => {
  if (!period.value) return 0
  const start = toUTCDay(period.value.startDate)
  const today = toUTCDay(new Date())
  const passed = Math.round((today - start) / MS_PER_DAY) + 1
  // не меньше 0 и не больше длины периода
  return Math.max(0, Math.min(passed, totalDays.value))
})

const daysLeft = computed(() => {
  if (!period.value) return 0
  const end = toUTCDay(period.value.endDate)
  const today = toUTCDay(new Date())
  return Math.max(0, Math.round((end - today) / MS_PER_DAY))
})

const earnedSoFar = computed(() => dailyBudget.value * daysPassed.value)

const spentSoFar = computed(() => {
  if (!period.value) return 0
  return period.value.expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
})

const spentToday = computed(() => {
  if (!period.value) return 0
  const today = toUTCDay(new Date())
  return period.value.expenses
    .filter((exp) => toUTCDay(exp.date) === today)
    .reduce((sum, exp) => sum + Number(exp.amount), 0)
})

const currentBalance = computed(() => earnedSoFar.value - spentSoFar.value)

const fetchPeriod = async () => {
  try {
    loading.value = true
    error.value = ''
    const { data } = await getCurrentPeriod()
    period.value = data
  } catch (err: any) {
    if (err.response?.status === 404) {
      error.value = 'Нет активного периода. Создайте новый!'
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
  if (!confirm('Удалить текущий период? Все траты этого периода будут потеряны.')) return
  try {
    await deletePeriod(period.value.id)
    period.value = null
    error.value = 'Нет активного периода. Создайте новый!'
  } catch (err) {
    alert('Не удалось удалить период. Попробуйте снова.')
  }
}

const handleLogout = () => {
  logout()
  router.push('/login')
}

const goToNewPeriod = () => router.push('/new-period')
const goToPeriods = () => router.push('/periods')

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(value)
}

const formatDateRange = (start: string, end: string) => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
  return `${fmt.format(startDate)} — ${fmt.format(endDate)}`
}

onMounted(fetchPeriod)
</script>

<style scoped>
.page {
  min-height: 100vh;
}

.header {
  background: var(--card-bg);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--card-border);
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
  color: var(--text-primary);
}

.header h1 em {
  background: var(--gradient-rainbow);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
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
  background: var(--gradient-rainbow-soft);
  color: var(--accent-purple);
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.days-left {
  margin: 0.75rem 0 0;
  color: var(--text-secondary);
  font-size: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.25rem;
}

.stat-card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: 0 8px 24px rgba(155, 107, 255, 0.08);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-value.negative {
  color: var(--danger);
}

.stat-value.small {
  font-size: 1.125rem;
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
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--gradient-rainbow);
  color: white;
  box-shadow: 0 6px 18px rgba(255, 111, 165, 0.35);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(255, 111, 165, 0.45);
}

.btn-secondary {
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--card-border);
}

.btn-secondary:hover {
  background: #ffffff;
  transform: translateY(-2px);
}

.btn-danger {
  background: var(--card-bg);
  color: var(--danger);
  border: 1px solid rgba(255, 92, 122, 0.35);
}

.btn-danger:hover {
  background: var(--danger);
  color: white;
  border-color: var(--danger);
  transform: translateY(-2px);
}

.loading, .error-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.error-state {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
}
</style>