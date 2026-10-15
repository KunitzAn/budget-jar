<template>
  <div class="expense-form-wrap">
    <div v-if="currencies.length > 1" class="currency-toggle">
      <button
        v-for="code in currencies"
        :key="code"
        type="button"
        class="currency-btn"
        :class="{ active: currency === code }"
        @click="currency = code"
      >
        {{ currencySymbol(code) }}
      </button>
    </div>

    <div class="expense-form">
      <input
        v-model.number="amount"
        type="number"
        :placeholder="`Сумма траты, ${currencySymbol(currency)}`"
        class="input"
        @keyup.enter="handleAdd"
      />
      <input
        v-model="date"
        type="date"
        class="input input-date"
        :max="today"
      />
      <select v-if="categories.length > 0" v-model="categoryId" class="input input-category">
        <option :value="null">Без категории</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <button @click="handleAdd" class="btn-primary" :disabled="!amount || amount <= 0">
        Добавить трату
      </button>
    </div>

    <p v-if="preview" class="preview">{{ preview }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BASE_CURRENCY, convertExpenses, currencySymbol } from '../lib/currency'
import { formatCurrency, formatDate } from '../lib/periodMath'
import type { Category, Exchange, Expense } from '../types'

const props = defineProps<{
  categories: Category[]
  exchanges: Exchange[]
  // все траты из всех периодов — нужны, чтобы прикинуть курс по FIFO
  allExpenses: Expense[]
}>()

const emit = defineEmits<{
  add: [amount: number, date: string, categoryId: number | null, currency: string]
}>()

const today = new Date().toISOString().slice(0, 10)

const amount = ref<number | null>(null)
const date = ref(today)
// категорию не сбрасываем после добавления — подряд обычно вносят траты одного вида
const categoryId = ref<number | null>(null)
const currency = ref(BASE_CURRENCY)

// в какие валюты вы меняли деньги — только из них есть смысл выбирать
const currencies = computed(() => {
  const foreign = new Set(props.exchanges.map((x) => x.toCurrency))
  return [BASE_CURRENCY, ...[...foreign].filter((c) => c !== BASE_CURRENCY)]
})

/**
 * Во что обойдётся эта трата в рублях: прогоняем FIFO на истории вместе с
 * черновиком, поэтому подсказка верна и когда трата разрезается между двумя
 * обменами с разными курсами.
 */
const preview = computed(() => {
  if (currency.value === BASE_CURRENCY) return ''
  if (!amount.value || amount.value <= 0) return ''

  const draft: Expense = {
    id: 'draft',
    periodId: 0,
    amount: amount.value,
    date: date.value,
    currency: currency.value,
  }
  const result = convertExpenses(props.exchanges, [...props.allExpenses, draft])
  const rub = result.rubByExpense.get('draft') ?? 0
  const chunks = result.chunksByExpense.get('draft') ?? []

  if (chunks.some((c) => c.exchangeId === null)) {
    return `≈ ${formatCurrency(rub)} — обменянных ${currencySymbol(currency.value)} не хватает, добавьте обмен`
  }

  const dates = [...new Set(chunks.map((c) => c.exchangeDate).filter(Boolean) as string[])]
  const by = dates.length > 1
    ? `по курсам обменов от ${dates.map((d) => formatDate(d)).join(' и ')}`
    : dates.length === 1
      ? `по курсу обмена от ${formatDate(dates[0])}`
      : ''
  return `≈ ${formatCurrency(rub)} ${by}`.trim()
})

const handleAdd = () => {
  if (amount.value && amount.value > 0) {
    emit('add', amount.value, date.value, categoryId.value, currency.value)
    amount.value = null
    date.value = today
  }
}
</script>

<style scoped>
.expense-form-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.currency-toggle {
  display: flex;
  gap: 0.25rem;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  padding: 0.25rem;
}

.currency-btn {
  min-width: 2.75rem;
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}

.currency-btn.active {
  background: var(--gradient-rainbow-soft);
  color: var(--accent-purple);
}

.preview {
  margin: 0;
  font-size: 0.875rem;
  color: var(--accent-purple);
  font-weight: 500;
  text-align: center;
}

.expense-form {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.input {
  padding: 0.75rem 1.25rem;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  font-size: 1rem;
  width: 200px;
  background: rgba(255, 255, 255, 0.85);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px rgba(155, 107, 255, 0.15);
}

.input-date {
  width: 170px;
}

.input-category {
  width: 180px;
  appearance: none;
  cursor: pointer;
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
</style>
