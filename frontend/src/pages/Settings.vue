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
import { useOnlineStatus } from '../composables/useOnlineStatus'
import * as sm from '../lib/salaryMonths'
import * as pm from '../lib/periodMath'
import type { PaydayRule } from '../types'

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

const describeRule = sm.describeRule
const formatDate = pm.formatDate

const handleLogout = () => {
  logout()
  router.push('/login')
}

onMounted(fetchRules)
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
