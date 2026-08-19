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
        <span class="pill">Все периоды</span>
        <h2>Список периодов</h2>
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
              <span class="period-total">Бюджет: {{ formatCurrency(p.totalSum) }}</span>
              <span class="period-spent">Потрачено: {{ formatCurrency(spent(p)) }}</span>
              <span
                class="period-balance"
                :class="(p.totalSum - spent(p)) >= 0 ? 'positive' : 'negative'"
              >
                {{ (p.totalSum - spent(p)) >= 0 ? '+' : '' }}{{ formatCurrency(p.totalSum - spent(p)) }}
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
import type { Period } from '../types'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const periods = ref<Period[]>([])
const deletingId = ref<number | null>(null)

const fetchPeriods = async () => {
  try {
    loading.value = true
    error.value = ''
    const { data } = await getPeriods()
    periods.value = data
  } catch (err) {
    error.value = 'Ошибка загрузки периодов'
  } finally {
    loading.value = false
  }
}

const spent = (p: Period) => p.expenses.reduce((sum, e) => sum + e.amount, 0)

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
  gap: 1rem;
  transition: box-shadow 0.2s;
}

.period-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
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
  color: #1F2421;
  font-size: 1.0625rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.badge-active {
  background: #dcfce7;
  color: #16a34a;
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

.btn-delete {
  padding: 0.6rem 1.25rem;
  background: #FBF9F5;
  color: #dc2626;
  border: 1px solid #f0c9c0;
  border-radius: 999px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-delete:hover:not(:disabled) {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.75rem 2rem;
  background: #C4612F;
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #A94E22;
  transform: translateY(-2px);
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

.empty {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
  padding: 3rem 2rem;
  color: #5C635D;
}

.loading, .error-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #5C635D;
}
</style>