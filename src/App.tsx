// ============================================================
// INÍCIO: src/App.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, contexts, pages, components
// Descrição: Roteamento principal do FlashDeal
//            — Providers: AuthProvider, ToastProvider
//            — Rotas públicas, PME e Consumidor
//            — ProtectedRoute guarda rotas por role
//            — BottomNav renderizada por todas as rotas internas
// ============================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// Componentes globais
import BottomNav from './components/common/BottomNav';
import ProtectedRoute from './components/common/ProtectedRoute';
import Toast from './components/common/Toast';

// Pages — públicas
import Home from './pages/Home';
import LoginPage from './pages/LoginPage';
import OfertasPage from './pages/OfertasPage';
import OfertaDetalhesPage from './pages/OfertaDetalhesPage';

// Pages — consumidor
import PagamentoPix from './pages/PagamentoPix';
import VoucherPage from './pages/VoucherPage';
import MinhasReservas from './pages/MinhasReservas';

// Pages — PME
import OnboardingIA from './pages/OnboardingIA';
import DashboardPME from './pages/DashboardPME';
import CriarOfertaPage from './pages/CriarOfertaPage';
import ValidarVoucherPage from './pages/ValidarVoucherPage';

// Pages — compartilhadas
import PerfilPage from './pages/PerfilPage';

// #region Layout wrapper — injeta BottomNav em todas as rotas internas
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative min-h-screen pb-20 bg-neutral-50">
    {children}
    <BottomNav />
    <Toast />
  </div>
);
// #endregion

// #region App
const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <Routes>

          {/* ═══════════════════════════════════════
              ROTAS PÚBLICAS (sem autenticação)
          ═══════════════════════════════════════ */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Ofertas: públicas — login só ao garantir */}
          <Route path="/ofertas" element={
            <Layout><OfertasPage /></Layout>
          } />
          <Route path="/oferta/:id" element={
            <Layout><OfertaDetalhesPage /></Layout>
          } />

          {/* ═══════════════════════════════════════
              ROTAS CONSUMIDOR (role='consumidor')
          ═══════════════════════════════════════ */}
          <Route path="/pagamento-pix/:ofertaId" element={
            <ProtectedRoute allowedRoles={['consumidor']}>
              <Layout><PagamentoPix /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/voucher/:id" element={
            <ProtectedRoute allowedRoles={['consumidor']}>
              <Layout><VoucherPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/minhas-reservas" element={
            <ProtectedRoute allowedRoles={['consumidor']}>
              <Layout><MinhasReservas /></Layout>
            </ProtectedRoute>
          } />

          {/* ═══════════════════════════════════════
              ROTAS PME (role='pme')
          ═══════════════════════════════════════ */}
          <Route path="/onboarding-ia" element={
            <ProtectedRoute allowedRoles={['pme', 'consumidor']}>
              <OnboardingIA />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['pme']}>
              <Layout><DashboardPME /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/criar-oferta" element={
            <ProtectedRoute allowedRoles={['pme']}>
              <Layout><CriarOfertaPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/validar-voucher" element={
            <ProtectedRoute allowedRoles={['pme']}>
              <Layout><ValidarVoucherPage /></Layout>
            </ProtectedRoute>
          } />

          {/* ═══════════════════════════════════════
              ROTAS COMPARTILHADAS
          ═══════════════════════════════════════ */}
          <Route path="/perfil" element={
            <ProtectedRoute allowedRoles={['pme', 'consumidor']}>
              <Layout><PerfilPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Fallback: redireciona para home */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);
// #endregion

export default App;

// ============================================================
// FIM: src/App.tsx
// ============================================================
