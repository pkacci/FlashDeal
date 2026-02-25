// ============================================================
// INÍCIO: src/components/consumidor/FiltroCategoria.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React
// Descrição: Chips de filtro por categoria na tela de Ofertas
//            — Scroll horizontal no mobile
//            — "Todos" sempre primeiro, reseta seleção
//            — Controlado: estado gerenciado pelo pai (OfertasPage)
// ============================================================

import React, { useRef } from 'react';

// #region Types
export type CategoriaFiltro =
  | 'todos'
  | 'restaurante'
  | 'beleza'
  | 'fitness'
  | 'servicos'
  | 'varejo';

interface FiltroProps {
  categoriaSelecionada: CategoriaFiltro;
  onChange: (categoria: CategoriaFiltro) => void;
}
// #endregion

// #region Configuração das categorias
const CATEGORIAS: { id: CategoriaFiltro; label: string; icone: string }[] = [
  { id: 'todos',      label: 'Todos',    icone: '✨' },
  { id: 'restaurante',label: 'Comida',   icone: '🍕' },
  { id: 'beleza',     label: 'Beleza',   icone: '💇' },
  { id: 'fitness',    label: 'Fitness',  icone: '💪' },
  { id: 'servicos',   label: 'Serviços', icone: '🛠️' },
  { id: 'varejo',     label: 'Lojas',    icone: '🛍️' },
];
// #endregion

// #region Component
const FiltroCategoria: React.FC<FiltroProps> = ({
  categoriaSelecionada,
  onChange,
}) => {
  // Ref para scroll programático — centraliza chip selecionado
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSelecionar = (cat: CategoriaFiltro, index: number) => {
    onChange(cat);

    // Scroll suave para manter chip visível ao selecionar
    if (scrollRef.current) {
      const chip = scrollRef.current.children[index] as HTMLElement;
      chip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  return (
    // overflow-x-auto com scrollbar oculta — padrão mobile
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      role="listbox"
      aria-label="Filtrar por categoria"
    >
      {CATEGORIAS.map((cat, index) => {
        const ativo = categoriaSelecionada === cat.id;
        return (
          <button
            key={cat.id}
            role="option"
            aria-selected={ativo}
            onClick={() => handleSelecionar(cat.id, index)}
            className={`
              shrink-0 flex items-center gap-1.5 px-3 py-1.5
              rounded-full text-sm font-medium border transition-all
              ${ativo
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-300'
              }
            `}
          >
            <span aria-hidden>{cat.icone}</span>
            {cat.label}
          </button>
        );
      })}
    </div>
  );
};
// #endregion

export default FiltroCategoria;

// ============================================================
// FIM: src/components/consumidor/FiltroCategoria.tsx
// ============================================================
