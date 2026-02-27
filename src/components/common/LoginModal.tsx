// ============================================================
// INÍCIO: src/components/common/LoginModal.tsx
// Versão: 1.1.0 | Correção: onSucesso adicionado às props
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface LoginModalProps {
  ofertaId: string;
  onFechar: () => void;
  onSucesso?: () => void;  // ← adicionado
}

const LoginModal: React.FC<LoginModalProps> = ({ ofertaId, onFechar, onSucesso }) => {
  const navigate = useNavigate();

  const handleLogin = () => {
    if (onSucesso) {
      // Fecha modal e chama callback direto (usuário já logado em outro fluxo)
      onSucesso();
    } else {
      navigate('/login', {
        state: { ofertaId, from: `/oferta/${ofertaId}` },
      });
    }
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
        <button onClick={handleLogin} className="btn-primary w-full mb-3">
          Entrar / Cadastrar
        </button>
        <button onClick={onFechar} className="w-full text-sm text-neutral-400 py-2">
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
