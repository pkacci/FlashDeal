// ============================================================
// INÍCIO: src/main.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, ReactDOM, App
// Descrição: Entry point da aplicação
//            — Importa Tailwind CSS global
//            — Importa Leaflet CSS (obrigatório para mapa renderizar)
//            — Monta React no #root com StrictMode
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Estilos globais
import './index.css';

// ⚠️ CRÍTICO: Leaflet CSS deve ser importado aqui (não dentro do componente)
// Sem este import, o mapa renderiza sem tiles e pins ficam desposicionados
import 'leaflet/dist/leaflet.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ============================================================
// FIM: src/main.tsx
// ============================================================
