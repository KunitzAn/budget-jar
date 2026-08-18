<template>
  <div class="page">
    <header class="header">
      <h1>Budget <em>Jar</em></h1>
      <button @click="goBack" class="btn-secondary">← Назад</button>
    </header>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>

    <div v-else class="content">
      <div class="page-title">
        <span class="pill">Статистика</span>
        <h2>Общая картина</h2>
      </div>

      <div class="summary-cards">
        <div class="summary-card">
          <span class="card-label">Общий доход</span>
          <span class="card-value positive">{{ formatCurrency(stats?.totalIncome || 0) }}</span>
        </div>

        <div class="summary-card">
          <span class="card-label">Общие траты</span>
          <span class="card-value negative">{{ formatCurrency(stats?.totalExpenses || 0) }}</span>
        </div>

        <div class="summary-card highlight">
          <span class="card-label">Итоговый баланс</span>
          <span class="card-value" :class="balanceClass">
            {{ formatCurrency(stats?.balance || 0) }}
          </span>
        </div>
      </div>

      <div v-if="stats?.periods && stats.periods.length > 0" class="periods-section">
        <h3>История периодов</h3>
        <div class="periods-list">
          <div v-for="period in stats.periods" :key="period.id" class="period-card">
            <div class="period-dates">
              {{ formatDateRange(period.startDate, period.endDate) }}
            </div>
            <div class="period-stats">
              <span class="period-total">{{ formatCurrency(period.totalSum) }}</span>
              <span class="period-spent">
                Потрачено: {{ formatCurrency(calculateSpent(period)) }}
              </span>
              <span 
                class="period-balance" 
                :class="calculateBalance(period) >= 0 ? 'positive' : 'negative'"
              >
                {{ calculateBalance(period) >= 0 ? '+' : '' }}{{ formatCurrency(calculateBalance(period)) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getStats } from '../api/stats'
import type { Stats, Period } from '../types'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const stats = ref<Stats | null>(null)

const balanceClass = computed(() => {
  if (!stats.value) return ''
  return stats.value.balance >= 0 ? 'positive' : 'negative'
})

const fetchStats = async () => {
  try {
    loading.value = true
    error.value = ''
    const { data } = await getStats()
    stats.value = data
  } catch (err) {
    error.value = 'Ошибка загрузки статистики'
  } finally {
    loading.value = false
  }
}

const calculateSpent = (period: Period) => {
  return period.expenses.reduce((sum, exp) => sum + exp.amount, 0)
}

const calculateBalance = (period: Period) => {
  return period.totalSum - calculateSpent(period)
}

const goBack = () => router.push('/')

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
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt.format(startDate)} — ${fmt.format(endDate)}`
}

onMounted(fetchStats)
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
  max-width: 900px;
  margin: 0 auto;
  padding: 3rem 2rem;
}

.page-title {
  text-align: center;
  margin-bottom: 3rem;
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

h2 {
  font-family: 'Playfair Display', serif;
  font-size: 2rem;
  color: #1F2421;
  margin: 0.75rem 0 0;
  letter-spacing: -0.02em;
}

h3 {
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem;
  color: #1F2421;
  margin: 0 0 1.5rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.summary-card {
  background: #FFFFFF;
  border: 1px solid #E7E1D7;
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: transform 0.2s;
}

.summary-card:hover {
  transform: translateY(-3px);
}

.summary-card.highlight {
  border: 2px solid #C4612F;
  background: #FBF9F5;
}

.card-label {
  font-size: 0.875rem;
  color: #5C635D;
  font-weight: 500;
}

.card-value {
  font-size: 2rem;
  font-weight: 600;
}

.card-value.positive {
  color: #16a34a;
}

.card-value.negative {
  color: #dc2626;
}

.periods-section {
  margin-top: 3rem;
}

.periods-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.period-card {
  background: #FFFFFF;
  border: 1px solid #E7E1D7;
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  transition: box-shadow 0.2s;
}

.period-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.period-dates {
  font-weight: 500;
  color: #1F2421;
  font-size: 1.0625rem;
}

.period-stats {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.period-total {
  color: #5C635D;
  font-size: 0.9375rem;
}

.period-spent {
  color: #dc2626;
  font-size: 0.9375rem;
}

.period-balance {
  font-weight: 600;
  font-size: 1.125rem;
}

.period-balance.positive {
  color: #16a34a;
}

.period-balance.negative {
  color: #dc2626;
}

.btn-secondary {
  padding: 0.625rem 1.5rem;
  background: #FBF9F5;
  color: #1F2421;
  border: 1px solid #E7E1D7;
  border-radius: 999px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
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
</style>
