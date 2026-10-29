import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { checkSession, me, signedOut } from './lib/auth'
import { getSyncedUserId } from './lib/sync'
import BarView from './views/BarView.vue'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import SettingsView from './views/SettingsView.vue'
import StatsView from './views/StatsView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    tabBar?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { tabBar: true } },
    { path: '/bar/:id', name: 'bar', component: BarView, props: true },
    { path: '/stats', name: 'stats', component: StatsView, meta: { tabBar: true } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { tabBar: true } },
    { path: '/login', name: 'login', component: LoginView },
    // iOS может запустить PWA не со start_url, а, например, с /index.html —
    // без этого остался бы пустой экран
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

/**
 * Офлайн-first: если на устройстве уже есть локальная копия (был синк),
 * пускаем внутрь сразу, не дожидаясь сети — на iOS в авиарежиме запрос не
 * падает, а висит. Сессию проверяем фоном; ответит сервер 401 — watch ниже
 * уведёт на вход. Устройство без копии — ждём ответа, но не вечно.
 */
const FIRST_CHECK_TIMEOUT_MS = 6000

function toLogin(fullPath: string) {
  return { name: 'login', query: fullPath === '/' ? {} : { redirect: fullPath } }
}

function checkSessionWithTimeout() {
  return Promise.race([
    checkSession(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), FIRST_CHECK_TIMEOUT_MS)),
  ])
}

router.beforeEach(async (to) => {
  if (to.name === 'login') {
    if (me.value) return '/'
    if (signedOut.value) return true
    return (await checkSessionWithTimeout()) ? '/' : true
  }
  if (signedOut.value) return toLogin(to.fullPath)
  if (me.value) return true
  if (getSyncedUserId() !== null) {
    void checkSession()
    return true
  }
  return (await checkSessionWithTimeout()) ? true : toLogin(to.fullPath)
})

watch(signedOut, (out) => {
  if (out && router.currentRoute.value.name !== 'login') void router.replace(toLogin('/'))
})
