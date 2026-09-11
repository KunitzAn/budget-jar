import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    // Один обычный <script> вместо type="module" + отдельных чанков-на-роут:
    // в офлайн-PWA на iOS/Safari модульные скрипты ненадёжно перехватываются
    // service worker'ом (проверено и на Chromium — тот же провал), а с одним
    // classic-скриптом весь app-шелл кэшируется и грузится офлайн предсказуемо.
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app-[hash].js',
      },
    },
  },
})
