// ============================================================
// INÍCIO: vite.config.ts
// Versão: 1.0.0 | Data: 2026-02-25
// Descrição: Configuração do Vite para o FlashDeal PWA
//            — Base path para GitHub Pages (/FlashDeal/)
//            — PWA via vite-plugin-pwa
//            — Alias @ para src/
//            — Build otimizado para mobile
// ============================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  // Base path para Firebase Hosting (raiz) ou GitHub Pages (/FlashDeal/)
  // Troque para '/FlashDeal/' se usar GitHub Pages
  base: '/',

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'FlashDeal - Ofertas Relâmpago',
        short_name: 'FlashDeal',
        description: 'Ofertas relâmpago de PMEs perto de você.',
        theme_color: '#FF6B00',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'pt-BR',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache de assets estáticos (JS, CSS, imagens)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            // Cache de imagens do Firebase Storage
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            // Cache de tiles do OpenStreetMap (Leaflet)
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      // Alias @ aponta para src/ — permite imports limpos
      // Ex: import useAuth from '@/hooks/useAuth'
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    // Aumenta limite de warning para chunks (Leaflet é ~40KB)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Separa vendors em chunks distintos para melhor cache
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          'vendor-leaflet':  ['leaflet', 'react-leaflet'],
          'vendor-geo':      ['geofire-common'],
        },
      },
    },
  },

  server: {
    // Permite acesso via IP local no mobile (teste no celular)
    host: true,
    port: 3000,
  },
});

// ============================================================
// FIM: vite.config.ts
// ============================================================
