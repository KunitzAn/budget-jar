// Генерирует PNG-иконки приложения из scripts/icon-source.jpg.
// Исходник уже нарисован с отступом от краёв (safe zone для maskable-иконок),
// поэтому один и тот же файл годится и для обычных, и для maskable-иконок.
// Запуск: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(__dirname, 'icon-source.jpg')
const outDir = path.join(__dirname, '..', 'public', 'icons')

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-16.png', size: 16 },
]

for (const t of targets) {
  await sharp(src)
    .resize(t.size, t.size)
    .png()
    .toFile(path.join(outDir, t.file))
  console.log('generated', t.file)
}
