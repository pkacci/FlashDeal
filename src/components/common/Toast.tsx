// Toast.tsx | v1.0.0 | 2025-02-25
// Deps: tailwindcss, lucide-react, ToastContext

import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToast, ToastItem } from '../../contexts/ToastContext';

// #region icon map
const ICON_MAP = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error:   <XCircle    className="h-5 w-5 text-red-500"   />,
  warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
  info:    <Info       className="h-5 w-5 text-blue-500"  />,
};

const BG_MAP = {
  success: 'border-green-100 bg-green-50',
  error:   'border-red-100   bg-red-50',
  warning: 'border-yellow-100 bg-yellow-50',
  info:    'border-blue-100  bg-blue-50',
};
// #endregion

// #region single toast item
interface ToastItemProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard = ({ toast, onDismiss }: ToastItemProps) => {
  // Auto-dismiss após duração
  useEffect(() => {
    if (!toast.duration) return;
    const t = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg
        animate-fade-in-up max-w-sm w-full
        ${BG_MAP[toast.type]}
      `}
    >
      {/* Ícone */}
      <span className="mt-0.5 shrink-0">{ICON_MAP[toast.type]}</span>

      {/* Mensagem */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-gray-800">{toast.title}</p>
        )}
        <p className="text-sm text-gray-700">{toast.message}</p>
      </div>

      {/* Fechar */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-full p-1 hover:bg-black/10 transition-colors"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4 text-gray-500" />
      </button>
    </div>
  );
};
// #endregion

// #region container
const Toast = () => {
  const { toasts, dismiss } = useToast();

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 inset-x-4 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full flex justify-center">
          <ToastCard toast={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
};
// #endregion

export default Toast;
