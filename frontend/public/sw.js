// Service worker: при установке скачивает ВЕСЬ комплект файлов текущей
// сборки разом (по dist/sw-manifest.json, генерируется при билде) — поэтому
// офлайн работают все страницы, а не только те, что реально открывали.
// Навигации при наличии сети всё равно идут network-first (чтобы iOS при
// «Добавить на экран Домой» видел свежий index.html со сплэш-тегами);
// офлайн-фолбэк — из закэшированного комплекта. Кэш версионирован по
// содержимому билда: activate чистит всё, что не относится к текущей версии.
// API живёт на отдельном домене (api-jar.kunitcan.online) и сюда не попадает.

const CACHE_PREFIX = 'budget-jar-shell-'
const SHELL_URL = '/'

const manifestPromise = fetch('/sw-manifest.json')
  .then((res) => (res.ok ? res.json() : null))
  .catch(() => null)

async function currentCache() {
  const manifest = await manifestPromise
  return manifest ? caches.open(CACHE_PREFIX + manifest.version) : null
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    manifestPromise.then(async (manifest) => {
      if (!manifest) return
      const cache = await caches.open(CACHE_PREFIX + manifest.version)
      await cache.addAll(manifest.files)
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    manifestPromise.then(async (manifest) => {
      const keep = manifest ? CACHE_PREFIX + manifest.version : null
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== keep).map((k) => caches.delete(k)))
      await self.clients.claim()
    }),
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
        .then(async (res) => {
          const cache = await currentCache()
          if (cache) cache.put(SHELL_URL, res.clone())
          return res
        })
        .catch(() => caches.match(SHELL_URL).then((r) => r || caches.match(request))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then(async (res) => {
          if (res.ok) {
            const cache = await currentCache()
            if (cache) cache.put(request, res.clone())
          }
          return res
        })
        .catch(() => cached)
      return cached || fresh
    }),
  )
})
