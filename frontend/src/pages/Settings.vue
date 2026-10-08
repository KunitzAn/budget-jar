<template>
  <div class="page">
    <header class="header">
      <h1>Budget <em>Jar</em></h1>
    </header>

    <div class="content">
      <div class="page-title">
        <span class="pill">Настройки</span>
      </div>

      <section class="section">
        <h2>Зарплатный месяц</h2>

        <p v-if="loadingRules" class="hint">Загрузка...</p>
        <p v-else-if="currentRule" class="current-rule">
          Сейчас: {{ describeRule(currentRule) }}
          <span class="rule-since">(с {{ formatDate(currentRule.effectiveFrom) }})</span>
        </p>
        <p v-else class="hint">Ещё не настроен — понадобится для статистики по месяцам.</p>

        <form class="rule-form" @submit.prevent="handleSave">
          <div class="form-group">
            <label>Правило</label>
            <div class="type-toggle">
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: draftType === 'DAY_OF_MONTH' }"
                @click="draftType = 'DAY_OF_MONTH'"
              >
                Число месяца
              </button>
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: draftType === 'FIRST_WEEKDAY' }"
                @click="draftType = 'FIRST_WEEKDAY'"
              >
                День недели
              </button>
            </div>
          </div>

          <div class="form-group" v-if="draftType === 'DAY_OF_MONTH'">
            <label>Число месяца</label>
            <input v-model.number="draftDay" type="number" min="1" max="31" class="input" />
          </div>

          <div class="form-group" v-else>
            <label>Первый день недели в месяце</label>
            <select v-model.number="draftWeekday" class="input">
              <option v-for="(name, idx) in weekdayOptions" :key="idx" :value="idx">{{ name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>Применить с</label>
            <select v-model="selectedBoundaryIso" class="input">
              <option v-for="c in candidateOptions" :key="c.iso" :value="c.iso">{{ c.label }}</option>
            </select>
          </div>

          <p v-if="transitionPreview" class="transition-preview" :class="{ warning: transitionPreview.days < 15 }">
            Переходный месяц: {{ transitionPreview.label }} ({{ transitionPreview.days }} дн.)
            <template v-if="transitionPreview.days < 15">— короче обычного, проверьте дату</template>
          </p>

          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

          <button type="submit" class="btn-primary" :disabled="!isOnline || saving">
            {{ saving ? 'Сохранение...' : 'Сохранить' }}
          </button>
        </form>
      </section>

      <section class="section">
        <h2>Категории трат</h2>

        <p v-if="loadingCategories" class="hint">Загрузка...</p>
        <p v-else-if="categories.length === 0" class="hint">
          Пока нет ни одной категории. Трата без категории учитывается везде.
        </p>

        <div v-else class="category-list">
          <div v-for="c in categories" :key="c.id" class="category-row">
            <div class="category-head">
              <span class="category-dot" :style="{ background: c.color }"></span>
              <span class="category-name">{{ c.name }}</span>
              <button
                class="category-delete"
                :disabled="!isOnline"
                title="Удалить категорию"
                aria-label="Удалить категорию"
                @click="handleDeleteCategory(c)"
              >
                ×
              </button>
            </div>
            <div class="category-flags">
              <label class="category-flag">
                <input
                  type="checkbox"
                  :checked="c.inStats"
                  :disabled="!isOnline || savingCategoryId === c.id"
                  @change="toggleFlag(c, 'inStats', ($event.target as HTMLInputElement).checked)"
                />
                в статистике
              </label>
              <label class="category-flag">
                <input
                  type="checkbox"
                  :checked="c.inBalance"
                  :disabled="!isOnline || savingCategoryId === c.id"
                  @change="toggleFlag(c, 'inBalance', ($event.target as HTMLInputElement).checked)"
                />
                в банке
              </label>
            </div>
          </div>
        </div>

        <form class="category-form" @submit.prevent="handleCreateCategory">
          <div class="form-group">
            <label>Новая категория</label>
            <input
              v-model="newCategoryName"
              type="text"
              class="input"
              placeholder="Например, Продукты"
              maxlength="40"
            />
          </div>

          <div class="form-group">
            <label>Цвет</label>
            <div class="palette">
              <button
                v-for="color in PALETTE"
                :key="color"
                type="button"
                class="swatch"
                :class="{ selected: newCategoryColor === color }"
                :style="{ background: color }"
                :aria-label="`Выбрать цвет ${color}`"
                @click="newCategoryColor = color"
              ></button>
            </div>
          </div>

          <p v-if="categoryError" class="error-message">{{ categoryError }}</p>

          <button type="submit" class="btn-primary" :disabled="!isOnline || creatingCategory || !newCategoryName.trim()">
            {{ creatingCategory ? 'Добавление...' : 'Добавить категорию' }}
          </button>
        </form>
      </section>

      <section class="section">
        <h2>Офлайн-режим</h2>
        <p class="offline-status">
          Статус:
          <strong :class="offlineReady ? 'ready' : 'loading'">
            {{ offlineReady ? 'готов' : 'ещё загружается' }}
          </strong>
        </p>
        <p v-if="!offlineReady" class="hint">
          Подержите приложение открытым с интернетом, пока статус не сменится на «готов» —
          до этого запуск без сети работать не будет.
        </p>
      </section>

      <div class="actions">
        <button @click="handleLogout" class="btn-danger">Выйти</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { logout } from '../api/auth'
import { getPaydayRules, savePaydayRule } from '../api/settings'
import { createCategory, deleteCategory, getCategories, updateCategory } from '../api/categories'
import { useOnlineStatus } from '../composables/useOnlineStatus'
import * as sm from '../lib/salaryMonths'
import * as pm from '../lib/periodMath'
import type { Category, PaydayRule } from '../types'

const router = useRouter()
const { isOnline } = useOnlineStatus()

const OFFLINE_MESSAGE = 'Нужно подключение к интернету, чтобы изменить настройки'

const rules = ref<PaydayRule[]>([])
const loadingRules = ref(true)
const saving = ref(false)
const errorMessage = ref(isOnline.value ? '' : OFFLINE_MESSAGE)

const currentRule = computed<PaydayRule | null>(() => {
  if (rules.value.length === 0) return null
  const now = Date.now()
  const past = rules.value.filter((r) => new Date(r.effectiveFrom).getTime() <= now)
  return past.length > 0 ? past[past.length - 1] : rules.value[0]
})

const draftType = ref<'DAY_OF_MONTH' | 'FIRST_WEEKDAY'>('DAY_OF_MONTH')
const draftDay = ref(10)
const draftWeekday = ref(1)

const weekdayOptions = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

const draftRule = computed<sm.DraftRule>(() => ({
  type: draftType.value,
  dayOfMonth: draftType.value === 'DAY_OF_MONTH' ? draftDay.value : null,
  weekday: draftType.value === 'FIRST_WEEKDAY' ? draftWeekday.value : null,
}))

const candidateOptions = computed(() => {
  const boundaries = sm.candidateBoundaries(draftRule.value)
  const today = Date.now()
  let nextIndex = boundaries.findIndex((d) => d.getTime() > today)
  if (nextIndex === -1) nextIndex = boundaries.length - 1
  return boundaries.map((d, i) => {
    const iso = d.toISOString()
    let suffix = ''
    if (i === nextIndex - 1) suffix = ' (текущий)'
    else if (i === nextIndex) suffix = ' (следующий)'
    return { iso, label: pm.formatDate(iso) + suffix }
  })
})

const selectedBoundaryIso = ref('')

watch(
  candidateOptions,
  (opts) => {
    if (opts.length === 0) return
    if (!opts.some((o) => o.iso === selectedBoundaryIso.value)) {
      const next = opts.find((o) => o.label.includes('следующий')) ?? opts[opts.length - 1]
      selectedBoundaryIso.value = next.iso
    }
  },
  { immediate: true },
)

const transitionPreview = computed(() => {
  if (!selectedBoundaryIso.value || rules.value.length === 0) return null
  const newFrom = new Date(selectedBoundaryIso.value)
  const t = sm.previewTransitionMonth(rules.value, newFrom)
  if (!t) return null
  const days = sm.daysInclusive(t.start, t.end)
  return { label: pm.formatDateRange(t.start.toISOString(), t.end.toISOString(), false), days }
})

const fetchRules = async () => {
  loadingRules.value = true
  try {
    const { data } = await getPaydayRules()
    rules.value = data
    if (data.length > 0) {
      const latest = data[data.length - 1]
      draftType.value = latest.type
      if (latest.type === 'DAY_OF_MONTH') draftDay.value = latest.dayOfMonth ?? 10
      else draftWeekday.value = latest.weekday ?? 1
    }
  } catch (err) {
    // офлайн без кэша — список остаётся пустым, форма и так недоступна офлайн
  } finally {
    loadingRules.value = false
  }
}

const handleSave = async () => {
  if (!isOnline.value) {
    errorMessage.value = OFFLINE_MESSAGE
    return
  }
  if (draftType.value === 'DAY_OF_MONTH' && (draftDay.value < 1 || draftDay.value > 31)) {
    errorMessage.value = 'Число месяца должно быть от 1 до 31'
    return
  }

  errorMessage.value = ''
  saving.value = true
  try {
    const body =
      draftType.value === 'DAY_OF_MONTH'
        ? { type: draftType.value, dayOfMonth: draftDay.value, effectiveFrom: selectedBoundaryIso.value }
        : { type: draftType.value, weekday: draftWeekday.value, effectiveFrom: selectedBoundaryIso.value }

    const { data } = await savePaydayRule(body)
    rules.value = data.rules
  } catch (err: any) {
    if (!err.response) {
      errorMessage.value = OFFLINE_MESSAGE
    } else {
      errorMessage.value = err.response?.data?.error || 'Не удалось сохранить настройку'
    }
  } finally {
    saving.value = false
  }
}

watch(isOnline, (online) => {
  if (!online) {
    errorMessage.value = OFFLINE_MESSAGE
  } else if (errorMessage.value === OFFLINE_MESSAGE) {
    errorMessage.value = ''
  }
})

// Офлайн-копия готова, когда страницей управляет service worker — он
// активируется, только скачав оболочку целиком. Пока не готова, выключать
// интернет бесполезно: iOS пойдёт в сеть и покажет свою ошибку.
const offlineReady = ref(false)
if ('serviceWorker' in navigator) {
  offlineReady.value = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    offlineReady.value = !!navigator.serviceWorker.controller
  })
}

// фирменная палитра — те же цвета, что у пыльцы в банке
const PALETTE = ['#ff6fa5', '#ffa15c', '#ffd54f', '#4fc3f7', '#9b6bff', '#7fe0d0']

const categories = ref<Category[]>([])
const loadingCategories = ref(true)
const newCategoryName = ref('')
const newCategoryColor = ref(PALETTE[0])
const creatingCategory = ref(false)
const savingCategoryId = ref<number | null>(null)
const categoryError = ref('')

const fetchCategories = async () => {
  loadingCategories.value = true
  try {
    const { data } = await getCategories()
    categories.value = data
  } catch {
    // офлайн без кэша — список пустой, форма и так недоступна без сети
  } finally {
    loadingCategories.value = false
  }
}

const handleCreateCategory = async () => {
  const name = newCategoryName.value.trim()
  if (!name) return
  if (!isOnline.value) {
    categoryError.value = OFFLINE_MESSAGE
    return
  }

  categoryError.value = ''
  creatingCategory.value = true
  try {
    const { data } = await createCategory({
      name,
      color: newCategoryColor.value,
      inStats: true,
      inBalance: true,
    })
    categories.value = [...categories.value, data]
    newCategoryName.value = ''
  } catch (err: any) {
    categoryError.value = !err.response
      ? OFFLINE_MESSAGE
      : err.response?.data?.error || 'Не удалось добавить категорию'
  } finally {
    creatingCategory.value = false
  }
}

const toggleFlag = async (category: Category, flag: 'inStats' | 'inBalance', value: boolean) => {
  if (!isOnline.value) {
    categoryError.value = OFFLINE_MESSAGE
    return
  }

  categoryError.value = ''
  savingCategoryId.value = category.id
  try {
    const { data } = await updateCategory(category.id, { [flag]: value })
    categories.value = categories.value.map((c) => (c.id === data.id ? data : c))
  } catch (err: any) {
    // чекбокс в DOM уже переключился — возвращаем список как есть, чтобы Vue перерисовал его обратно
    categories.value = [...categories.value]
    categoryError.value = !err.response
      ? OFFLINE_MESSAGE
      : err.response?.data?.error || 'Не удалось сохранить категорию'
  } finally {
    savingCategoryId.value = null
  }
}

const handleDeleteCategory = async (category: Category) => {
  if (!confirm(`Удалить категорию «${category.name}»? Траты останутся, но станут без категории.`)) return
  if (!isOnline.value) {
    categoryError.value = OFFLINE_MESSAGE
    return
  }

  categoryError.value = ''
  try {
    await deleteCategory(category.id)
    categories.value = categories.value.filter((c) => c.id !== category.id)
  } catch (err: any) {
    categoryError.value = !err.response
      ? OFFLINE_MESSAGE
      : err.response?.data?.error || 'Не удалось удалить категорию'
  }
}

const describeRule = sm.describeRule
const formatDate = pm.formatDate

const handleLogout = () => {
  logout()
  router.push('/login')
}

onMounted(() => {
  fetchRules()
  fetchCategories()
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
  max-width: 600px;
  margin: 0 auto;
  padding: 3rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
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

.section {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section h2 {
  font-family: 'Playfair Display', serif;
  font-size: 1.375rem;
  color: var(--text-primary);
  margin: 0;
}

.hint {
  color: var(--text-secondary);
  font-size: 0.9375rem;
  margin: 0;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.category-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
}

.category-head {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.category-flags {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.category-dot {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-right: auto;
}

.category-flag {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.category-flag input {
  accent-color: var(--accent-purple);
  cursor: pointer;
}

.category-flag input:disabled {
  cursor: not-allowed;
}

.category-delete {
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

.category-delete:hover:not(:disabled) {
  background: var(--danger);
  color: white;
}

.category-delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.category-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.5rem;
}

.palette {
  display: flex;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.swatch {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.swatch:hover {
  transform: scale(1.1);
}

.swatch.selected {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 3px rgba(155, 107, 255, 0.2);
}

.current-rule {
  color: var(--text-primary);
  font-size: 0.9375rem;
  margin: 0;
}

.offline-status {
  color: var(--text-primary);
  font-size: 0.9375rem;
  margin: 0;
}

.offline-status .ready {
  color: var(--success);
}

.offline-status .loading {
  color: var(--accent-orange);
}

.rule-since {
  color: var(--text-secondary);
}

.rule-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.type-toggle {
  display: flex;
  gap: 0.5rem;
}

.toggle-btn {
  flex: 1;
  padding: 0.625rem 1rem;
  border: 1px solid var(--card-border);
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: var(--gradient-rainbow-soft);
  color: var(--accent-purple);
  border-color: transparent;
  font-weight: 600;
}

.input {
  padding: 0.75rem 1.25rem;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.85);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px rgba(155, 107, 255, 0.15);
}

.transition-preview {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 10px;
}

.transition-preview.warning {
  color: var(--danger);
}

.error-message {
  color: var(--danger);
  font-size: 0.875rem;
  margin: 0;
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

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(255, 111, 165, 0.45);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.actions {
  display: flex;
  justify-content: center;
}

.btn-danger {
  padding: 0.75rem 2rem;
  background: var(--card-bg);
  color: var(--danger);
  border: 1px solid rgba(255, 92, 122, 0.35);
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover {
  background: var(--danger);
  color: white;
  border-color: var(--danger);
  transform: translateY(-2px);
}
</style>
