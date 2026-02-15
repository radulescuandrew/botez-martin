import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg', 'favicon.ico'],
      manifest: {
        name: 'Baptism Invitation',
        short_name: 'Baptism',
        description: 'Martin\'s baptism invitation – play the game and get the details.',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-64x64.png', type: 'image/png', sizes: '64x64', purpose: 'any' },
          { src: '/pwa-192x192.png', type: 'image/png', sizes: '192x192', purpose: 'any' },
          { src: '/pwa-512x512.png', type: 'image/png', sizes: '512x512', purpose: 'any' },
          { src: '/maskable-icon-512x512.png', type: 'image/png', sizes: '512x512', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/sprites/**', '**/kid-sprite-sheet.png', '**/*.mp3'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true
      }
    })
  ]
})
