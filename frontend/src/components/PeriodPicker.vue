<template>
  <div class="period-picker">
    <div class="form-group">
      <label>Начало периода</label>
      <input v-model="startDate" type="date" class="input" />
    </div>

    <div class="form-group">
      <label>Конец периода</label>
      <input v-model="endDate" type="date" class="input" />
    </div>

    <div class="form-group">
      <label>Общая сумма на период</label>
      <input v-model.number="totalSum" type="number" placeholder="50000" class="input" />
    </div>

    <p v-if="error" class="error-message">{{ error }}</p>

    <button @click="handleCreate" class="btn-primary" :disabled="!isValid">
      Создать период
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  error?: string
}>()

const emit = defineEmits<{
  create: [data: { startDate: string; endDate: string; totalSum: number }]
  'clear-error': []
}>()

const startDate = ref('')
const endDate = ref('')
const totalSum = ref<number | null>(null)

watch([startDate, endDate, totalSum], () => {
  if (props.error) emit('clear-error')
})

const isValid = computed(() => {
  return startDate.value && endDate.value && totalSum.value && totalSum.value > 0
})

const handleCreate = () => {
  if (isValid.value) {
    emit('create', {
      startDate: startDate.value,
      endDate: endDate.value,
      totalSum: totalSum.value!,
    })
  }
}
</script>

<style scoped>
.period-picker {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 400px;
  margin: 0 auto;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 0.875rem;
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

.btn-primary {
  padding: 0.875rem 2rem;
  background: var(--gradient-rainbow);
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 1rem;
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

.error-message {
  color: var(--danger);
  font-size: 0.875rem;
  margin: -0.5rem 0 0;
}
</style>
