<template>
  <div id="app" :class="{ 'has-tabbar': showTabBar }">
    <div v-if="!isOnline" class="offline-banner">
      Офлайн — изменения синхронизируются при подключении
    </div>
    <router-view />
    <TabBar v-if="showTabBar" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useOnlineStatus } from './composables/useOnlineStatus'
import { flushQueue } from './lib/offlineQueue'
import TabBar from './components/TabBar.vue'

const route = useRoute()
const { isOnline } = useOnlineStatus()

const showTabBar = computed(() => !route.meta.hideTabBar)

const syncAndNotify = async () => {
  await flushQueue()
  // страницы, уже открытые в момент синка, сами не узнают о новых серверных
  // id/данных — просим их перечитать текущие данные
  window.dispatchEvent(new Event('offline-sync-complete'))
}

onMounted(() => {
  syncAndNotify()
  window.addEventListener('online', syncAndNotify)
})
</script>

<style>
body {
  margin: 0;
  font-family: Inter, system-ui, sans-serif;
  background: #f5f5f5;
}

#app {
  min-height: 100vh;
}

#app.has-tabbar {
  padding-bottom: calc(4rem + env(safe-area-inset-bottom));
}

.offline-banner {
  position: sticky;
  top: 0;
  z-index: 30;
  background: #ffb020;
  color: #1a1a1a;
  text-align: center;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.4rem 1rem;
}
</style>
