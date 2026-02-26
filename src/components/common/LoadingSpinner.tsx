// ============================================================
// INÍCIO: src/components/common/LoadingSpinner.tsx
// Versão: 1.1.0 | Correção: props size + fullScreen adicionados
// ============================================================

import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;   // ← adicionado (maiúsculo)
  fullscreen?: boolean;   // ← adicionado (minúsculo — alias)
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  fullScreen,
  fullscreen,
  color = 'text-primary-500',
}) => {
  const isFullScreen = fullScreen || fullscreen;

  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-4',
  };

  const spinner = (
    <div
      className={`${sizeMap[size]} ${color} border-current border-t-transparent
                  rounded-full animate-spin`}
    />
  );

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;

// ============================================================
// FIM: src/components/common/LoadingSpinner.tsx
// ============================================================
