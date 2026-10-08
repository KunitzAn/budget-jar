<template>
  <div class="page">
    <header class="header">
      <h1>Budget <em>Jar</em></h1>
    </header>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <div class="actions">
        <button @click="goToNewPeriod" class="btn-primary">Создать период</button>
      </div>
    </div>

    <div v-else-if="period" class="content">
      <div class="period-header">
        <span class="pill">{{ formatDateRange(period.startDate, period.endDate) }}</span>
        <p class="days-left">
          <template v-if="active">Осталось дней: {{ daysLeftValue }}</template>
          <template v-else-if="future">Период ещё не начался</template>
          <template v-else>Период завершён</template>
        </p>

        <button v-if="!editingDates" @click="startEditDates" class="edit-dates-link">
          Изменить даты
        </button>

        <form v-else @submit.prevent="handleSaveDates" class="edit-dates-form">
          <input v-model="editStart" type="date" class="input" />
          <input v-model="editEnd" type="date" class="input" />
          <div class="edit-dates-actions">
            <button type="submit" class="btn-secondary-sm" :disabled="!isOnline || savingDates">
              {{ savingDates ? 'Сохранение...' : 'Сохранить' }}
            </button>
            <button type="button" @click="cancelEditDates" class="btn-secondary-sm">Отмена</button>
          </div>
          <p v-if="editDatesError" class="error-message">{{ editDatesError }}</p>
        </form>
      </div>

      <StoneJar :current-balance="balance" :total-sum="Number(period.totalSum)" />

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Заработано на сегодня</span>
          <span class="stat-value">{{ formatCurrency(earned) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Потрачено</span>
          <span class="stat-value negative">{{ formatCurrency(spent) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Потрачено сегодня</span>
          <span class="stat-value negative">{{ formatCurrency(spentTodayValue) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Дневная норма</span>
          <span class="stat-value small">{{ formatCurrency(daily) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Бюджет периода</span>
          <span class="stat-value small">{{ formatCurrency(Number(period.totalSum)) }}</span>
        </div>
        <div class="stat-card highlight">
          <span class="stat-label">Останется, если не тратить</span>
          <span class="stat-value" :class="remaining >= 0 ? 'positive' : 'negative'">
            {{ formatCurrency(remaining) }}
          </span>
        </div>
      </div>

      <CategoryToggles
        :categories="categories"
        flag="inBalance"
        label="Учитывать в банке"
        @updated="applyCategoryUpdate"
      />

      <ExpenseForm :categories="categories" @add="handleAddExpense" />

      <div v-if="period.expenses.length > 0" class="expenses-section">
        <h3>Траты ({{ period.expenses.length }})</h3>
        <div class="expenses-list">
          <div v-for="exp in sortedExpenses" :key="exp.id" class="expense-row" :class="{ pending: isPending(exp) }">
            <span class="expense-date">
              {{ formatDate(exp.date) }}
              <!-- селект лежит прозрачным слоем поверх чипа: так чип остаётся по
                   ширине своего названия, а нажатие открывает родной список -->
              <span
                v-if="categories.length > 0"
                class="category-chip"
                :class="{ empty: !categoryOf(exp) }"
                :style="categoryOf(exp) ? { background: categoryOf(exp)!.color } : undefined"
              >
                {{ categoryOf(exp)?.name ?? '+ категория' }}
                <select
                  :value="exp.categoryId ?? ''"
                  aria-label="Категория траты"
                  @change="handleChangeCategory(exp, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Без категории</option>
                  <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </span>
              <span v-if="isOutsideBalance(exp)" class="outside-badge">не в банке</span>
              <span v-if="isPending(exp)" class="pending-badge">⏳ ожидает синхронизации</span>
            </span>
            <span class="expense-amount">−{{ formatCurrency(Number(exp.amount)) }}</span>
            <button
              @click="handleDeleteExpense(exp.id)"
              class="expense-delete"
              aria-label="Удалить трату"
              title="Удалить трату"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <div class="actions">
        <button @click="goToNewPeriod" class="btn-secondary">Новый период</button>
        <button @click="handleDeletePeriod" class="btn-danger">Удалить период</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCurrentPeriod, getPeriod, deletePeriod, updatePeriodDates } from '../api/periods'
import { addExpense, deleteExpense, updateExpenseCategory } from '../api/expenses'
import { getCategories } from '../api/categories'
import { useOnlineStatus } from '../composables/useOnlineStatus'
import StoneJar from '../components/StoneJar.vue'
import ExpenseForm from '../components/ExpenseForm.vue'
import CategoryToggles from '../components/CategoryToggles.vue'
import type { Category, Expense, Period } from '../types'
import * as pm from '../lib/periodMath'
import { filterPeriod, findCategory } from '../lib/categories'

const route = useRoute()
const router = useRouter()
const { isOnline } = useOnlineStatus()
const loading = ref(true)
const error = ref('')
const period = ref<Period | null>(null)
const categories = ref<Category[]>([])

const editingDates = ref(false)
const editStart = ref('')
const editEnd = ref('')
const savingDates = ref(false)
const editDatesError = ref('')

// на "/" параметра нет — грузим текущий период; на "/periods/:id" — конкретный
const periodId = computed(() => (route.params.id ? parseInt(route.params.id as string) : null))

const active = computed(() => (period.value ? pm.isActive(period.value) : false))
const future = computed(() => (period.value ? pm.isFuture(period.value) : false))
const daysLeftValue = computed(() => (period.value ? pm.daysLeft(period.value) : 0))
const daily = computed(() => (period.value ? pm.dailyBudget(period.value) : 0))

// банка и всё, что считает потраченное, игнорируют категории с выключенным
// «учитывать в банке» — сам список трат ниже при этом показывает всё
const balancePeriod = computed(() =>
  period.value ? filterPeriod(period.value, categories.value, 'inBalance') : null,
)

const spent = computed(() => (balancePeriod.value ? pm.spentSoFar(balancePeriod.value) : 0))
const spentTodayValue = computed(() => (balancePeriod.value ? pm.spentToday(balancePeriod.value) : 0))
const earned = computed(() => (period.value ? pm.earnedSoFar(period.value) : 0))
const balance = computed(() => (balancePeriod.value ? pm.currentBalance(balancePeriod.value) : 0))
const remaining = computed(() =>
  balancePeriod.value ? pm.remainingIfNoMoreSpending(balancePeriod.value) : 0,
)

const isPending = (exp: Expense) => typeof exp.id === 'string' && exp.id.startsWith('local-')
const categoryOf = (exp: Expense) => findCategory(categories.value, exp.categoryId)
const isOutsideBalance = (exp: Expense) => categoryOf(exp)?.inBalance === false

const sortedExpenses = computed(() => {
  if (!period.value) return []
  return [...period.value.expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

const fetchPeriod = async () => {
  try {
    loading.value = true
    error.value = ''
    const { data } = periodId.value ? await getPeriod(periodId.value) : await getCurrentPeriod()
    period.value = data
  } catch (err: any) {
    if (err.response?.status === 404) {
      error.value = periodId.value ? 'Период не найден' : 'Нет активного периода. Создайте новый!'
    } else {
      error.value = 'Ошибка загрузки данных'
    }
  } finally {
    loading.value = false
  }
}

const fetchCategories = async () => {
  try {
    const { data } = await getCategories()
    categories.value = data
  } catch {
    // без категорий страница полностью работоспособна — просто не будет фильтра
  }
}

const handleAddExpense = async (amount: number, date: string, categoryId: number | null) => {
  if (!period.value) return
  try {
    await addExpense(period.value.id, { amount, date, categoryId })
    await fetchPeriod()
  } catch (err) {
    alert('Ошибка добавления траты')
  }
}

const applyCategoryUpdate = (updated: Category) => {
  categories.value = categories.value.map((c) => (c.id === updated.id ? updated : c))
}

const handleChangeCategory = async (exp: Expense, value: string) => {
  if (!period.value) return
  try {
    await updateExpenseCategory(exp.id, period.value.id, value === '' ? null : Number(value))
    await fetchPeriod()
  } catch {
    alert('Не удалось изменить категорию')
  }
}

const handleDeleteExpense = async (expenseId: number | string) => {
  if (!period.value) return
  if (!confirm('Удалить эту трату?')) return
  try {
    await deleteExpense(expenseId, period.value.id)
    await fetchPeriod()
  } catch (err) {
    alert('Не удалось удалить трату')
  }
}

const handleDeletePeriod = async () => {
  if (!period.value) return
  if (!confirm('Удалить этот период? Все траты периода будут потеряны.')) return
  try {
    await deletePeriod(period.value.id)
    if (periodId.value) {
      router.push('/periods')
    } else {
      period.value = null
      error.value = 'Нет активного периода. Создайте новый!'
    }
  } catch (err) {
    alert('Не удалось удалить период.')
  }
}

const startEditDates = () => {
  if (!period.value) return
  editStart.value = period.value.startDate.slice(0, 10)
  editEnd.value = period.value.endDate.slice(0, 10)
  editDatesError.value = ''
  editingDates.value = true
}

const cancelEditDates = () => {
  editingDates.value = false
  editDatesError.value = ''
}

const handleSaveDates = async () => {
  if (!period.value) return
  if (!isOnline.value) {
    editDatesError.value = 'Нужно подключение к интернету, чтобы изменить даты'
    return
  }
  editDatesError.value = ''
  savingDates.value = true
  try {
    await updatePeriodDates(period.value.id, { startDate: editStart.value, endDate: editEnd.value })
    editingDates.value = false
    await fetchPeriod()
  } catch (err: any) {
    if (!err.response) {
      editDatesError.value = 'Нужно подключение к интернету, чтобы изменить даты'
    } else if (err.response?.status === 409) {
      editDatesError.value = 'Период с такими датами уже существует. Выберите другие даты.'
    } else if (err.response?.status === 400) {
      editDatesError.value = 'Ошибка: конец периода должен быть позже начала'
    } else {
      editDatesError.value = 'Не удалось сохранить даты. Попробуйте снова.'
    }
  } finally {
    savingDates.value = false
  }
}

const goToNewPeriod = () => router.push('/new-period')

const formatCurrency = pm.formatCurrency
const formatDate = pm.formatDate
const formatDateRange = (start: string, end: string) => pm.formatDateRange(start, end)

onMounted(() => {
  fetchPeriod()
  fetchCategories()
  window.addEventListener('offline-sync-complete', fetchPeriod)
})
onUnmounted(() => {
  window.removeEventListener('offline-sync-complete', fetchPeriod)
})

// переход /periods/8 -> /periods/9 переиспользует тот же компонент — перечитать данные
watch(() => route.params.id, fetchPeriod)
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

.edit-dates-link {
  margin-top: 0.75rem;
  background: none;
  border: none;
  color: var(--accent-purple);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.edit-dates-form {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.edit-dates-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-secondary-sm {
  padding: 0.5rem 1.25rem;
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary-sm:hover:not(:disabled) {
  background: #ffffff;
}

.btn-secondary-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  color: var(--danger);
  font-size: 0.875rem;
  margin: 0;
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

.stat-card.highlight {
  border: 2px solid transparent;
  background:
    linear-gradient(var(--card-bg), var(--card-bg)) padding-box,
    var(--gradient-rainbow) border-box;
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

.stat-value.positive {
  color: var(--success);
}

.stat-value.small {
  font-size: 1.125rem;
}

.expenses-section h3 {
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem;
  color: var(--text-primary);
  margin: 0 0 1.25rem;
}

.expenses-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.expense-row {
  background: var(--card-bg);
  backdrop-filter: blur(8px);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 0.875rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.expense-date {
  color: var(--text-secondary);
  font-size: 0.9375rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.expense-row.pending {
  opacity: 0.65;
}

.pending-badge {
  font-size: 0.75rem;
  color: var(--accent-purple);
  font-weight: 500;
}

.category-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0.1875rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  cursor: pointer;
}

.category-chip.empty {
  background: transparent;
  border: 1px dashed var(--card-border);
  color: var(--text-secondary);
  font-weight: 500;
  text-shadow: none;
}

.category-chip select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  appearance: none;
  border: none;
  cursor: pointer;
}

.outside-badge {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-style: italic;
}

.expense-amount {
  color: var(--danger);
  font-weight: 600;
}

.expense-delete {
  margin-left: 0.75rem;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
}

.expense-delete:hover {
  background: var(--danger);
  color: white;
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
