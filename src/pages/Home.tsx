// ============================================================
// INÍCIO: src/pages/Home.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom
// Descrição: Landing page pública do FlashDeal
//            — Hero com 2 CTAs: consumidor → /ofertas, PME → /login?role=pme
//            — Seção "Como funciona" (3 passos visuais)
//            — Seção de convencimento para PMEs
//            — Zero dependências externas — sem Firebase aqui
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';

// #region Dados estáticos
const PASSOS = [
  { icone: '📍', titulo: 'Encontre', desc: 'Ofertas relâmpago perto de você, em tempo real.' },
  { icone: '💳', titulo: 'Pague',    desc: 'Garanta com Pix em segundos. Confirmação instantânea.' },
  { icone: '🎫', titulo: 'Aproveite', desc: 'Mostre o QR Code na loja e aproveite o desconto.' },
];

const BENEFICIOS_PME = [
  '10 ofertas grátis por mês — sem cartão',
  'Cadastro em 3 minutos com IA',
  'Receba Pix direto, sem intermediários',
  'IA cria a oferta pra você',
];
// #endregion

// #region Component
const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">

      {/* Header mínimo */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-neutral-100">
        <span className="text-xl font-bold text-primary-500">⚡ FlashDeal</span>
        <button
          onClick={() => navigate('/login')}
          className="text-sm text-neutral-600 font-medium hover:text-primary-500 transition-colors"
        >
          Entrar
        </button>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-16 min-h-[80vh]">
        <div className="max-w-sm mx-auto">
          <h1 className="text-3xl font-bold text-neutral-800 leading-tight mb-3">
            Ofertas relâmpago{' '}
            <span className="text-primary-500">perto de você</span>
          </h1>
          <p className="text-neutral-500 mb-10 leading-relaxed">
            Economize até 60% em restaurantes, salões, academias e muito mais.
            Pague com Pix e use na hora.
          </p>

          <button
            onClick={() => navigate('/ofertas')}
            className="btn-primary w-full py-4 text-base font-bold mb-3"
          >
            🔍 Ver ofertas perto de mim
          </button>

          <button
            onClick={() => navigate('/login?role=pme')}
            className="w-full py-4 text-base font-semibold border-2 border-neutral-200 rounded-xl text-neutral-700 hover:border-primary-300 transition-colors"
          >
            🏪 Sou PME — começar grátis
          </button>
        </div>
      </section>

      {/* Como funciona */}
      <section className="px-6 py-12 bg-neutral-50">
        <h2 className="text-lg font-bold text-neutral-800 text-center mb-8">
          Como funciona
        </h2>
        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
          {PASSOS.map((passo) => (
            <div key={passo.titulo} className="text-center">
              <div className="text-3xl mb-2">{passo.icone}</div>
              <p className="text-sm font-semibold text-neutral-700 mb-1">{passo.titulo}</p>
              <p className="text-xs text-neutral-400 leading-snug">{passo.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Convencimento PME */}
      <section className="px-6 py-12">
        <div className="max-w-sm mx-auto card p-6">
          <h2 className="text-lg font-bold text-neutral-800 mb-2">
            Cadastre em 3 minutos.{' '}
            <span className="text-primary-500">Venda em segundos.</span>
          </h2>
          <p className="text-sm text-neutral-500 mb-5">
            Para restaurantes, salões, academias e qualquer negócio local.
          </p>
          <ul className="space-y-2 mb-6">
            {BENEFICIOS_PME.map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm text-neutral-700">
                <span className="text-success-500 font-bold shrink-0">✓</span>
                {b}
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate('/login?role=pme')}
            className="btn-primary w-full"
          >
            Começar grátis agora
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center px-6 py-8 border-t border-neutral-100">
        <p className="text-xs text-neutral-400">
          © 2026 FlashDeal ·{' '}
          <button className="underline hover:text-neutral-600">Termos</button>
          {' · '}
          <button className="underline hover:text-neutral-600">Privacidade</button>
        </p>
      </footer>

    </div>
  );
};
// #endregion

export default Home;

// ============================================================
// FIM: src/pages/Home.tsx
// ============================================================
