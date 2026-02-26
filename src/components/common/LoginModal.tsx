// ============================================================
// INÍCIO: src/components/common/LoginModal.tsx
// Versão: 1.0.0 | Criado: componente faltante
// Descrição: Modal de login tardio (Late Auth)
//            Aparece quando consumidor tenta garantir oferta sem login
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';

interface LoginModalProps {
  ofertaId: string;
  onFechar: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ ofertaId, onFechar }) => {
  const navigate = useNavigate();

  const handleLogin = () => {
    // Salva ofertaId para retornar após login
    navigate('/login', { state: { ofertaId, from: `/oferta/${ofertaId}` } });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-neutral-800 mb-2">
          Entre para garantir
        </h3>
        <p className="text-sm text-neutral-500 mb-6">
          Faça login para garantir esta oferta com Pix.
        </p>
        <button
          onClick={handleLogin}
          className="btn-primary w-full mb-3"
        >
          Entrar / Cadastrar
        </button>
        <button
          onClick={onFechar}
          className="w-full text-sm text-neutral-400 py-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

export default LoginModal;

// ============================================================
// FIM: src/components/common/LoginModal.tsx
// ============================================================
