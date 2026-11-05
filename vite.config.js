/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Version affichée dans les paramètres de l'appli (champ "version" de package.json)
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

const base = process.env.NODE_ENV === 'production' ? '/chord-finder-midi/' : '/'

export default defineConfig({
  base,
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  build: {
    // VexFlow et sa police musicale (~720 Ko) : un morceau à part, chargé à la
    // demande pour la portée de la carte d'accord (précaché par le service worker)
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      // L'appli (JS, CSS, HTML, icônes) est déjà précachée par le service worker.
      // Les polices Google viennent d'un autre site : mises en cache à la première
      // ouverture, pour garder le même affichage hors ligne.
      workbox: {
        // Les échantillons de piano (public/piano/*.mp3, ~900 Ko) sont précachés
        // avec l'appli : le son marche hors ligne dès la première visite.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,mp3}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'InstantChordBT',
        short_name: 'InstantChordBT',
        description: 'Find the chords you play on your MIDI keyboard (Bluetooth or cable).',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})
