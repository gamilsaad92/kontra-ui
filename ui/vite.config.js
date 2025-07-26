@@ -13,63 +13,59 @@ export default defineConfig({
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const reactPkgs = ['react', 'react-dom', 'react-router-dom']
            const clerkPkgs = ['@clerk']
            const shadcnPkgs = [
              '@shadcn/ui',
              'class-variance-authority',
              'tailwind-merge',
              'lucide-react'
            ]
            const utilPkgs = [
              '@heroicons',
              '@sentry',
              '@supabase',
              'chart.js',
              'recharts',
              'clsx',
              'react-spinners',
              'react-context',
              'morgan'
            ]

            if (reactPkgs.some((pkg) => id.includes(pkg))) {
              return 'react'
            }
            if (clerkPkgs.some((pkg) => id.includes(pkg))) {
              return 'clerk'
            }
            if (shadcnPkgs.some((pkg) => id.includes(pkg))) {
              return 'shadcn'
            }
            if (utilPkgs.some((pkg) => id.includes(pkg))) {
              return 'utils'
            }
            return 'vendor'
          }
        }
      }
    }
  }
})
