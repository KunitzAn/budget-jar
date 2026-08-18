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

      <PeriodPicker @create="handleCreate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { createPeriod } from '../api/periods'
import PeriodPicker from '../components/PeriodPicker.vue'

const router = useRouter()

const handleCreate = async (data: { startDate: string; endDate: string; totalSum: number }) => {
  try {
    await createPeriod(data)
    router.push('/')
  } catch (error: any) {
    if (error.response?.status === 400) {
      alert('Ошибка: проверьте даты и сумму')
    } else {
      alert('Не удалось создать период. Попробуйте снова.')
    }
  }
}

const goBack = () => router.push('/')
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #F7F4EF;
}

.header {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #E7E1D7;
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
  color: #1F2421;
}

.header h1 em {
  color: #C4612F;
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
  background: #F2E3D6;
  color: #C4612F;
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

h2 {
  font-family: 'Playfair Display', serif;
  font-size: 2rem;
  color: #1F2421;
  margin: 0.75rem 0 0;
  letter-spacing: -0.02em;
}

.btn-secondary {
  padding: 0.625rem 1.5rem;
  background: #FBF9F5;
  color: #1F2421;
  border: 1px solid #E7E1D7;
  border-radius: 999px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #F7F4EF;
  transform: translateY(-2px);
}
</style>
