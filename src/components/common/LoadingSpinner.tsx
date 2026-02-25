// ==========================================
// [ARQUIVO] LoadingSpinner.tsx v1.1
// [DATA] 2026-02-25
// [REQUER] index.css, tailwind.config.js
// ==========================================

// #region TYPES
interface LoadingSpinnerProps {
  fullScreen?: boolean  // true = cobre tela inteira
  message?: string      // Mensagem opcional abaixo
}
// #endregion TYPES

// #region COMPONENT
export default function LoadingSpinner({
  fullScreen = false,
  message
}: LoadingSpinnerProps) {

  // #region SPINNER UI
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* Anel animado com cor primária do Design System */}
      <div className="w-10 h-10 rounded-full border-4
                      border-neutral-200 border-t-primary-500
                      animate-spin" />
      {message && (
        <p className="text-sm text-neutral-500 font-medium">{message}</p>
      )}
    </div>
  )
  // #endregion SPINNER UI

  // #region FULLSCREEN
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white z-50
                      flex items-center justify-center">
        {spinner}
      </div>
    )
  }
  // #endregion FULLSCREEN

  return (
    <div className="flex items-center justify-center py-12">
      {spinner}
    </div>
  )
}
// #endregion COMPONENT
