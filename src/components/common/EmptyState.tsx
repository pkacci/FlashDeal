// ==========================================
// [ARQUIVO] EmptyState.tsx v1.1
// [DATA] 2026-02-25
// [REQUER] index.css, tailwind.config.js
// ==========================================

// #region TYPES
interface EmptyStateProps {
  icon: string           // Emoji ou ícone
  title: string          // Título principal
  subtitle?: string      // Descrição opcional
  ctaLabel?: string      // Texto do botão
  ctaAction?: () => void // Ação do botão
}
// #endregion TYPES

// #region COMPONENT
export default function EmptyState({
  icon,
  title,
  subtitle,
  ctaLabel,
  ctaAction
}: EmptyStateProps) {
  return (
    // #region LAYOUT
    <div className="flex flex-col items-center justify-center
                    py-16 px-6 text-center animate-fade-in">

      {/* Ícone grande centralizado */}
      <div className="text-5xl mb-4">{icon}</div>

      {/* Título */}
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">
        {title}
      </h3>

      {/* Subtítulo opcional */}
      {subtitle && (
        <p className="text-sm text-neutral-500 mb-6 max-w-xs">
          {subtitle}
        </p>
      )}

      {/* CTA opcional — usa btn-primary do Design System */}
      {ctaLabel && ctaAction && (
        <button
          onClick={ctaAction}
          className="btn-primary max-w-xs"
        >
          {ctaLabel}
        </button>
      )}
    </div>
    // #endregion LAYOUT
  )
}
// #endregion COMPONENT
