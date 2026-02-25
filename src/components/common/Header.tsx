// Header.tsx | v1.0.0 | 2025-02-25
// Deps: react-router-dom, tailwindcss, lucide-react

import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical } from 'lucide-react';

// #region types
interface HeaderProps {
  title: string;
  /** Mostra botão voltar */
  showBack?: boolean;
  /** Ação do botão voltar (padrão: navigate(-1)) */
  onBack?: () => void;
  /** Elemento à direita (ex: ícone de menu) */
  rightElement?: ReactNode;
  /** Subtítulo opcional */
  subtitle?: string;
  /** Oculta sombra */
  flat?: boolean;
}
// #endregion

// #region component
const Header = ({
  title,
  showBack = false,
  onBack,
  rightElement,
  subtitle,
  flat = false,
}: HeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header
      className={`
        sticky top-0 z-40 bg-white px-4 py-3
        ${flat ? '' : 'shadow-sm border-b border-gray-100'}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Botão voltar */}
        {showBack && (
          <button
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors -ml-1"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
        )}

        {/* Título */}
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-base font-semibold text-gray-900">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-gray-500">{subtitle}</p>
          )}
        </div>

        {/* Elemento direito */}
        {rightElement ?? (
          // Placeholder para manter alinhamento quando não há elemento direito
          <div className="h-9 w-9" />
        )}
      </div>
    </header>
  );
};
// #endregion

export default Header;
