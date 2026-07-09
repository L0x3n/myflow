import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// DEPLOY_BASE sätts av deploy.ps1 (GitHub Pages serverar under /myflow/).
export default defineConfig({
  base: process.env.DEPLOY_BASE ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      manifest: {
        name: 'MyFlow',
        short_name: 'MyFlow',
        description: 'En andra hjärna som gör dagen lättare.',
        lang: 'sv',
        display: 'standalone',
        background_color: '#faf6ef',
        theme_color: '#faf6ef',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 5212, strictPort: true },
  preview: { port: 4213, strictPort: true },
})
