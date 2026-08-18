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

    <button @click="handleCreate" class="btn-primary" :disabled="!isValid">
      Создать период
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  create: [data: { startDate: string; endDate: string; totalSum: number }]
}>()

const startDate = ref('')
const endDate = ref('')
const totalSum = ref<number | null>(null)

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
  color: #5C635D;
  font-size: 0.875rem;
}

.input {
  padding: 0.75rem 1.25rem;
  border: 1px solid #E7E1D7;
  border-radius: 12px;
  font-size: 1rem;
  background: #FFFFFF;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: #C4612F;
}

.btn-primary {
  padding: 0.875rem 2rem;
  background: #C4612F;
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 1rem;
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
