// Иконки приложения из public/favicon.svg. sharp берём из соседнего проекта:
// он нужен один раз на генерацию, держать его в зависимостях незачем.
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const sharp = createRequire('/Users/anastasiakunickaa/Projects/fuel/')('sharp')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(__dirname, '..', 'public', 'favicon.svg')
const out = path.join(__dirname, '..', 'public')

const targets = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icons/icon-192.png', size: 192 },
  { file: 'icons/icon-512.png', size: 512 },
  { file: 'icons/icon-512-maskable.png', size: 512 },
]

for (const t of targets) {
  await sharp(src, { density: 384 }).resize(t.size, t.size).png().toFile(path.join(out, t.file))
  console.log('generated', t.file)
}
