// ==========================================
// [ARQUIVO] ToastContext.tsx v1.0
// [DATA] 2026-02-25
// [REQUER] index.css (classes badge/animação)
// ==========================================

// #region IMPORTS
import { createContext, useContext, useState, useCallback } from 'react'
// #endregion IMPORTS

// #region TYPES
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number    // ms — padrão 3000
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType, duration?: number) => void
  hideToast: (id: string) => void
}
// #endregion TYPES

// #region CONTEXT
const ToastContext = createContext<ToastContextType | null>(null)
// #endregion CONTEXT

// #region PROVIDER
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  // #region SHOW
  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    duration: number = 3000
  ) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type, duration }])

    // Remove automaticamente após duration
    setTimeout(() => hideToast(id), duration)
  }, [])
  // #endregion SHOW

  // #region HIDE
  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])
  // #endregion HIDE

  // #region RENDER TOASTS
  const toastColors: Record<ToastType, string> = {
    success: 'bg-success-500 text-white',
    error:   'bg-danger-500 text-white',
    warning: 'bg-warning-500 text-white',
    info:    'bg-secondary-500 text-white',
  }

  const toastIcons: Record<ToastType, string> = {
    success: '✅',
    error:   '❌',
    warning: '⚠️',
    info:    'ℹ️',
  }
  // #endregion RENDER TOASTS

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}

      {/* #region TOAST UI — fixo no topo */}
      <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              ${toastColors[toast.type]}
              rounded-lg px-4 py-3 shadow-lg
              flex items-center gap-2
              animate-slide-up pointer-events-auto
            `}
            onClick={() => hideToast(toast.id)}
          >
            <span>{toastIcons[toast.type]}</span>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
      {/* #endregion TOAST UI */}

    </ToastContext.Provider>
  )
}
// #endregion PROVIDER

// #region HOOK
// useToast() — use em qualquer componente
export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return context
}
// #endregion HOOK
