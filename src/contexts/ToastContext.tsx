// ============================================================
// INÍCIO: src/contexts/ToastContext.tsx
// Versão: 1.1.0 | Correção: addToast exportado no tipo
// ============================================================

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  mensagem: string;
  tipo: ToastType;
}

export interface ToastContextType {
  toasts: ToastItem[];
  addToast: (mensagem: string, tipo?: ToastType) => void; // ← adicionado
  showToast: (mensagem: string, tipo?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((mensagem: string, tipo: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, mensagem, tipo }]);
    // Remove automaticamente após 4s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // addToast é alias de showToast para compatibilidade
  const addToast = showToast;

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
};

export default ToastProvider;

// ============================================================
// FIM: src/contexts/ToastContext.tsx
// ============================================================
