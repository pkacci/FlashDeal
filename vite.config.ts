// ============================================================
// INÍCIO — vite.config.ts
// Configuração do Vite para o FlashDeal
// PWA + React + Firebase Hosting
// ============================================================

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // Plugin oficial React — suporte a JSX e Fast Refresh
    react()
  ],

  // Base URL "/"  — Firebase Hosting serve da raiz
  // ⚠️ Se fosse GitHub Pages seria "/FlashDeal/"
  // Como usamos Firebase Hosting, fica "/"
  base: '/',

  build: {
    // Pasta de saída do build
    // GitHub Actions vai pegar esta pasta
    // e publicar no Firebase Hosting
    outDir: 'dist',

    // Limpa a pasta dist antes de cada build
    // Evita arquivos antigos no deploy
    emptyOutDir: true,

    // Tamanho máximo de chunk antes de avisar
    // 1000kb = aviso de bundle grande
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // Separa dependências grandes em chunks
        // Melhora performance de carregamento
        manualChunks: {
          // Firebase separado — carrega só quando necessário
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-db': ['firebase/firestore'],
          'firebase-storage': ['firebase/storage'],
          // Leaflet separado — só carrega na tela de mapa
          'map': ['leaflet', 'react-leaflet'],
        }
      }
    }
  },

  // Configuração do servidor de desenvolvimento
  // Usado apenas localmente (não afeta produção)
  server: {
    port: 3000,
    strictPort: true,
  },

  // Resolve aliases para imports mais limpos
  // Exemplo: import Button from '@/components/Button'
  // ao invés de: import Button from '../../components/Button'
  resolve: {
    alias: {
      '@': '/src',
    }
  }
})

// ============================================================
// FIM — vite.config.ts
// ============================================================
