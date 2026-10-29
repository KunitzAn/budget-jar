import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    // `npm run dev:api` поднимает Functions отдельно (wrangler pages dev,
    // порт 8790) — без прокси фронтенд не видит /api/*
    proxy: {
      '/api': 'http://localhost:8790',
    },
  },
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // Иконки манифеста системе нужны только при «На экран Домой» — это и
      // так онлайн. В офлайн-копии они раздували её в разы, а SW начинает
      // отдавать страницы из кэша, только скачав всё целиком: на телефоне
      // установка не успевала до закрытия приложения, и офлайн-запуск шёл
      // в сеть с белым экраном.
      includeManifestIcons: false,
      manifest: {
        name: 'Донги',
        short_name: 'Донги',
        description: 'Переводы рублей в донги и траты по шкалам',
        start_url: '/',
        display: 'standalone',
        background_color: '#f4f2f8',
        theme_color: '#f4f2f8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // /api/* — живые данные, отдавать на них index.html из кэша нельзя
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['icons/**'],
      },
    }),
  ],
})
