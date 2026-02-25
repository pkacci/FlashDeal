// ==========================================
// [ARQUIVO] postcss.config.js v1.0
// [DATA] 2026-02-25
// [REQUER] package.json, tailwindcss
// ==========================================

// #region CONFIG
// PostCSS processa o Tailwind e adiciona
// prefixos de browser automaticamente
export default {
  plugins: {
    tailwindcss: {},    // Gera classes utilitárias
    autoprefixer: {},   // Adiciona -webkit-, -moz- etc
  },
}
// #endregion CONFIG
