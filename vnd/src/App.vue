<script setup lang="ts">
import { watchEffect } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import TabBar from './components/TabBar.vue'

const route = useRoute()

// Фирменного акцента нет (см. style.css): `--accent` — цвет текущего
// раздела, им красятся кнопки и активные элементы внутри него.
const SECTION_COLOR: Record<string, string> = {
  stats: 'var(--rub)',
  settings: 'var(--exchange)',
}
watchEffect(() => {
  document.documentElement.style.setProperty('--accent', SECTION_COLOR[String(route.name)] ?? 'var(--vnd)')
})
</script>

<template>
  <RouterView />
  <TabBar v-if="route.meta.tabBar" />
</template>
