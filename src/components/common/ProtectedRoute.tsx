// ============================================================
// INÍCIO: src/components/common/ProtectedRoute.tsx
// Versão: 1.1.0
// ============================================================

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('pme' | 'consumidor')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { usuario, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner fullScreen />;

  if (!usuario) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const homeByRole = role === 'pme' ? '/dashboard' : '/ofertas';
    return <Navigate to={homeByRole} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

// ============================================================
// FIM: src/components/common/ProtectedRoute.tsx
// ============================================================
