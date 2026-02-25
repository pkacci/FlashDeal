// ==========================================
// [ARQUIVO] tailwind.config.js v1.0
// [DATA] 2026-02-25
// [REQUER] postcss.config.js
// ==========================================

/** @type {import('tailwindcss').Config} */
export default {
  // #region CONTENT
  // Tailwind varre estes arquivos para gerar só
  // as classes CSS usadas (bundle mínimo)
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  // #endregion CONTENT

  theme: {
    extend: {

      // #region COLORS — Design System FlashDeal
      colors: {
        // Laranja principal — urgência, energia, CTA
        primary: {
          50:  '#FFF3E0',
          100: '#FFE0B2',
          400: '#FFA726',
          500: '#FF6B00',  // CTA principal
          600: '#E65100',  // Hover
          700: '#BF360C',  // Pressed
        },
        // Azul escuro — confiança, fundo premium
        secondary: {
          500: '#1A1A2E',  // Fundo escuro
          600: '#16213E',  // Cards escuros
          700: '#0F3460',  // Destaques
        },
        // Verde Pix — confirmação, sucesso
        success: {
          50:  '#E8F5E9',
          500: '#00C853',  // Pix confirmado
          600: '#00A846',  // Hover
        },
        // Vermelho — erro, cancelamento
        danger: {
          50:  '#FFEBEE',
          500: '#FF3B30',
          600: '#D32F2F',
        },
        // Amarelo — atenção, timer expirando
        warning: {
          50:  '#FFFDE7',
          500: '#FFB300',
          600: '#F57F17',
        },
        // Neutros — textos, bordas, fundos
        neutral: {
          50:  '#FAFAFA',  // Fundo geral
          100: '#F5F5F5',  // Cards
          200: '#EEEEEE',  // Divisores
          300: '#E0E0E0',  // Bordas
          500: '#9E9E9E',  // Texto secundário
          700: '#616161',  // Texto médio
          900: '#212121',  // Texto principal
        },
      },
      // #endregion COLORS

      // #region TYPOGRAPHY
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'], // Fonte principal
      },
      fontSize: {
        'xs':   ['12px', { lineHeight: '16px' }],
        'sm':   ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg':   ['18px', { lineHeight: '28px' }],
        'xl':   ['20px', { lineHeight: '28px' }],
        '2xl':  ['24px', { lineHeight: '32px' }],
        '3xl':  ['30px', { lineHeight: '36px' }],
        '4xl':  ['36px', { lineHeight: '40px' }],
      },
      fontWeight: {
        normal:   '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
        extrabold:'800',
      },
      // #endregion TYPOGRAPHY

      // #region SPACING — Sistema 4px
      spacing: {
        '0.5': '2px',
        '1':   '4px',
        '2':   '8px',
        '3':   '12px',
        '4':   '16px',
        '5':   '20px',
        '6':   '24px',
        '8':   '32px',
        '10':  '40px',
        '12':  '48px',
        '16':  '64px',
        '20':  '80px',
      },
      // #endregion SPACING

      // #region RADIUS — Bordas arredondadas modernas
      borderRadius: {
        'sm':  '6px',
        'md':  '12px',   // Cards padrão
        'lg':  '16px',   // Cards grandes
        'xl':  '20px',   // Modais
        '2xl': '24px',   // Botões CTA
        'full':'9999px', // Pills, badges
      },
      // #endregion RADIUS

      // #region SHADOWS — Elevação suave
      boxShadow: {
        'sm':  '0 1px 3px rgba(0,0,0,0.08)',
        'md':  '0 4px 12px rgba(0,0,0,0.10)',  // Cards
        'lg':  '0 8px 24px rgba(0,0,0,0.12)',  // Modais
        'xl':  '0 16px 40px rgba(0,0,0,0.16)', // Bottom sheets
        // Sombra laranja — botão CTA principal
        'primary': '0 4px 16px rgba(255,107,0,0.35)',
        // Sombra verde — confirmação Pix
        'success': '0 4px 16px rgba(0,200,83,0.30)',
      },
      // #endregion SHADOWS

      // #region ANIMATION — Micro-interações
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4,0,0.6,1) infinite', // Timer urgente
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',                        // Bottom sheet
        'bounce-in':  'bounceIn 0.4s ease-out',                       // Voucher confirmado
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '60%':  { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
      },
      // #endregion ANIMATION

    },
  },
  plugins: [],
}
