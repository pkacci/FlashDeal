// ============================================================
// INÍCIO: src/components/pme/DashboardStats.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, types/reserva.ts, types/oferta.ts
// Descrição: Painel de métricas do dashboard PME
//            Exibe vendas do dia, semana e total de reservas
// ============================================================

import React from 'react';

// #region Types
interface DashboardStatsProps {
  vendidoHoje: number;       // R$ vendido hoje
  vendidoSemana: number;     // R$ vendido na semana
  reservasAtivas: number;    // Reservas aguardando uso
  reservasHoje: number;      // Reservas confirmadas hoje
  isLoading?: boolean;
}
// #endregion

// #region Helpers
/** Formata valor em BRL sem precisar de Intl completo */
const formatBRL = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
};
// #endregion

// #region Skeleton
/** Placeholder animado enquanto dados carregam */
const StatSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-neutral-200 rounded w-24 mb-2" />
    <div className="h-8 bg-neutral-200 rounded w-32" />
  </div>
);
// #endregion

// #region StatCard
interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean; // Destaque visual para métrica principal
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sub,
  highlight = false,
  isLoading = false,
}) => (
  <div
    className={`card p-4 ${
      highlight
        ? 'bg-primary-500 text-white' // Cartão principal — fundo laranja
        : 'bg-white'
    }`}
  >
    <p
      className={`text-sm font-medium mb-1 ${
        highlight ? 'text-orange-100' : 'text-neutral-500'
      }`}
    >
      {label}
    </p>

    {isLoading ? (
      <StatSkeleton />
    ) : (
      <>
        <p
          className={`text-2xl font-bold ${
            highlight ? 'text-white' : 'text-neutral-800'
          }`}
        >
          {value}
        </p>
        {sub && (
          <p
            className={`text-xs mt-1 ${
              highlight ? 'text-orange-100' : 'text-neutral-400'
            }`}
          >
            {sub}
          </p>
        )}
      </>
    )}
  </div>
);
// #endregion

// #region Component principal
const DashboardStats: React.FC<DashboardStatsProps> = ({
  vendidoHoje,
  vendidoSemana,
  reservasAtivas,
  reservasHoje,
  isLoading = false,
}) => {
  return (
    <section aria-label="Resumo de vendas" className="space-y-3">
      {/* Métrica principal: vendas do dia */}
      <StatCard
        label="HOJE VOCÊ VENDEU"
        value={isLoading ? '—' : formatBRL(vendidoHoje)}
        sub={
          reservasHoje > 0
            ? `${reservasHoje} ${reservasHoje === 1 ? 'reserva confirmada' : 'reservas confirmadas'}`
            : vendidoHoje === 0
            ? 'Sua primeira venda vem aí!'
            : undefined
        }
        highlight
        isLoading={isLoading}
      />

      {/* Grid 2 colunas: semana + reservas ativas */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="ESTA SEMANA"
          value={isLoading ? '—' : formatBRL(vendidoSemana)}
          isLoading={isLoading}
        />
        <StatCard
          label="RESERVAS ATIVAS"
          value={isLoading ? '—' : String(reservasAtivas)}
          sub={reservasAtivas > 0 ? 'aguardando uso' : 'nenhuma no momento'}
          isLoading={isLoading}
        />
      </div>
    </section>
  );
};
// #endregion

export default DashboardStats;

// ============================================================
// FIM: src/components/pme/DashboardStats.tsx
// ============================================================
