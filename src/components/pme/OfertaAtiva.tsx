// ============================================================
// INÍCIO: src/components/pme/OfertaAtiva.tsx
// Versão: 1.1.0 | Data: 2026-02-27
// Fix v1.1: Confirmação inline antes de encerrar oferta
//           Evita encerramento acidental no balcão
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Oferta } from '../../types/oferta';

interface OfertaAtivaProps {
  oferta: Oferta;
  vendidoTotal: number;
  onEncerrar?: (ofertaId: string) => void;
}

const calcTempoRestante = (dataFim: Date): string => {
  const diff = dataFim.getTime() - Date.now();
  if (diff <= 0) return 'Expirada';
  const horas = Math.floor(diff / (1000 * 60 * 60));
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min`;
};

const calcPercEstoque = (total: number, disponivel: number): number => {
  if (total === 0) return 0;
  return Math.round(((total - disponivel) / total) * 100);
};

const corBarra = (perc: number): string => {
  if (perc >= 80) return 'bg-success-500';
  if (perc >= 50) return 'bg-yellow-400';
  return 'bg-primary-500';
};

const OfertaAtiva: React.FC<OfertaAtivaProps> = ({ oferta, vendidoTotal, onEncerrar }) => {
  const navigate = useNavigate();
  const [tempoRestante, setTempoRestante] = useState(() => calcTempoRestante(oferta.dataFim.toDate()));
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setTempoRestante(calcTempoRestante(oferta.dataFim.toDate()));
    }, 60_000);
    return () => clearInterval(intervalo);
  }, [oferta.dataFim]);

  const percEstoque = calcPercEstoque(oferta.quantidadeTotal, oferta.quantidadeDisponivel);
  const expirada = tempoRestante === 'Expirada';

  const handleEncerrarClick = () => setConfirmando(true);
  const handleCancelarConfirm = () => setConfirmando(false);
  const handleConfirmarEncerrar = () => {
    setConfirmando(false);
    onEncerrar?.(oferta.id);
  };

  return (
    <div className={`card p-4 ${expirada ? 'opacity-60' : ''}`}>

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-neutral-800 truncate">{oferta.titulo}</p>
          <p className="text-sm text-neutral-500">
            {oferta.desconto}% de desconto · R$ {oferta.valorOferta.toFixed(2)}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
          expirada ? 'bg-neutral-100 text-neutral-500' : 'bg-green-100 text-green-700'
        }`}>
          {expirada ? 'Expirada' : '● Ativa'}
        </span>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs text-neutral-500 mb-1">
          <span>{oferta.quantidadeTotal - oferta.quantidadeDisponivel}/{oferta.quantidadeTotal} vendidas</span>
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

      <div className="flex justify-between text-sm mb-4">
        <span className="text-neutral-500">
          ⏱ Expira em{' '}
          <span className={`font-medium ${expirada ? 'text-neutral-400' : 'text-neutral-700'}`}>
            {tempoRestante}
          </span>
        </span>
        <span className="text-neutral-500">
          <span className="font-semibold text-neutral-700">R$ {vendidoTotal.toFixed(2)}</span> vendido
        </span>
      </div>

      {confirmando && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-red-700 mb-1">Encerrar esta oferta?</p>
          <p className="text-xs text-red-500 mb-3">Ela deixará de aparecer para os clientes imediatamente.</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmarEncerrar}
              className="flex-1 py-2 bg-red-500 text-white text-sm font-bold rounded-lg active:scale-95 transition-all"
            >
              Sim, encerrar
            </button>
            <button
              onClick={handleCancelarConfirm}
              className="flex-1 py-2 bg-white text-neutral-600 text-sm font-medium border border-neutral-200 rounded-lg active:scale-95 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => navigate('/validar-voucher')}
          className="btn-primary flex-1 text-sm py-2"
          disabled={expirada}
        >
          📷 Validar QR
        </button>
        {onEncerrar && !expirada && !confirmando && (
          <button
            onClick={handleEncerrarClick}
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

export default OfertaAtiva;

// ============================================================
// FIM: src/components/pme/OfertaAtiva.tsx
// ============================================================
