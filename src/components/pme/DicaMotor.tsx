// ============================================================
// INÍCIO: src/components/pme/DicaMotor.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React
// Descrição: Componente de "Radar de Demanda" para PMEs
//            Exibe insight personalizado baseado em dados/templates
//            — Feature central de retenção (ver seção 4.4 do doc mestre)
//            — Fase MVP: dicas genéricas por categoria/horário
//            — Fase escala: dicas 100% personalizadas por histórico
// ============================================================

import React, { useState } from 'react';

// #region Types
export type DicaTipo = 'horario' | 'desconto' | 'produto' | 'geral';

export interface Dica {
  tipo: DicaTipo;
  texto: string;
  acao?: string;        // Texto do CTA opcional
  acaoRota?: string;    // Rota para navegar ao clicar CTA
  personalizada?: boolean; // true = baseada em dados reais da PME
}

interface DicaMotorProps {
  dica: Dica;
  onAcao?: () => void; // Callback alternativo ao invés de rota
  onDismiss?: () => void; // Fechar dica (opcional)
}
// #endregion

// #region Ícones por tipo
const ICONE_POR_TIPO: Record<DicaTipo, string> = {
  horario: '⏰',
  desconto: '💡',
  produto: '🍕',
  geral: '✨',
};

/** Cor de fundo por tipo de dica */
const COR_POR_TIPO: Record<DicaTipo, string> = {
  horario: 'bg-blue-50 border-blue-200',
  desconto: 'bg-yellow-50 border-yellow-200',
  produto: 'bg-green-50 border-green-200',
  geral: 'bg-orange-50 border-orange-100',
};
// #endregion

// #region Smart Templates (MVP — dicas genéricas por categoria)
// Quando não há dados suficientes da PME, usa templates heurísticos
// baseados em hora do dia e dia da semana.
// Custo: zero (local, sem API)
export const gerarDicaTemplate = (
  categoria: string,
  hora: number,
  diaSemana: number // 0=Dom, 1=Seg...5=Sex, 6=Sab
): Dica => {
  const isQuintaSexta = diaSemana === 4 || diaSemana === 5;
  const isHappyHour = hora >= 17 && hora <= 19;
  const isManha = hora >= 9 && hora <= 11;

  // Restaurantes
  if (categoria === 'restaurante') {
    if (isQuintaSexta && isHappyHour) {
      return {
        tipo: 'horario',
        texto: 'Quinta e sexta às 18h são os melhores horários para restaurantes. Crie uma oferta agora!',
        acao: 'Criar oferta',
        acaoRota: '/criar-oferta',
      };
    }
    if (isHappyHour) {
      return {
        tipo: 'horario',
        texto: 'Happy Hour está rolando! Ofertas de 17h–19h convertem 40% mais.',
        acao: 'Criar oferta',
        acaoRota: '/criar-oferta',
      };
    }
  }

  // Beleza
  if (categoria === 'beleza') {
    if (isManha) {
      return {
        tipo: 'horario',
        texto: 'Manhãs de terça e quarta são ideais para ofertas de beleza. Preencha seus horários vagos!',
        acao: 'Criar oferta',
        acaoRota: '/criar-oferta',
      };
    }
  }

  // Fitness
  if (categoria === 'fitness') {
    return {
      tipo: 'desconto',
      texto: 'Aulas experimentais com 50% de desconto têm alta conversão para novos alunos.',
      acao: 'Criar oferta',
      acaoRota: '/criar-oferta',
    };
  }

  // Genérico — qualquer categoria
  return {
    tipo: 'geral',
    texto: 'Ofertas com prazo curto (2-4h) geram mais urgência e vendem mais rápido.',
    acao: 'Criar oferta',
    acaoRota: '/criar-oferta',
  };
};
// #endregion

// #region Component
const DicaMotor: React.FC<DicaMotorProps> = ({ dica, onAcao, onDismiss }) => {
  const [visivel, setVisivel] = useState(true);

  if (!visivel) return null;

  const handleDismiss = () => {
    setVisivel(false);
    onDismiss?.();
  };

  return (
    <div
      className={`relative border rounded-xl p-4 ${COR_POR_TIPO[dica.tipo]}`}
      role="note"
      aria-label="Radar de Demanda FlashDeal"
    >
      {/* Botão fechar — opcional */}
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600 text-sm"
          aria-label="Fechar dica"
        >
          ✕
        </button>
      )}

      <div className="flex items-start gap-3">
        {/* Ícone do tipo */}
        <span className="text-xl shrink-0" aria-hidden>
          {ICONE_POR_TIPO[dica.tipo]}
        </span>

        <div className="flex-1 min-w-0">
          {/* Badge: dica personalizada vs genérica */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Radar de Demanda
            </span>
            {dica.personalizada && (
              <span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full">
                Para você
              </span>
            )}
          </div>

          {/* Texto da dica */}
          <p className="text-sm text-neutral-700 leading-snug">{dica.texto}</p>

          {/* CTA da dica */}
          {dica.acao && (
            <button
              onClick={onAcao}
              className="mt-3 text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors"
            >
              {dica.acao} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
// #endregion

export default DicaMotor;

// ============================================================
// FIM: src/components/pme/DicaMotor.tsx
// ============================================================
