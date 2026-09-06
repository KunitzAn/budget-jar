// Генерирует сплэш-скрины для apple-touch-startup-image (iOS PWA cold launch)
// и печатает готовые <link> теги для index.html.
// Запуск: node scripts/generate-splash.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const markSvg = path.join(__dirname, 'splash-mark.svg')
const outDir = path.join(__dirname, '..', 'public', 'splash')

const BG = '#f5f5f7' // = manifest.background_color

// device-width x device-height (CSS px, portrait) + DPR — покрывает актуальные iPhone.
const devices = [
  { name: 'iphone-440x956-3x', width: 440, height: 956, dpr: 3 }, // 16 Pro Max
  { name: 'iphone-430x932-3x', width: 430, height: 932, dpr: 3 }, // 15/16 Plus, Pro Max (15 Pro Max и т.п.)
  { name: 'iphone-402x874-3x', width: 402, height: 874, dpr: 3 }, // 16 Pro
  { name: 'iphone-393x852-3x', width: 393, height: 852, dpr: 3 }, // 15/16, 15 Pro
  { name: 'iphone-428x926-3x', width: 428, height: 926, dpr: 3 }, // 12/13/14 Pro Max, 14 Plus
  { name: 'iphone-390x844-3x', width: 390, height: 844, dpr: 3 }, // 12/13/14, 12/13 Pro
  { name: 'iphone-375x812-3x', width: 375, height: 812, dpr: 3 }, // X/XS/11 Pro/12/13 mini
  { name: 'iphone-414x896-3x', width: 414, height: 896, dpr: 3 }, // XS Max/11 Pro Max
  { name: 'iphone-414x896-2x', width: 414, height: 896, dpr: 2 }, // XR/11
  { name: 'iphone-414x736-3x', width: 414, height: 736, dpr: 3 }, // 6s/7/8 Plus
  { name: 'iphone-375x667-2x', width: 375, height: 667, dpr: 2 }, // SE2/SE3/6s/7/8
]

const markPx = 220 // размер марки на сплэше в CSS px

const markBuffer = await sharp(markSvg, { density: 384 }).resize(markPx * 3, markPx * 3).png().toBuffer()

const linkTags = []

for (const d of devices) {
  const w = d.width * d.dpr
  const h = d.height * d.dpr
  const markSize = Math.round(markPx * d.dpr)
  const mark = await sharp(markBuffer).resize(markSize, markSize).toBuffer()

  await sharp({
    create: { width: w, height: h, channels: 4, background: BG },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, `${d.name}.png`))

  console.log('generated', `${d.name}.png`, `${w}x${h}`)

  linkTags.push(
    `<link rel="apple-touch-startup-image" href="/splash/${d.name}.png" media="screen and (device-width: ${d.width}px) and (device-height: ${d.height}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait)">`
  )
}

console.log('\n--- вставить в index.html ---\n')
console.log(linkTags.join('\n'))
