<template>
  <div class="exchange-section">
    <div class="exchange-head">
      <h3>Обмен валюты</h3>
      <button v-if="!adding" class="link-btn" @click="startAdd">Обменять</button>
    </div>

    <p v-for="[currency, wallet] in walletEntries" :key="currency" class="wallet">
      На руках: <strong>{{ formatAmount(wallet.amount, currency) }}</strong>
      <span class="wallet-rub">≈ {{ formatCurrency(wallet.rub) }}</span>
    </p>

    <p v-for="[currency, amount] in overdraftEntries" :key="`over-${currency}`" class="overdraft">
      Трат в этой валюте больше, чем обменяно, на {{ formatAmount(amount, currency) }} — добавьте
      недостающий обмен, иначе эта часть посчитана по курсу последнего.
    </p>

    <form v-if="adding" class="exchange-form" @submit.prevent="handleAdd">
      <div class="form-row">
        <label>Дата</label>
        <input v-model="date" type="date" :max="today" class="input" />
      </div>
      <div class="form-row">
        <label>Отдала</label>
        <div class="amount-field">
          <input v-model.number="fromAmount" type="number" min="0" step="0.01" class="input" placeholder="10000" />
          <span class="suffix">{{ currencySymbol(fromCurrency) }}</span>
        </div>
      </div>
      <div class="form-row">
        <label>Получила</label>
        <div class="amount-field">
          <input v-model.number="toAmount" type="number" min="0" step="1" class="input" placeholder="3000000" />
          <span class="suffix">{{ currencySymbol(toCurrency) }}</span>
        </div>
      </div>

      <p v-if="draftRate" class="rate-preview">Курс: {{ draftRate }}</p>
      <p v-if="error" class="error-message">{{ error }}</p>

      <div class="form-actions">
        <button type="submit" class="btn-secondary-sm" :disabled="saving">
          {{ saving ? 'Сохранение...' : 'Сохранить' }}
        </button>
        <button type="button" class="btn-secondary-sm" @click="adding = false">Отмена</button>
      </div>
    </form>

    <div v-if="periodExchanges.length > 0" class="exchange-list">
      <div v-for="x in periodExchanges" :key="x.id" class="exchange-row" :class="{ pending: isPending(x) }">
        <div class="exchange-main">
          <span class="exchange-amounts">
            {{ formatAmount(Number(x.fromAmount), x.fromCurrency) }} →
            {{ formatAmount(Number(x.toAmount), x.toCurrency) }}
          </span>
          <button class="exchange-delete" aria-label="Удалить обмен" title="Удалить обмен" @click="handleDelete(x)">
            ×
          </button>
        </div>
        <div class="exchange-meta">
          <span>{{ formatDate(x.date) }}</span>
          <span class="exchange-rate">{{ rateLabel(x) }}</span>
          <span v-if="isPending(x)" class="pending-badge">⏳ ожидает синхронизации</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createExchange, deleteExchange } from '../api/exchanges'
import { currencySymbol, formatAmount } from '../lib/currency'
import { formatCurrency, formatDate, toUTCDay } from '../lib/periodMath'
import type { ConversionResult } from '../lib/currency'
import type { Exchange } from '../types'

const props = defineProps<{
  exchanges: Exchange[]
  conversion: ConversionResult
  periodStart: string
  periodEnd: string
}>()

const emit = defineEmits<{ changed: [] }>()

const today = new Date().toISOString().slice(0, 10)

const adding = ref(false)
const saving = ref(false)
const error = ref('')
const date = ref(today)
const fromCurrency = ref('RUB')
const toCurrency = ref('VND')
const fromAmount = ref<number | null>(null)
const toAmount = ref<number | null>(null)

const walletEntries = computed(() => [...props.conversion.walletByCurrency.entries()])
const overdraftEntries = computed(() => [...props.conversion.overdraftByCurrency.entries()])

// показываем обмены этого периода; на кошелёк влияют все, но в списке периода
// чужие даты только мешали бы
const periodExchanges = computed(() => {
  const start = toUTCDay(props.periodStart)
  const end = toUTCDay(props.periodEnd)
  return [...props.exchanges]
    .filter((x) => {
      const day = toUTCDay(x.date)
      return day >= start && day <= end
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

const isPending = (x: Exchange) => typeof x.id === 'string' && x.id.startsWith('local-')

const rate = (from: number, to: number, fromCur: string, toCur: string) =>
  `1 ${currencySymbol(fromCur)} = ${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(to / from)} ${currencySymbol(toCur)}`

const rateLabel = (x: Exchange) =>
  rate(Number(x.fromAmount), Number(x.toAmount), x.fromCurrency, x.toCurrency)

const draftRate = computed(() => {
  if (!fromAmount.value || !toAmount.value || fromAmount.value <= 0 || toAmount.value <= 0) return ''
  return rate(fromAmount.value, toAmount.value, fromCurrency.value, toCurrency.value)
})

const startAdd = () => {
  date.value = today
  fromAmount.value = null
  toAmount.value = null
  error.value = ''
  adding.value = true
}

const handleAdd = async () => {
  if (!fromAmount.value || !toAmount.value || fromAmount.value <= 0 || toAmount.value <= 0) {
    error.value = 'Заполните обе суммы'
    return
  }

  error.value = ''
  saving.value = true
  try {
    await createExchange({
      date: date.value,
      fromCurrency: fromCurrency.value,
      fromAmount: fromAmount.value,
      toCurrency: toCurrency.value,
      toAmount: toAmount.value,
    })
    adding.value = false
    emit('changed')
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Не удалось сохранить обмен'
  } finally {
    saving.value = false
  }
}

const handleDelete = async (x: Exchange) => {
  if (!confirm('Удалить этот обмен? Траты в валюте пересчитаются по оставшимся обменам.')) return
  try {
    await deleteExchange(x.id)
    emit('changed')
  } catch {
    error.value = 'Не удалось удалить обмен'
  }
}
</script>

<style scoped>
.exchange-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.exchange-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.exchange-head h3 {
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem;
  color: var(--text-primary);
  margin: 0;
}

.link-btn {
  background: none;
  border: none;
  color: var(--accent-purple);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.wallet {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.wallet strong {
  color: var(--text-primary);
}

.wallet-rub {
  margin-left: 0.5rem;
}

.overdraft {
  margin: 0;
  font-size: 0.875rem;
  color: var(--accent-orange);
}

.exchange-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--card-border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-row label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.amount-field {
  position: relative;
  display: flex;
  align-items: center;
}

.amount-field .input {
  flex: 1;
  padding-right: 2.25rem;
}

.suffix {
  position: absolute;
  right: 1rem;
  color: var(--text-secondary);
  pointer-events: none;
}

.input {
  padding: 0.625rem 1rem;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  font-size: 1rem;
  font-family: inherit;
  width: 100%;
  background: rgba(255, 255, 255, 0.85);
}

.input:focus {
  outline: none;
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px rgba(155, 107, 255, 0.15);
}

.rate-preview {
  margin: 0;
  font-size: 0.875rem;
  color: var(--accent-purple);
  font-weight: 500;
}

.error-message {
  margin: 0;
  color: var(--danger);
  font-size: 0.875rem;
}

.form-actions {
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
  font-family: inherit;
  cursor: pointer;
}

.btn-secondary-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.exchange-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.exchange-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 0.75rem 1rem;
}

.exchange-row.pending {
  opacity: 0.65;
}

.exchange-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.exchange-meta {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.pending-badge {
  color: var(--accent-purple);
  font-weight: 500;
}

.exchange-amounts {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9375rem;
  margin-right: auto;
}

.exchange-delete {
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

.exchange-delete:hover {
  background: var(--danger);
  color: white;
}
</style>
