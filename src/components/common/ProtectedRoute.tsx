// ==========================================
// [ARQUIVO] ProtectedRoute.tsx v1.1
// [DATA] 2026-02-25
// [REQUER] AuthContext.tsx, react-router-dom
// ==========================================

// #region IMPORTS
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types/consumidor'
// #endregion IMPORTS

// #region TYPES
interface ProtectedRouteProps {
  children: React.ReactNode
  role?: UserRole  // Omitido = apenas autenticação
}
// #endregion TYPES

// #region COMPONENT
export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user } = useAuth()
  const location = useLocation()

  // Não autenticado → login, preserva URL atual
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Role incorreto → home
  if (role && user.role !== role) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
// #endregion COMPONENT
