// ============================================================
// INÍCIO: src/components/pme/OfertaAtiva.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, types/oferta.ts
// Descrição: Card de oferta ativa no Dashboard PME
//            Exibe barra de estoque, timer, vendas e CTA validar
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Oferta } from '../../types/oferta';

// #region Types
interface OfertaAtivaProps {
  oferta: Oferta;
  vendidoTotal: number; // R$ vendido nesta oferta (calculado externamente)
  onEncerrar?: (ofertaId: string) => void; // Callback para encerrar oferta
}
// #endregion

// #region Helpers
/** Calcula tempo restante em string legível */
const calcTempoRestante = (dataFim: Date): string => {
  const diff = dataFim.getTime() - Date.now();
  if (diff <= 0) return 'Expirada';

  const horas = Math.floor(diff / (1000 * 60 * 60));
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min`;
};

/** Percentual de estoque consumido (0-100) */
const calcPercEstoque = (total: number, disponivel: number): number => {
  if (total === 0) return 0;
  return Math.round(((total - disponivel) / total) * 100);
};

/** Cor da barra de estoque por percentual consumido */
const corBarra = (perc: number): string => {
  if (perc >= 80) return 'bg-success-500'; // verde — quase esgotado
  if (perc >= 50) return 'bg-yellow-400';  // amarelo — metade vendida
  return 'bg-primary-500';                 // laranja — início
};
// #endregion

// #region Component
const OfertaAtiva: React.FC<OfertaAtivaProps> = ({
  oferta,
  vendidoTotal,
  onEncerrar,
}) => {
  const navigate = useNavigate();

  // Timer reativo — atualiza a cada minuto
  const [tempoRestante, setTempoRestante] = useState(() =>
    calcTempoRestante(oferta.dataFim.toDate())
  );

  useEffect(() => {
    const intervalo = setInterval(() => {
      setTempoRestante(calcTempoRestante(oferta.dataFim.toDate()));
    }, 60_000); // Atualiza a cada 1 minuto

    return () => clearInterval(intervalo);
  }, [oferta.dataFim]);

  const percEstoque = calcPercEstoque(
    oferta.quantidadeTotal,
    oferta.quantidadeDisponivel
  );

  // vendidas calculado inline no JSX para evitar variável órfã
  const expirada = tempoRestante === 'Expirada';

  return (
    <div className={`card p-4 ${expirada ? 'opacity-60' : ''}`}>
      {/* Header: título + badge status */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-neutral-800 truncate">
            {oferta.titulo}
          </p>
          <p className="text-sm text-neutral-500">
            {oferta.desconto}% de desconto · R${' '}
            {oferta.valorOferta.toFixed(2)}
          </p>
        </div>

        {/* Badge: status */}
        <span
          className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
            expirada
              ? 'bg-neutral-100 text-neutral-500'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {expirada ? 'Expirada' : '● Ativa'}
        </span>
      </div>

      {/* Barra de estoque */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-neutral-500 mb-1">
          <span>
            {oferta.quantidadeTotal - oferta.quantidadeDisponivel}/{oferta.quantidadeTotal} vendidas
          </span>
          <span>{oferta.quantidadeDisponivel} restantes</span>
        </div>
        <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${corBarra(percEstoque)}`}
            style={{ width: `${percEstoque}%` }}
            role="progressbar"
            aria-valuenow={percEstoque}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Métricas: tempo + vendas R$ */}
      <div className="flex justify-between text-sm mb-4">
        <span className="text-neutral-500">
          ⏱ Expira em{' '}
          <span
            className={`font-medium ${
              expirada ? 'text-neutral-400' : 'text-neutral-700'
            }`}
          >
            {tempoRestante}
          </span>
        </span>
        <span className="text-neutral-500">
          <span className="font-semibold text-neutral-700">
            R$ {vendidoTotal.toFixed(2)}
          </span>{' '}
          vendido
        </span>
      </div>

      {/* CTAs */}
      <div className="flex gap-2">
        {/* Botão principal: ir para validação */}
        <button
          onClick={() => navigate('/validar-voucher')}
          className="btn-primary flex-1 text-sm py-2"
          disabled={expirada}
        >
          📷 Validar QR
        </button>

        {/* Botão secundário: encerrar oferta antecipadamente */}
        {onEncerrar && !expirada && (
          <button
            onClick={() => onEncerrar(oferta.id)}
            className="px-3 py-2 text-sm text-neutral-500 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            aria-label="Encerrar oferta"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
// #endregion

export default OfertaAtiva;

// ============================================================
// FIM: src/components/pme/OfertaAtiva.tsx
// ============================================================
