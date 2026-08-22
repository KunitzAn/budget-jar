<template>
  <div class="expense-form">
    <input
      v-model.number="amount"
      type="number"
      placeholder="Сумма траты"
      class="input"
      @keyup.enter="handleAdd"
    />
    <button @click="handleAdd" class="btn-primary" :disabled="!amount || amount <= 0">
      Добавить трату
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  add: [amount: number]
}>()

const amount = ref<number | null>(null)

const handleAdd = () => {
  if (amount.value && amount.value > 0) {
    emit('add', amount.value)
    amount.value = null
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
