<template>
  <div class="page">
    <header class="header">
      <h1>Budget <em>Jar</em></h1>
    </header>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else class="content">
      <div class="page-title">
        <span class="pill">Статистика</span>
      </div>

      <div class="toggles">
        <div class="toggle-group">
          <button
            class="toggle-btn"
            :class="{ active: viewMode === 'periods' }"
            @click="viewMode = 'periods'"
          >
            По периодам
          </button>
          <button
            class="toggle-btn"
            :class="{ active: viewMode === 'months' }"
            @click="viewMode = 'months'"
          >
            По месяцам
          </button>
        </div>

        <div class="toggle-group">
          <button
            class="toggle-btn"
            :class="{ active: balanceMode === 'projected' }"
            @click="balanceMode = 'projected'"
          >
            Прогноз
          </button>
          <button
            class="toggle-btn"
            :class="{ active: balanceMode === 'accrued' }"
            @click="balanceMode = 'accrued'"
          >
            Накоплено на сегодня
          </button>
        </div>
      </div>

      <CategoryToggles
        :categories="categories"
        flag="inStats"
        label="Учитывать в статистике"
        @updated="applyCategoryUpdate"
      />

      <div v-if="viewMode === 'months' && rules.length === 0" class="empty">
        <p>Зарплатный месяц ещё не настроен.</p>
        <button @click="goToSettings" class="btn-primary">Настроить</button>
      </div>

      <template v-else-if="points.length === 0">
        <div class="empty">
          <p>Пока нет данных для статистики.</p>
        </div>
      </template>

      <template v-else>
        <div class="summary-cards">
          <div class="summary-card highlight">
            <span class="card-label">Сэкономлено</span>
            <span class="card-value" :class="savedTotal >= 0 ? 'positive' : 'negative'">
              {{ formatCurrency(savedTotal) }}
            </span>
            <span class="card-sub">{{ Math.round(currentTotals.savedPercent) }}% от бюджета</span>
          </div>
          <div class="summary-card">
            <span class="card-label">Потрачено</span>
            <span class="card-value negative">{{ formatCurrency(currentTotals.spent) }}</span>
          </div>
          <div class="summary-card">
            <span class="card-label">Бюджет</span>
            <span class="card-value">{{ formatCurrency(currentTotals.budget) }}</span>
          </div>
          <div class="summary-card">
            <span class="card-label">Средний расход в день</span>
            <span class="card-value small">{{ formatCurrency(currentTotals.avgDailySpend) }}</span>
          </div>
        </div>

        <StatsBarChart :points="chartPoints" />

        <div v-if="breakdown.length > 0" class="breakdown">
          <h3 class="breakdown-title">По категориям</h3>
          <div v-for="c in breakdown" :key="c.key" class="breakdown-row">
            <div class="breakdown-head">
              <span class="breakdown-dot" :style="{ background: c.color }"></span>
              <span class="breakdown-name">{{ c.name }}</span>
              <span class="breakdown-percent">{{ Math.round(c.percent) }}%</span>
              <span class="breakdown-amount">{{ formatCurrency(c.spent) }}</span>
            </div>
            <div class="breakdown-bar">
              <div class="breakdown-fill" :style="{ width: `${c.percent}%`, background: c.color }"></div>
            </div>
          </div>
        </div>

        <div class="stat-list">
          <div v-for="p in reversedPoints" :key="p.key" class="stat-row">
            <div class="stat-row-main">
              <span class="stat-row-label">{{ p.label }}</span>
              <span v-if="p.uncoveredDays" class="uncovered-badge">
                {{ p.uncoveredDays }} дн. без периода
              </span>
            </div>
            <div class="stat-row-numbers">
              <span class="stat-row-budget">{{ formatCurrency(p.budget) }}</span>
              <span class="stat-row-spent">{{ p.spent > 0 ? '−' : '' }}{{ formatCurrency(p.spent) }}</span>
              <span
                class="stat-row-saved"
                :class="(balanceMode === 'projected' ? p.savedProjected : p.savedAccrued) >= 0 ? 'positive' : 'negative'"
              >
                {{ formatCurrency(balanceMode === 'projected' ? p.savedProjected : p.savedAccrued) }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getPeriods } from '../api/periods'
import { getPaydayRules } from '../api/settings'
import { getCategories } from '../api/categories'
import StatsBarChart from '../components/StatsBarChart.vue'
import CategoryToggles from '../components/CategoryToggles.vue'
import * as stats from '../lib/stats'
import * as pm from '../lib/periodMath'
import { filterPeriods } from '../lib/categories'
import type { Category, Period, PaydayRule } from '../types'

const router = useRouter()
const loading = ref(true)
const periods = ref<Period[]>([])
const rules = ref<PaydayRule[]>([])
const categories = ref<Category[]>([])

const viewMode = ref<'periods' | 'months'>('periods')
const balanceMode = ref<'projected' | 'accrued'>('projected')

// вся страница считается по тратам, из которых убраны категории с выключенным
// «учитывать в статистике» — включая суммы, график и разбивку ниже
const statsPeriods = computed(() => filterPeriods(periods.value, categories.value, 'inStats'))

const points = computed<stats.StatPoint[]>(() => {
  if (statsPeriods.value.length === 0) return []
  if (viewMode.value === 'periods') return stats.periodStatPoints(statsPeriods.value)

  if (rules.value.length === 0) return []
  const starts = statsPeriods.value.map((p) => new Date(p.startDate).getTime())
  const ends = statsPeriods.value.map((p) => new Date(p.endDate).getTime())
  const rangeStart = new Date(Math.min(...starts))
  // до сегодня — или до конца последнего периода, если он в будущем;
  // без искусственного запаса вперёд, иначе показываются пустые ненаступившие месяцы
  const rangeEnd = new Date(Math.max(...ends, Date.now()))
  return stats.monthStatPoints(statsPeriods.value, rules.value, rangeStart, rangeEnd)
})

const breakdown = computed<stats.CategoryStat[]>(() => {
  if (points.value.length === 0) return []
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  return stats.categoryBreakdown(statsPeriods.value, categories.value, first.start, last.end)
})

const reversedPoints = computed(() => [...points.value].reverse())

const currentTotals = computed(() => stats.totals(points.value))
const savedTotal = computed(() =>
  balanceMode.value === 'projected' ? currentTotals.value.savedProjected : currentTotals.value.savedAccrued,
)

const chartPoints = computed(() =>
  points.value.map((p) => ({
    key: p.key,
    shortLabel: p.label.split(' — ')[0],
    value: balanceMode.value === 'projected' ? p.savedProjected : p.savedAccrued,
  })),
)

const applyCategoryUpdate = (updated: Category) => {
  categories.value = categories.value.map((c) => (c.id === updated.id ? updated : c))
}

const formatCurrency = pm.formatCurrency
const goToSettings = () => router.push('/settings')

const fetchData = async () => {
  loading.value = true
  try {
    const [periodsRes, rulesRes, categoriesRes] = await Promise.all([
      getPeriods(),
      getPaydayRules(),
      getCategories(),
    ])
    periods.value = periodsRes.data
    rules.value = rulesRes.data
    categories.value = categoriesRes.data
  } catch (err) {
    // офлайн без кэша — просто покажем пустое состояние
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
  window.addEventListener('offline-sync-complete', fetchData)
})
onUnmounted(() => {
  window.removeEventListener('offline-sync-complete', fetchData)
})
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
  gap: 2rem;
}

.page-title {
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

.toggles {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.toggle-group {
  display: inline-flex;
  gap: 0.5rem;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  padding: 0.25rem;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.toggle-btn.active {
  background: var(--gradient-rainbow-soft);
  color: var(--accent-purple);
  font-weight: 600;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.25rem;
}

.summary-card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  box-shadow: 0 8px 24px rgba(155, 107, 255, 0.08);
}

.summary-card.highlight {
  border: 2px solid transparent;
  background:
    linear-gradient(var(--card-bg), var(--card-bg)) padding-box,
    var(--gradient-rainbow) border-box;
}

.card-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.card-value {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.card-value.small {
  font-size: 1.25rem;
}

.card-value.positive {
  color: var(--success);
}

.card-value.negative {
  color: var(--danger);
}

.card-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.breakdown {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.breakdown-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.25rem;
  color: var(--text-primary);
  margin: 0;
}

.breakdown-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.breakdown-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
}

.breakdown-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.breakdown-name {
  color: var(--text-primary);
  margin-right: auto;
}

.breakdown-percent {
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.breakdown-amount {
  font-weight: 600;
  color: var(--text-primary);
}

.breakdown-bar {
  height: 0.5rem;
  border-radius: 999px;
  background: rgba(155, 107, 255, 0.1);
  overflow: hidden;
}

.breakdown-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s;
}

.stat-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-row {
  background: var(--card-bg);
  backdrop-filter: blur(8px);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 0.875rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.stat-row-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stat-row-label {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.uncovered-badge {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.6);
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
}

.stat-row-numbers {
  display: flex;
  gap: 1.25rem;
  font-size: 0.875rem;
  flex-wrap: wrap;
}

.stat-row-budget {
  color: var(--text-secondary);
}

.stat-row-spent {
  color: var(--danger);
}

.stat-row-saved {
  font-weight: 600;
  margin-left: auto;
}

.stat-row-saved.positive {
  color: var(--success);
}

.stat-row-saved.negative {
  color: var(--danger);
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

.empty {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
  padding: 3rem 2rem;
  color: var(--text-secondary);
}

.loading {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}
</style>
