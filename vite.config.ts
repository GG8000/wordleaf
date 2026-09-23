import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Service worker so installed apps pick up new deployments (see src/components/UpdateBanner.tsx)
    VitePWA({
      registerType: 'prompt',
      manifest: false, // we ship our own public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Push notifications for duels (public/push-sw.js)
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
