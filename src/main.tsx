// ==========================================
// [ARQUIVO] main.tsx v1.0
// [DATA] 2026-02-25
// [REQUER] index.html, App.tsx
// ==========================================

// #region IMPORTS
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'  // Design System global
// #endregion IMPORTS

// #region MOUNT
// Monta o app React no div#root do index.html
// StrictMode ativa verificações extras em desenvolvimento
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
// #endregion MOUNT
