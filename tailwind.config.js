// ============================================================
// INÍCIO: tailwind.config.js
// Versão: 1.0.0 | Data: 2026-02-25
// Descrição: Design tokens do FlashDeal
//            — primary: laranja (#FF6B00) — cor principal da marca
//            — success: verde — confirmações
//            — neutral: cinzas — textos e fundos
//            — Fonte: Inter (system fallback)
//            — Animações: bounce para indicador de digitação IA
// ============================================================

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cor principal da marca FlashDeal
        primary: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#FF6B00', // ← cor principal
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Confirmações, voucher válido, sucesso
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          300: '#86efac',
          500: '#22c55e',
          700: '#15803d',
        },
        // Neutros — textos, fundos, bordas
        neutral: {
          50:  '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
      },

      fontFamily: {
        // Inter com fallbacks de sistema — zero download obrigatório
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },

      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },

      boxShadow: {
        // Sombra suave para cards no mobile
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
      },

      animation: {
        // Indicador de digitação da IA (3 pontos pulsando)
        'bounce': 'bounce 1s infinite',
      },

      // Altura da bottom navigation — usada como padding-bottom nas pages
      spacing: {
        'nav': '4.5rem', // 72px — altura da BottomNav
      },
    },
  },

  plugins: [
    // Plugin para esconder scrollbar (FiltroCategoria chips)
    // Instalar: npm install -D tailwind-scrollbar-hide
    require('tailwind-scrollbar-hide'),
  ],
};

// ============================================================
// FIM: tailwind.config.js
// ============================================================
