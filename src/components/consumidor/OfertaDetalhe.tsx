// ============================================================
// INÍCIO: src/components/consumidor/OfertaDetalhe.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, types/oferta.ts
// Descrição: Tela completa de detalhes de uma oferta para o consumidor
//            — CTA fixo sticky no rodapé ("Garantir com Pix")
//            — Abre LoginModal se consumidor não autenticado (Late Auth)
//            — Timer de expiração + barra de estoque
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Oferta } from '../../types/oferta';

// #region Types
interface OfertaDetalheProps {
  oferta: Oferta;
  distanciaMetros?: number;     // Calculado via Haversine no pai
  isAutenticado: boolean;
  onGarantir: () => void;       // Pai decide: abre LoginModal ou navega para Pix
  isLoading?: boolean;
}
// #endregion

// #region Helpers
const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDistancia = (metros?: number): string => {
  if (!metros) return '';
  if (metros < 1000) return `${metros}m`;
  return `${(metros / 1000).toFixed(1)}km`;
};

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
// #endregion

// #region Component
const OfertaDetalhe: React.FC<OfertaDetalheProps> = ({
  oferta,
  distanciaMetros,
  isAutenticado,
  onGarantir,
  isLoading = false,
}) => {
  const navigate = useNavigate();

  const [tempoRestante, setTempoRestante] = useState(() =>
    calcTempoRestante(oferta.dataFim.toDate())
  );

  // Atualiza timer a cada minuto
  useEffect(() => {
    const intervalo = setInterval(() => {
      setTempoRestante(calcTempoRestante(oferta.dataFim.toDate()));
    }, 60_000);
    return () => clearInterval(intervalo);
  }, [oferta.dataFim]);

  const percEstoque = calcPercEstoque(
    oferta.quantidadeTotal,
    oferta.quantidadeDisponivel
  );
  const expirada = tempoRestante === 'Expirada';
  const esgotada = oferta.quantidadeDisponivel === 0;
  const indisponivel = expirada || esgotada;
  const economia = oferta.valorOriginal - oferta.valorOferta;

  return (
    // Padding bottom para não sobrepor o CTA fixo
    <div className="pb-28">
      {/* Botão voltar */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-neutral-500 mb-4 hover:text-neutral-700"
      >
        ← Voltar
      </button>

      {/* Imagem da oferta */}
      <div className="h-52 bg-neutral-100 rounded-xl overflow-hidden mb-4 relative">
        {oferta.imagemUrl ? (
          <img
            src={oferta.imagemUrl}
            alt={oferta.titulo}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 text-5xl">
            🖼️
          </div>
        )}
        <div className="absolute top-3 left-3 bg-primary-500 text-white text-sm font-bold px-3 py-1 rounded-full">
          -{oferta.desconto}%
        </div>
      </div>

      {/* Título e PME */}
      <h1 className="text-xl font-bold text-neutral-800 mb-1">{oferta.titulo}</h1>
      <p className="text-sm text-neutral-500 mb-4">
        {oferta.pmeNome}
        {distanciaMetros !== undefined && (
          <span> · 📍 {formatDistancia(distanciaMetros)}</span>
        )}
      </p>

      {/* Bloco de preços */}
      <div className="card p-4 mb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-neutral-400 line-through">
              {formatBRL(oferta.valorOriginal)}
            </p>
            <p className="text-3xl font-bold text-neutral-800">
              {formatBRL(oferta.valorOferta)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-400">Você economiza</p>
            <p className="text-lg font-bold text-green-600">
              {formatBRL(economia)}
            </p>
          </div>
        </div>
      </div>

      {/* Timer + estoque + endereço */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span>⏱</span>
          <span className="text-neutral-500">Expira em</span>
          <span className={`font-semibold ${expirada ? 'text-red-500' : 'text-neutral-700'}`}>
            {tempoRestante}
          </span>
        </div>

        <div>
          <div className="flex justify-between text-xs text-neutral-500 mb-1">
            <span>🎫 {oferta.quantidadeDisponivel} de {oferta.quantidadeTotal} disponíveis</span>
            <span>{percEstoque}% vendido</span>
          </div>
          <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${percEstoque}%` }}
            />
          </div>
          {/* Aviso de urgência: últimas unidades */}
          {oferta.quantidadeDisponivel <= 3 && !esgotada && (
            <p className="text-xs text-red-500 mt-1 font-medium">🔥 Últimas unidades!</p>
          )}
        </div>

        {oferta.endereco && (
          <div className="flex items-start gap-2 text-sm text-neutral-500">
            <span>📍</span>
            <span>
              {oferta.endereco.rua}, {oferta.endereco.numero} —{' '}
              {oferta.endereco.bairro}, {oferta.endereco.cidade}
            </span>
          </div>
        )}
      </div>

      {/* Como funciona */}
      <div className="card p-4 mb-4">
        <p className="text-sm font-semibold text-neutral-700 mb-3">Como funciona</p>
        <ol className="space-y-2 text-sm text-neutral-600">
          {[
            'Pague com Pix agora — confirmação instantânea',
            'Receba o voucher QR Code no app',
            `Vá até ${oferta.pmeNome} e mostre o QR Code`,
          ].map((passo, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 w-5 h-5 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              {passo}
            </li>
          ))}
        </ol>
      </div>

      {/* CTA fixo no rodapé — sempre visível, z-index acima do BottomNav */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-neutral-100 p-4 z-30">
        <button
          onClick={onGarantir}
          disabled={indisponivel || isLoading}
          className={`btn-primary w-full py-4 text-base font-bold ${
            indisponivel ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading
            ? 'Aguarde...'
            : esgotada
            ? 'Esgotado'
            : expirada
            ? 'Oferta encerrada'
            : `🟢 Garantir com Pix — ${formatBRL(oferta.valorOferta)}`}
        </button>
        {!isAutenticado && !indisponivel && (
          <p className="text-xs text-neutral-400 text-center mt-2">
            Você precisará fazer login para garantir
          </p>
        )}
      </div>
    </div>
  );
};
// #endregion

export default OfertaDetalhe;

// ============================================================
// FIM: src/components/consumidor/OfertaDetalhe.tsx
// ============================================================
