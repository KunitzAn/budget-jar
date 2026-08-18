<template>
  <div class="login-page">
    <div class="login-card">
      <h1>Budget <em>Jar</em></h1>
      <p class="subtitle">Храните деньги как камушки в банке</p>
      
      <div class="telegram-widget" id="telegram-login"></div>
      
      <p class="hint">Войдите через Telegram, чтобы начать</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loginWithTelegram } from '../api/auth'
import type { TelegramUser } from '../types'

const router = useRouter()

// Глобальный callback для Telegram
;(window as any).onTelegramAuth = async (user: TelegramUser) => {
  try {
    await loginWithTelegram(user)
    router.push('/')
  } catch (error) {
    console.error('Login failed:', error)
    alert('Ошибка входа. Попробуйте снова.')
  }
}

onMounted(() => {
  // Проверяем, есть ли уже токен
  const token = localStorage.getItem('token')
  if (token) {
    router.push('/')
    return
  }

  // Загружаем Telegram Widget
  const script = document.createElement('script')
  script.src = 'https://telegram.org/js/telegram-widget.js?22'
  script.setAttribute('data-telegram-login', 'BudgetJarKun_bot')
  script.setAttribute('data-size', 'large')
  script.setAttribute('data-onauth', 'onTelegramAuth(user)')
  script.setAttribute('data-request-access', 'write')
  script.async = true
  
  const container = document.getElementById('telegram-login')
  if (container) {
    container.appendChild(script)
  }
})
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #F7F4EF 0%, #FBF9F5 100%);
  padding: 2rem;
}

.login-card {
  background: #FFFFFF;
  border-radius: 24px;
  padding: 3rem 2.5rem;
  box-shadow: 0 10px 40px rgba(31, 36, 33, 0.08);
  text-align: center;
  max-width: 420px;
  width: 100%;
}

h1 {
  font-family: 'Playfair Display', serif;
  font-size: 3rem;
  color: #1F2421;
  margin: 0 0 0.5rem;
  letter-spacing: -0.02em;
}

h1 em {
  color: #C4612F;
  font-style: italic;
}

.subtitle {
  color: #5C635D;
  font-size: 1.125rem;
  margin: 0 0 2.5rem;
}

.telegram-widget {
  display: flex;
  justify-content: center;
  margin: 2rem 0;
  min-height: 50px;
}

.hint {
  color: #5C635D;
  font-size: 0.875rem;
  margin: 1.5rem 0 0;
}
</style>
