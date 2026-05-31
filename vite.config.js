import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
    allowedHosts: [
      'nightfall.happyplatform.io.vn',
      '.happyplatform.io.vn',
      'localhost',
    ],
  },
})
