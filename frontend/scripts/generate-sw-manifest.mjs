// Генерирует dist/sw-manifest.json — полный список файлов текущей сборки
// с версией (хэш от содержимого). service worker (public/sw.js) при install
// скачивает ВСЕ эти файлы разом — не только то, что реально открывали, —
// поэтому офлайн работают все страницы, а не только уже посещённые.
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

// Vite всегда помечает собранный entry-скрипт как type="module" в HTML, даже
// когда build.rollupOptions.output.format настроен на 'iife' (сам JS-файл при
// этом реально обычный classic-script, без import/export). Модульные скрипты
// ненадёжно перехватываются service worker'ом офлайн (проверено — воспроизвели
// и на Chromium), поэтому убираем эти атрибуты у собранного тега вручную.
// Тег остаётся в <head> (так его туда кладёт Vite) — раньше это было ок, т.к.
// type="module" всегда отложенный; для обычного скрипта там же нужен defer,
// иначе он выполнится ДО парсинга <body> и не найдёт #app для mount().
const indexPath = path.join(distDir, 'index.html')
let html = fs.readFileSync(indexPath, 'utf8')
html = html.replace(
  /<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"><\/script>/,
  '<script defer src="$1"></script>',
)
fs.writeFileSync(indexPath, html)

function walk(dir, base = '') {
  let files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name)
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files = files.concat(walk(full, rel))
    } else {
      files.push(rel)
    }
  }
  return files
}

const EXCLUDE = new Set(['sw.js', 'sw-manifest.json'])
const files = walk(distDir).filter(
  (f) => !EXCLUDE.has(f) && !f.endsWith('.map') && !path.basename(f).startsWith('.'),
)

const hash = crypto.createHash('sha256')
for (const f of [...files].sort()) {
  const stat = fs.statSync(path.join(distDir, f))
  hash.update(f + ':' + stat.size + ';')
}
const version = hash.digest('hex').slice(0, 12)

const urls = files.map((f) => '/' + f.split(path.sep).join('/'))
// '/' (root) отдельно от '/index.html' — по этому ключу ищет фолбэк навигации в sw.js
if (urls.includes('/index.html') && !urls.includes('/')) urls.push('/')

const manifest = { version, files: urls }
fs.writeFileSync(path.join(distDir, 'sw-manifest.json'), JSON.stringify(manifest))
console.log(`sw-manifest.json: ${urls.length} файлов, версия ${version}`)
