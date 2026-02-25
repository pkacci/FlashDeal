// EmptyState.tsx | v1.0.0 | 2025-02-25
// Deps: tailwindcss

import { ReactNode } from 'react';

// #region types
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
// #endregion

// #region component
const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Ícone */}
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-400">
          {icon}
        </div>
      )}

      {/* Texto */}
      <h3 className="mb-2 text-base font-semibold text-gray-800">{title}</h3>
      {description && (
        <p className="mb-6 text-sm text-gray-500 max-w-xs">{description}</p>
      )}

      {/* CTA opcional */}
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 active:scale-95 transition-transform"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
// #endregion

export default EmptyState;
