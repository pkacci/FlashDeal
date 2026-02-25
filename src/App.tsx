// ==========================================
// [ARQUIVO] App.tsx v1.0
// [DATA] 2026-02-25
// [REQUER] main.tsx, react-router-dom
// ==========================================

// #region IMPORTS
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import ProtectedRoute from '@/components/common/ProtectedRoute'

// Pages — Public
import Home from '@/pages/Home'
import LoginPage from '@/pages/LoginPage'
import OfertasPage from '@/pages/OfertasPage'
import OfertaDetalhesPage from '@/pages/OfertaDetalhesPage'

// Pages — Consumidor
import PagamentoPix from '@/pages/PagamentoPix'
import VoucherPage from '@/pages/VoucherPage'
import MinhasReservas from '@/pages/MinhasReservas'

// Pages — PME
import OnboardingIA from '@/pages/OnboardingIA'
import DashboardPME from '@/pages/DashboardPME'
import CriarOfertaPage from '@/pages/CriarOfertaPage'
import ValidarVoucherPage from '@/pages/ValidarVoucherPage'

// Pages — Compartilhadas
import PerfilPage from '@/pages/PerfilPage'
// #endregion IMPORTS

// #region APP
export default function App() {
  return (
    // BrowserRouter — habilita navegação por URL
    <BrowserRouter>
      {/* AuthProvider — contexto de autenticação global */}
      <AuthProvider>
        {/* ToastProvider — notificações in-app globais */}
        <ToastProvider>
          <Routes>

            {/* #region PUBLIC — sem login */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/ofertas" element={<OfertasPage />} />
            <Route path="/oferta/:id" element={<OfertaDetalhesPage />} />
            {/* #endregion PUBLIC */}

            {/* #region CONSUMIDOR — role='consumidor' */}
            <Route path="/pagamento/:id" element={
              <ProtectedRoute role="consumidor">
                <PagamentoPix />
              </ProtectedRoute>
            } />
            <Route path="/voucher/:id" element={
              <ProtectedRoute role="consumidor">
                <VoucherPage />
              </ProtectedRoute>
            } />
            <Route path="/minhas-reservas" element={
              <ProtectedRoute role="consumidor">
                <MinhasReservas />
              </ProtectedRoute>
            } />
            {/* #endregion CONSUMIDOR */}

            {/* #region PME — role='pme' */}
            <Route path="/onboarding-ia" element={
              <ProtectedRoute role="pme">
                <OnboardingIA />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute role="pme">
                <DashboardPME />
              </ProtectedRoute>
            } />
            <Route path="/criar-oferta" element={
              <ProtectedRoute role="pme">
                <CriarOfertaPage />
              </ProtectedRoute>
            } />
            <Route path="/validar-voucher" element={
              <ProtectedRoute role="pme">
                <ValidarVoucherPage />
              </ProtectedRoute>
            } />
            {/* #endregion PME */}

            {/* #region SHARED — qualquer role autenticado */}
            <Route path="/perfil" element={
              <ProtectedRoute>
                <PerfilPage />
              </ProtectedRoute>
            } />
            {/* #endregion SHARED */}

            {/* #region FALLBACK — rota não encontrada */}
            <Route path="*" element={<Navigate to="/" replace />} />
            {/* #endregion FALLBACK */}

          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
// #endregion APP
