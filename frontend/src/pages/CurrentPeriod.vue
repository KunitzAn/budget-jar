<template>
  <div class="page">
    <header class="header">
      <h1>Budget <em>Jar</em></h1>
      <button @click="handleLogout" class="btn-secondary">Выйти</button>
    </header>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="goToNewPeriod" class="btn-primary">Создать период</button>
    </div>

    <div v-else-if="period" class="content">
      <div class="period-header">
        <span class="pill">{{ formatDateRange(period.startDate, period.endDate) }}</span>
        <p class="days-left">Осталось дней: {{ daysLeft }}</p>
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
      </div>

      <ExpenseForm @add="handleAddExpense" />

      <div class="actions">
        <button @click="goToNewPeriod" class="btn-secondary">Новый период</button>
        <button @click="goToStats" class="btn-secondary">Статистика</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentPeriod } from '../api/periods'
import { addExpense } from '../api/expenses'
import { logout } from '../api/auth'
import StoneJar from '../components/StoneJar.vue'
import ExpenseForm from '../components/ExpenseForm.vue'
import type { Period } from '../types'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const period = ref<Period | null>(null)

const dailyBudget = computed(() => {
  if (!period.value) return 0
  const days = Math.ceil(
    (new Date(period.value.endDate).getTime() - new Date(period.value.startDate).getTime()) /
      (1000 * 60 * 60 * 24)
  ) + 1
  return period.value.totalSum / days
})

const daysPassed = computed(() => {
  if (!period.value) return 0
  const start = new Date(period.value.startDate)
  const today = new Date()
  return Math.max(0, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))) + 1
})

const daysLeft = computed(() => {
  if (!period.value) return 0
  const end = new Date(period.value.endDate)
  const today = new Date()
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
})

const earnedSoFar = computed(() => dailyBudget.value * daysPassed.value)

const spentSoFar = computed(() => {
  if (!period.value) return 0
  return period.value.expenses.reduce((sum, exp) => sum + exp.amount, 0)
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

const handleLogout = () => {
  logout()
  router.push('/login')
}

const goToNewPeriod = () => router.push('/new-period')
const goToStats = () => router.push('/stats')

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

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary, .btn-secondary {
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
