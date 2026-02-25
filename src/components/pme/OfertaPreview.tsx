// ============================================================
// INÍCIO: src/components/pme/OfertaPreview.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React
// Descrição: Preview em tempo real de como a oferta aparecerá
//            para o consumidor — exibido na tela CriarOfertaPage
//            Atualiza conforme PME preenche o formulário (prop drilling)
// ============================================================

import React from 'react';

// #region Types
export interface OfertaPreviewData {
  titulo: string;
  valorOriginal: number;
  desconto: number;               // 0-100
  quantidadeTotal: number;
  quantidadeDisponivel: number;
  dataFim: Date | null;           // null = sem prazo definido
  pmeNome: string;
  imagemUrl?: string;             // URL local (URL.createObjectURL) ou remota
}

interface OfertaPreviewProps {
  data: OfertaPreviewData;
}
// #endregion

// #region Helpers
const calcValorOferta = (original: number, desconto: number): number => {
  if (original <= 0 || desconto <= 0) return original;
  return original * (1 - desconto / 100);
};

/** Tempo restante formatado para o preview */
const calcTempoPreview = (dataFim: Date | null): string => {
  if (!dataFim) return '—';
  const diff = dataFim.getTime() - Date.now();
  if (diff <= 0) return 'Expirada';

  const horas = Math.floor(diff / (1000 * 60 * 60));
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (horas >= 24) return `${Math.floor(horas / 24)}d`;
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min`;
};
// #endregion

// #region Component
const OfertaPreview: React.FC<OfertaPreviewProps> = ({ data }) => {
  const valorOferta = calcValorOferta(data.valorOriginal, data.desconto);
  const economia = data.valorOriginal - valorOferta;
  const tempoRestante = calcTempoPreview(data.dataFim);

  // Placeholder para título vazio
  const titulo = data.titulo.trim() || 'Título da sua oferta';

  // Percentual de estoque para preview (simula oferta nova)
  const percEstoque =
    data.quantidadeTotal > 0
      ? Math.round(
          ((data.quantidadeTotal - data.quantidadeDisponivel) /
            data.quantidadeTotal) *
            100
        )
      : 0;

  return (
    <div>
      {/* Label de seção */}
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
        Preview — como o cliente verá
      </p>

      {/* Card de preview — replica visual do OfertaCard do consumidor */}
      <div className="card overflow-hidden border-2 border-dashed border-neutral-200">
        {/* Imagem ou placeholder */}
        <div className="h-32 bg-neutral-100 relative overflow-hidden">
          {data.imagemUrl ? (
            <img
              src={data.imagemUrl}
              alt="Preview da oferta"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-neutral-300 text-4xl">🖼️</span>
            </div>
          )}

          {/* Badge de desconto */}
          {data.desconto > 0 && (
            <div className="absolute top-2 left-2 bg-primary-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              -{data.desconto}%
            </div>
          )}
        </div>

        {/* Corpo do card */}
        <div className="p-3">
          {/* Título */}
          <p
            className={`font-semibold text-sm leading-snug mb-1 ${
              data.titulo ? 'text-neutral-800' : 'text-neutral-300 italic'
            }`}
          >
            {titulo}
          </p>

          {/* PME */}
          <p className="text-xs text-neutral-400 mb-2">
            {data.pmeNome || 'Seu negócio'} · 350m
          </p>

          {/* Barra de estoque mini */}
          {data.quantidadeTotal > 0 && (
            <div className="mb-2">
              <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${Math.max(percEstoque, 5)}%` }}
                />
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                {data.quantidadeDisponivel > 0
                  ? `${data.quantidadeDisponivel}/${data.quantidadeTotal} disponíveis`
                  : `${data.quantidadeTotal} disponíveis`}
              </p>
            </div>
          )}

          {/* Preços */}
          <div className="flex items-center justify-between">
            <div>
              {data.desconto > 0 && data.valorOriginal > 0 && (
                <p className="text-xs text-neutral-400 line-through">
                  R$ {data.valorOriginal.toFixed(2)}
                </p>
              )}
              <p className="text-base font-bold text-neutral-800">
                {valorOferta > 0 ? (
                  `R$ ${valorOferta.toFixed(2)}`
                ) : (
                  <span className="text-neutral-300">R$ —</span>
                )}
              </p>
              {economia > 0 && (
                <p className="text-xs text-green-600">
                  Economia de R$ {economia.toFixed(2)}
                </p>
              )}
            </div>

            {/* Timer */}
            <div className="text-right">
              <p className="text-xs text-neutral-400">Expira em</p>
              <p className="text-sm font-semibold text-neutral-700">
                {tempoRestante}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso: preview aproximado */}
      <p className="text-xs text-neutral-400 mt-2 text-center">
        ℹ️ Preview aproximado — distância e imagem podem variar
      </p>
    </div>
  );
};
// #endregion

export default OfertaPreview;

// ============================================================
// FIM: src/components/pme/OfertaPreview.tsx
// ============================================================
