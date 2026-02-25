// ==========================================
// [ARQUIVO] Toast.tsx v1.1
// [DATA] 2026-02-25
// [REQUER] ToastContext.tsx, index.css
// ==========================================

// #region IMPORTS
import { useToast, type ToastType } from '@/contexts/ToastContext'
// #endregion IMPORTS

// #region STYLES — Cores por tipo usando Design System
const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-success-500 text-white shadow-success',
  error:   'bg-danger-500 text-white',
  warning: 'bg-warning-500 text-white',
  info:    'bg-secondary-500 text-white shadow-md',
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
}
// #endregion STYLES

// #region COMPONENT
// Toast é apenas o componente visual — lógica está no ToastContext
export default function Toast() {
  const { toasts, hideToast } = useToast()

  if (toasts.length === 0) return null

  return (
    // #region CONTAINER — fixo no topo, acima de tudo
    <div className="fixed top-4 left-4 right-4 z-[100]
                    flex flex-col gap-2 pointer-events-none
                    max-w-lg mx-auto">
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => hideToast(toast.id)}
          className={`
            ${TOAST_STYLES[toast.type]}
            rounded-lg px-4 py-3
            flex items-center gap-3
            animate-slide-up
            pointer-events-auto cursor-pointer
            active:scale-95 transition-transform
          `}
        >
          {/* Ícone do tipo */}
          <span className="text-base flex-shrink-0">
            {TOAST_ICONS[toast.type]}
          </span>

          {/* Mensagem */}
          <span className="text-sm font-medium flex-1">
            {toast.message}
          </span>

          {/* Fechar */}
          <span className="text-white/70 text-xs flex-shrink-0">✕</span>
        </div>
      ))}
    </div>
    // #endregion CONTAINER
  )
}
// #endregion COMPONENT
