// ============================================================
// INÍCIO: src/pages/ValidarVoucherPage.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, components/pme/QRScanner
// Descrição: Wrapper page para a tela de validação de voucher da PME
//            — Passa callbacks de validação para QRScanner
//            — QRScanner já tem lógica completa (Grupo 6)
//            — Protegida por ProtectedRoute (role='pme')
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import QRScanner from '../components/pme/QRScanner';

// #region Component
const ValidarVoucherPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-neutral-100">
        <button onClick={() => navigate('/dashboard')} className="text-neutral-500 text-sm">←</button>
        <p className="font-semibold text-neutral-800">Validar Voucher</p>
      </header>
      <QRScanner />
    </div>
  );
};
// #endregion

export default ValidarVoucherPage;

// ============================================================
// FIM: src/pages/ValidarVoucherPage.tsx
// ============================================================
