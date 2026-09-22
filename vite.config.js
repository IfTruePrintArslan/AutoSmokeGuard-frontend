import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vector')) {
            return 'charts'
          }
          if (id.includes('node_modules/react') && (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/'))) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/@reduxjs/toolkit') || id.includes('node_modules/react-redux')) {
            return 'state'
          }
          if (id.includes('node_modules/@radix-ui/')) {
            return 'radix'
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    // Node 25 ships an experimental global `localStorage` (Web Storage API)
    // that shadows jsdom's own implementation and lacks methods like
    // `.clear()`. Disable it in test workers so jsdom's localStorage wins.
    execArgv: ['--no-experimental-webstorage'],
  },
})
