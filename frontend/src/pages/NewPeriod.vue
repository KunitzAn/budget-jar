<template>
  <div class="page">
    <header class="header">
      <h1>Budget <em>Jar</em></h1>
      <button @click="goBack" class="btn-secondary">← Назад</button>
    </header>

    <div class="content">
      <div class="page-title">
        <span class="pill">Новый период</span>
        <h2>Создайте новый бюджетный период</h2>
      </div>

      <PeriodPicker @create="handleCreate" :error="errorMessage" @clear-error="errorMessage = ''" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createPeriod } from '../api/periods'
import PeriodPicker from '../components/PeriodPicker.vue'

const router = useRouter()
const errorMessage = ref('')

const handleCreate = async (data: { startDate: string; endDate: string; totalSum: number }) => {
  errorMessage.value = ''
  try {
    const { data: created } = await createPeriod(data)
    router.push(`/periods/${created.id}`)
  } catch (error: any) {
    if (error.response?.status === 409) {
      errorMessage.value = 'Период с такими датами уже существует. Выберите другие даты.'
    } else if (error.response?.status === 400) {
      errorMessage.value = 'Ошибка: проверьте даты и сумму'
    } else {
      errorMessage.value = 'Не удалось создать период. Попробуйте снова.'
    }
  }
}

const goBack = () => router.push('/')
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
}

.page-title {
  text-align: center;
  margin-bottom: 3rem;
}

.pill {
  display: inline-block;
  background: var(--gradient-rainbow-soft);
  color: var(--accent-purple);
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

h2 {
  font-family: 'Playfair Display', serif;
  font-size: 2rem;
  color: var(--text-primary);
  margin: 0.75rem 0 0;
  letter-spacing: -0.02em;
}

.btn-secondary {
  padding: 0.625rem 1.5rem;
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #ffffff;
  transform: translateY(-2px);
}
</style>
