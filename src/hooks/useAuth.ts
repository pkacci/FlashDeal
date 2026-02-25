// ============================================================
// INÍCIO: src/hooks/useAuth.ts
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, AuthContext
// Descrição: Hook de conveniência que expõe o AuthContext
//            — Lança erro claro se usado fora do AuthProvider
//            — Ponto único de acesso à autenticação no app
// ============================================================

import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../contexts/AuthContext';

const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);

  // Garante uso correto — falha rápido em desenvolvimento
  if (!ctx) {
    throw new Error(
      'useAuth deve ser usado dentro de <AuthProvider>. ' +
      'Verifique se AuthProvider envolve o componente que chama useAuth.'
    );
  }

  return ctx;
};

export default useAuth;

// ============================================================
// FIM: src/hooks/useAuth.ts
// ============================================================
