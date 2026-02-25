// ProtectedRoute.tsx | v1.0.0 | 2025-02-25
// Deps: react-router-dom, AuthContext

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

// #region types
interface ProtectedRouteProps {
  redirectTo?: string;
}
// #endregion

// #region component
const ProtectedRoute = ({ redirectTo = '/login' }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  // Aguarda resolução do estado de autenticação
  if (loading) return <LoadingSpinner fullScreen />;

  // Redireciona se não autenticado
  if (!user) return <Navigate to={redirectTo} replace />;

  return <Outlet />;
};
// #endregion

export default ProtectedRoute;
