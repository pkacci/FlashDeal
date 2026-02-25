// ============================================================
// INÍCIO: src/components/consumidor/ReservaCard.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, types/reserva.ts
// Descrição: Card de reserva na tela "Minhas Reservas" do consumidor
//            — Mostra estado visual por status (ativa/usada/cancelada/expirada)
//            — CTA contextual por status
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Reserva } from '../../types/reserva';

// #region Types
interface ReservaCardProps {
  reserva: Reserva;
  onCancelar?: (reservaId: string) => void; // Só exibido se status == 'confirmado'
}
// #endregion

// #region Config visual por status
type StatusConfig = {
  label: string;
  cor: string;        // Classes Tailwind para badge
  icone: string;
};

const STATUS_CONFIG: Record<Reserva['status'], StatusConfig> = {
  pendente: {
    label: 'Aguardando pagamento',
    cor: 'bg-yellow-100 text-yellow-700',
    icone: '⏳',
  },
  confirmado: {
    label: 'Ativa',
    cor: 'bg-green-100 text-green-700',
    icone: '🟢',
  },
  usado: {
    label: 'Utilizado',
    cor: 'bg-neutral-100 text-neutral-500',
    icone: '✅',
  },
  cancelado: {
    label: 'Cancelado',
    cor: 'bg-red-100 text-red-500',
    icone: '❌',
  },
  expirado: {
    label: 'Expirado',
    cor: 'bg-neutral-100 text-neutral-400',
    icone: '⌛',
  },
};
// #endregion

// #region Helpers
const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatData = (timestamp: { toDate: () => Date } | null): string => {
  if (!timestamp) return '';
  return timestamp.toDate().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
// #endregion

// #region Component
const ReservaCard: React.FC<ReservaCardProps> = ({ reserva, onCancelar }) => {
  const navigate = useNavigate();
  const config = STATUS_CONFIG[reserva.status];

  const podeVerVoucher = reserva.status === 'confirmado';
  const podeCancelar = reserva.status === 'confirmado' && !!onCancelar;
  const podeAvaliar = reserva.status === 'usado';

  return (
    <div className={`card p-4 ${reserva.status === 'expirado' || reserva.status === 'cancelado' ? 'opacity-70' : ''}`}>
      {/* Header: título + badge status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-neutral-800 text-sm leading-snug flex-1">
          {reserva.ofertaTitulo}
        </p>
        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${config.cor}`}>
          {config.icone} {config.label}
        </span>
      </div>

      {/* Subtítulo: PME + data */}
      <div className="flex justify-between text-xs text-neutral-400 mb-3">
        <span>{reserva.pmeNome ?? '—'}</span>
        <span>
          {reserva.status === 'usado' && reserva.dataUso
            ? `Usado em ${formatData(reserva.dataUso)}`
            : reserva.status === 'cancelado' && reserva.dataCancelamento
            ? `Cancelado em ${formatData(reserva.dataCancelamento)}`
            : reserva.createdAt
            ? `Reservado em ${formatData(reserva.createdAt)}`
            : ''}
        </span>
      </div>

      {/* Valor pago */}
      <p className="text-sm text-neutral-600 mb-3">
        Valor pago:{' '}
        <span className="font-semibold text-neutral-800">
          {formatBRL(reserva.valorPago)}
        </span>
      </p>

      {/* Motivo de cancelamento, se houver */}
      {reserva.status === 'cancelado' && reserva.motivoCancelamento && (
        <p className="text-xs text-neutral-400 italic mb-3">
          Motivo: {reserva.motivoCancelamento}
        </p>
      )}

      {/* CTAs contextuais por status */}
      <div className="flex gap-2">
        {/* Ver voucher — só para reservas ativas */}
        {podeVerVoucher && (
          <button
            onClick={() => navigate(`/voucher/${reserva.id}`)}
            className="btn-primary flex-1 text-sm py-2"
          >
            📱 Ver Voucher
          </button>
        )}

        {/* Avaliar PME — só após uso */}
        {podeAvaliar && (
          <button
            // TODO: implementar modal de avaliação (pós-MVP)
            onClick={() => {}}
            className="flex-1 text-sm py-2 border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            ⭐ Avaliar
          </button>
        )}

        {/* Cancelar — só para ativas, antes do prazo */}
        {podeCancelar && (
          <button
            onClick={() => onCancelar(reserva.id)}
            className="text-sm py-2 px-3 text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
};
// #endregion

export default ReservaCard;

// ============================================================
// FIM: src/components/consumidor/ReservaCard.tsx
// ============================================================
