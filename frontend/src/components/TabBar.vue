<template>
  <nav class="tab-bar">
    <router-link to="/" class="tab-item" :class="{ active: route.path === '/' }">
      <span class="tab-label">Период</span>
    </router-link>
    <router-link to="/periods" class="tab-item" :class="{ active: isUnder('/periods') }">
      <span class="tab-label">Периоды</span>
    </router-link>
    <router-link to="/stats" class="tab-item" :class="{ active: isUnder('/stats') }">
      <span class="tab-label">Статистика</span>
    </router-link>
    <router-link to="/settings" class="tab-item" :class="{ active: isUnder('/settings') }">
      <span class="tab-label">Настройки</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const isUnder = (prefix: string) => route.path === prefix || route.path.startsWith(prefix + '/')
</script>

<style scoped>
.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  background: var(--card-bg);
  backdrop-filter: blur(16px);
  border-top: 1px solid var(--card-border);
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 0.5rem;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  transition: color 0.2s;
}

.tab-item.active {
  color: var(--accent-purple);
  font-weight: 600;
}
</style>
