import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue(), tailwindcss()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        // Lets any component write `@use 'core' as core;` without walking back
        // up the tree with ../../ from wherever the component happens to live.
        loadPaths: [fileURLToPath(new URL('./src/styles', import.meta.url))],
      },
    },
  },

  server: {
    port: 5173,
    proxy: {
      // Same-origin in dev, so the backend needs no CORS configuration and the
      // frontend calls the same `/api/...` paths it will call in production.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.spec.ts'],
    restoreMocks: true,
  },
})
