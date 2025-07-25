import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Kontra',
        short_name: 'Kontra',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1e40af',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    sourcemap: true, // ✅ enable source maps to trace real file
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('react-router-dom')
            ) {
              return 'react'
            }

            if (
              id.includes('@shadcn/ui') ||
              id.includes('class-variance-authority') ||
              id.includes('tailwind-merge') ||
              id.includes('lucide-react')
            ) {
              return 'shadcn'
            }

            if (
              id.includes('@heroicons') ||
              id.includes('@sentry') ||
              id.includes('@supabase') ||
              id.includes('chart.js') ||
              id.includes('recharts') ||
              id.includes('clsx') ||
              id.includes('react-spinners') ||
              id.includes('react-context') ||
              id.includes('morgan')
            ) {
              return 'vendors'
            }

            return 'vendor'
          }
        }
      }
    }
  }
})
