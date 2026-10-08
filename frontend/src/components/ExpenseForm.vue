<template>
  <div class="expense-form">
    <input
      v-model.number="amount"
      type="number"
      placeholder="Сумма траты"
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Category } from '../types'

defineProps<{ categories: Category[] }>()

const emit = defineEmits<{
  add: [amount: number, date: string, categoryId: number | null]
}>()

const today = new Date().toISOString().slice(0, 10)

const amount = ref<number | null>(null)
const date = ref(today)
// категорию не сбрасываем после добавления — подряд обычно вносят траты одного вида
const categoryId = ref<number | null>(null)

const handleAdd = () => {
  if (amount.value && amount.value > 0) {
    emit('add', amount.value, date.value, categoryId.value)
    amount.value = null
    date.value = today
  }
}
</script>

<style scoped>
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
