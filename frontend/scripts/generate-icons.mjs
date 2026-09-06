// Генерирует PNG-иконки приложения из scripts/icon-source.svg.
// Запуск: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(__dirname, 'icon-source.svg')
const srcMaskable = path.join(__dirname, 'icon-source-maskable.svg')
const outDir = path.join(__dirname, '..', 'public', 'icons')

const targets = [
  { src, file: 'icon-192.png', size: 192 },
  { src, file: 'icon-512.png', size: 512 },
  { src: srcMaskable, file: 'icon-maskable-512.png', size: 512 },
  { src, file: 'apple-touch-icon.png', size: 180 },
  { src, file: 'favicon-32.png', size: 32 },
  { src, file: 'favicon-16.png', size: 16 },
]

for (const t of targets) {
  await sharp(t.src, { density: 384 })
    .resize(t.size, t.size)
    .png()
    .toFile(path.join(outDir, t.file))
  console.log('generated', t.file)
}
