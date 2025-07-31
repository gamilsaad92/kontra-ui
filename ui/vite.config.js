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
        theme_color: '#8B0000',
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
  optimizeDeps: {
    include: ['react', 'react-dom']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          clerk: ['@clerk/clerk-react'],
          utils: [
            '@sentry/react',
            '@supabase/supabase-js',
            'chart.js',
            'recharts',
            'clsx',
            'react-spinners'
          ]
        }
      }
    }
  }
})
