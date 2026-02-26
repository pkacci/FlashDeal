// ============================================================
// INÍCIO: src/contexts/ToastContext.tsx
// Versão: 1.2.0 | Correção: hideToast + type/message em ToastItem
// ============================================================

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  mensagem: string;
  message: string;   // ← alias EN para compatibilidade
  tipo: ToastType;
  type: ToastType;   // ← alias EN para compatibilidade
}

export interface ToastContextType {
  toasts: ToastItem[];
  addToast: (mensagem: string, tipo?: ToastType) => void;
  showToast: (mensagem: string, tipo?: ToastType) => void;
  hideToast: (id: string) => void;   // ← adicionado
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((mensagem: string, tipo: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    const item: ToastItem = {
      id,
      mensagem,
      message: mensagem,  // alias
      tipo,
      type: tipo,         // alias
    };
    setToasts((prev) => [...prev, item]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // aliases
  const addToast = showToast;
  const hideToast = removeToast;

  return (
    <ToastContext.Provider value={{ toasts, addToast, showToast, hideToast, removeToast }}>
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
