// LoadingSpinner.tsx | v1.0.0 | 2025-02-25
// Deps: tailwindcss

// #region types
interface LoadingSpinnerProps {
  /** Ocupa toda a tela com overlay */
  fullScreen?: boolean;
  /** Tamanho do spinner em pixels */
  size?: 'sm' | 'md' | 'lg';
  /** Mensagem opcional abaixo do spinner */
  message?: string;
}
// #endregion

// #region size map
const sizeMap = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
};
// #endregion

// #region component
const LoadingSpinner = ({
  fullScreen = false,
  size = 'md',
  message,
}: LoadingSpinnerProps) => {
  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`
          animate-spin rounded-full border-transparent
          border-t-orange-500 border-solid ${sizeMap[size]}
        `}
        role="status"
        aria-label="Carregando..."
      />
      {message && (
        <p className="text-sm text-gray-500">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      {spinner}
    </div>
  );
};
// #endregion

export default LoadingSpinner;
