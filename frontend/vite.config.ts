import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-16.png', 'icons/favicon-32.png'],
      manifest: {
        name: 'Budget Jar',
        short_name: 'Budget Jar',
        description: 'Ведение бюджета по периодам — деньги как камушки в банке',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f5f5f7',
        theme_color: '#9b6bff',
        lang: 'ru',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA: при навигации из кэша (офлайн/повторный запуск) отдаём index.html,
        // дальше маршрутизацией занимается vue-router
        navigateFallback: '/index.html',
      },
    }),
  ],
})
