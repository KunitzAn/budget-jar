<template>
  <div class="page">
    <header class="header">
      <h1>Budget <em>Jar</em></h1>
      <div class="header-actions">
        <button @click="goToNewPeriod" class="btn-primary">+ Новый период</button>
        <button @click="goBack" class="btn-secondary">← Назад</button>
      </div>
    </header>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>

    <div v-else class="content">
      <div class="page-title">
        <span class="pill">Все периоды</span>
        <h2>Список периодов</h2>
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
          <span class="card-value" :class="(stats?.balance || 0) >= 0 ? 'positive' : 'negative'">
            {{ formatCurrency(stats?.balance || 0) }}
          </span>
        </div>
      </div>

      <div v-if="periods.length === 0" class="empty">
        <p>Пока нет ни одного периода.</p>
        <button @click="goToNewPeriod" class="btn-primary">Создать период</button>
      </div>

      <div v-else class="periods-list">
        <div v-for="p in periods" :key="p.id" class="period-card">
          <div class="period-main" @click="openPeriod(p.id)">
            <div class="period-dates">
              {{ formatDateRange(p.startDate, p.endDate) }}
              <span v-if="isActive(p)" class="badge-active">активный</span>
            </div>
            <div class="period-stats">
              <span class="period-total">Бюджет: {{ formatCurrency(Number(p.totalSum)) }}</span>
              <span class="period-spent">Потрачено: {{ formatCurrency(spent(p)) }}</span>
              <span
                class="period-balance"
                :class="balance(p) >= 0 ? 'positive' : 'negative'"
              >
                {{ balance(p) >= 0 ? '+' : '' }}{{ formatCurrency(balance(p)) }}
              </span>
            </div>
          </div>
          <button
            class="btn-delete"
            :disabled="deletingId === p.id"
            @click.stop="handleDelete(p.id)"
          >
            {{ deletingId === p.id ? '...' : 'Удалить' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getPeriods, deletePeriod } from '../api/periods'
import { getStats } from '../api/stats'
import type { Period, Stats } from '../types'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const periods = ref<Period[]>([])
const stats = ref<Stats | null>(null)
const deletingId = ref<number | null>(null)

const fetchPeriods = async () => {
  try {
    loading.value = true
    error.value = ''
    const [periodsRes, statsRes] = await Promise.all([getPeriods(), getStats()])
    periods.value = periodsRes.data
    stats.value = statsRes.data
  } catch (err) {
    error.value = 'Ошибка загрузки периодов'
  } finally {
    loading.value = false
  }
}

const spent = (p: Period) => p.expenses.reduce((sum, e) => sum + Number(e.amount), 0)

const balance = (p: Period) => Number(p.totalSum) - spent(p)

const isActive = (p: Period) => {
  const now = Date.now()
  return new Date(p.startDate).getTime() <= now && new Date(p.endDate).getTime() >= now
}

const openPeriod = (id: number) => router.push(`/periods/${id}`)

const handleDelete = async (id: number) => {
  if (!confirm('Удалить этот период? Все траты периода будут потеряны.')) return
  try {
    deletingId.value = id
    await deletePeriod(id)
    periods.value = periods.value.filter((p) => p.id !== id)
    const { data } = await getStats()
    stats.value = data
  } catch (err) {
    alert('Не удалось удалить период.')
  } finally {
    deletingId.value = null
  }
}

const goBack = () => router.push('/')
const goToNewPeriod = () => router.push('/new-period')

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

onMounted(fetchPeriods)
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

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.summary-card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: transform 0.2s;
  box-shadow: 0 8px 24px rgba(155, 107, 255, 0.08);
}

.summary-card:hover {
  transform: translateY(-3px);
}

.summary-card.highlight {
  border: 2px solid transparent;
  background:
    linear-gradient(var(--card-bg), var(--card-bg)) padding-box,
    var(--gradient-rainbow) border-box;
}

.card-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.card-value {
  font-size: 2rem;
  font-weight: 600;
}

.card-value.positive {
  color: var(--success);
}

.card-value.negative {
  color: var(--danger);
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
  background: var(--gradient-rainbow-soft);
  color: var(--accent-purple);
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
}

h2 {
  font-family: 'Playfair Display', serif;
  font-size: 2rem;
  color: var(--text-primary);
  margin: 0.75rem 0 0;
  letter-spacing: -0.02em;
}

.periods-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.period-card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  transition: box-shadow 0.2s, transform 0.2s;
}

.period-card:hover {
  box-shadow: 0 8px 24px rgba(155, 107, 255, 0.15);
  transform: translateY(-2px);
}

.period-main {
  flex: 1;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.period-dates {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 1.0625rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.badge-active {
  background: var(--gradient-rainbow);
  color: white;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.period-stats {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.period-total {
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.period-spent {
  color: var(--danger);
  font-size: 0.9375rem;
}

.period-balance {
  font-weight: 600;
  font-size: 1.125rem;
}

.period-balance.positive {
  color: var(--success);
}

.period-balance.negative {
  color: var(--danger);
}

.btn-delete {
  padding: 0.6rem 1.25rem;
  background: var(--card-bg);
  color: var(--danger);
  border: 1px solid rgba(255, 92, 122, 0.35);
  border-radius: 999px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-delete:hover:not(:disabled) {
  background: var(--danger);
  color: white;
  border-color: var(--danger);
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.75rem 2rem;
  background: var(--gradient-rainbow);
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 6px 18px rgba(255, 111, 165, 0.35);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(255, 111, 165, 0.45);
}

.btn-secondary {
  padding: 0.625rem 1.5rem;
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #ffffff;
  transform: translateY(-2px);
}

.empty {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
  padding: 3rem 2rem;
  color: var(--text-secondary);
}

.loading, .error-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}
</style>