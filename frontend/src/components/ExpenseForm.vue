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
  border: 1px solid #E7E1D7;
  border-radius: 999px;
  font-size: 1rem;
  width: 200px;
  background: #FFFFFF;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: #C4612F;
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

.btn-primary:hover:not(:disabled) {
  background: #A94E22;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(196, 97, 47, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
