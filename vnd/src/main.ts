import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { installErrorOverlay, showError } from './lib/errorOverlay'
import { router } from './router'
import { installSyncTriggers, runSync } from './lib/sync'

installErrorOverlay()

// Safari на iOS игнорирует user-scalable=no для щипка — гасим сам жест
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
}

// Монтируем сразу, сеть — фоном: все данные есть в IndexedDB, сервер для
// показа не нужен. Ждать проверки сессии нельзя — на iOS в авиарежиме
// запрос висит, и холодный офлайн-старт застревал бы на заглушке.
const app = createApp(App)
// Ошибки рендера Vue до window.onerror не доходят — без этого сломанный
// экран был бы просто белым
app.config.errorHandler = (err) => showError('vue', err)
router.onError((err) => showError('router', err))
app.use(router).mount('#app')
installSyncTriggers()
void runSync()
