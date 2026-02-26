/* --- PATH: src/components/common/ProtectedRoute.tsx --- */
// Versão: 1.2.0 | Alteração: Liberação de rota neutra para Onboarding
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredRole?: 'pme' | 'consumidor';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // REGRA DE EXCEÇÃO: A rota de onboarding deve ser acessível para QUALQUER usuário logado
  // mesmo que ele ainda não tenha a claim de 'pme'.
  if (location.pathname === '/onboarding-ia') {
    return children;
  }

  if (requiredRole && role !== requiredRole) {
    const fallback = role === 'pme' ? '/dashboard' : '/ofertas';
    return <Navigate to={fallback} replace />;
  }

  return children;
};
// FUNÇÕES PRESENTES: ProtectedRoute

/* --- PATH: src/pages/OnboardingIA.tsx --- */
// Versão: 1.1.0 | Alteração: Garantia de renderização inicial (Chat/Form)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const OnboardingIA: React.FC = () => {
  const { usuario } = useAuth();
  const [modo, setModo] = useState<'chat' | 'form' | 'loading'>('loading');
  
  useEffect(() => {
    // Força a exibição do modo Chat após 1s de inicialização
    const timer = setTimeout(() => {
      setModo('chat');
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (modo === 'loading') {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <div className="mb-4 h-12 w-12 animate-pulse rounded-full bg-orange-200"></div>
        <p className="text-gray-500 animate-pulse">Preparando seu assistente...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-orange-600">FlashDeal PME</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4">
        {modo === 'chat' ? (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-orange-100">
              <p className="text-gray-800">🤖 Olá, <strong>{usuario?.displayName?.split(' ')[0]}</strong>! Vamos cadastrar seu negócio?</p>
            </div>
            {/* Aqui entra seu componente de Chat ou a lista de mensagens */}
            <div className="animate-bounce inline-block bg-gray-200 px-3 py-1 rounded-full text-xs text-gray-500">
              Digitando...
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-lg font-bold mb-4">Cadastro Manual</h2>
            {/* Aqui entra seu formulário de fallback */}
          </div>
        )}
      </main>

      <footer className="p-4 bg-white border-t">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Digite aqui..." 
            className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button className="bg-orange-600 text-white p-2 rounded-full w-10 h-10 flex items-center justify-center">
            ➤
          </button>
        </div>
      </footer>
    </div>
  );
};

export default OnboardingIA;
// FUNÇÕES PRESENTES: OnboardingIA
