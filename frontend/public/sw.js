// Сервис-воркер — только оболочка приложения. Навигации — network-first
// с фолбэком на закэшированную оболочку (актуальность важнее офлайн-доступа,
// иначе iOS может закэшировать index.html и не увидеть новые сплэш-теги при
// «Добавить на экран Домой»); статика (JS/CSS/иконки) — stale-while-revalidate.
// API живёт на отдельном домене (api-jar.kunitcan.online) и сюда не попадает.

const CACHE = 'budget-jar-shell-v1'
const SHELL_URL = '/'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(SHELL_URL, res.clone()))
          return res
        })
        .catch(() => caches.match(SHELL_URL).then((r) => r || caches.match(request))),
    )
    return
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone())
          return res
        })
        .catch(() => cached)
      return cached || fresh
    }),
  )
})
