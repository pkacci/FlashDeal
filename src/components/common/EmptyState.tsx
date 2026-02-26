// ============================================================
// INÍCIO: src/components/common/EmptyState.tsx
// Versão: 1.1.0 | Correção: icone (PT) como alias de icon
// ============================================================

import React from 'react';

export interface EmptyStateProps {
  icon?: string;
  icone?: string;       // ← alias PT para compatibilidade
  titulo?: string;
  title?: string;       // ← alias EN
  subtitulo?: string;
  subtitle?: string;    // ← alias EN
  ctaLabel?: string;
  onCta?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon, icone,
  titulo, title,
  subtitulo, subtitle,
  ctaLabel,
  onCta,
}) => {
  const displayIcon    = icone ?? icon ?? '📭';
  const displayTitulo  = titulo ?? title ?? 'Nada por aqui';
  const displaySubtitulo = subtitulo ?? subtitle;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <p className="text-5xl mb-4">{displayIcon}</p>
      <p className="font-semibold text-neutral-700 text-lg mb-2">{displayTitulo}</p>
      {displaySubtitulo && (
        <p className="text-sm text-neutral-400 mb-6">{displaySubtitulo}</p>
      )}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="btn-primary px-6 py-2 text-sm"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

// ============================================================
// FIM: src/components/common/EmptyState.tsx
// ============================================================
