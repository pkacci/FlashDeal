// ============================================================
// INÍCIO: src/pages/Home.tsx
// Versão: 2.1.0 | Data: 2026-02-27
// Deps: React, react-router-dom, firebase/firestore
// v2.1: rebrand LiquiBairro + imports restaurados
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../services/firebase';

// #region Dados estáticos
const PASSOS = [
  { icone: '📍', titulo: 'Encontre', desc: 'Ofertas relâmpago perto de você, em tempo real.' },
  { icone: '💳', titulo: 'Pague',    desc: 'Garanta com Pix em segundos. Confirmação instantânea.' },
  { icone: '🎫', titulo: 'Aproveite', desc: 'Mostre o QR Code na loja e aproveite o desconto.' },
];

const BENEFICIOS_PME = [
  '10 ofertas grátis por mês — sem cartão de crédito',
  'Ative seu negócio em 3 minutos, sem burocracia',
  'Receba Pix direto, sem intermediários',
  'Fórmulas de Venda prontas — publique em 60 segundos',
];

const PROVAS_SOCIAIS = [
  { icone: '🍕', texto: 'Restaurantes lotam horários mortos' },
  { icone: '💇', texto: 'Salões preenchem agenda vazia' },
  { icone: '💪', texto: 'Academias vendem aulas experimentais' },
];
// #endregion


// #region Component
const Home: React.FC = () => {
  const navigate = useNavigate();
  const [ofertasAtivas, setOfertasAtivas] = useState<number | null>(null);

  useEffect(() => {
    const buscarContador = async () => {
      try {
        const q = query(
          collection(db, 'ofertas'),
          where('ativa', '==', true)
        );
        const snap = await getCountFromServer(q);
        setOfertasAtivas(snap.data().count);
      } catch {
        setOfertasAtivas(null);
      }
    };
    buscarContador();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-4 border-b border-neutral-100">
        <span className="text-xl font-bold text-primary-500">⚡ LiquiBairro</span>
        <button
          onClick={() => navigate('/login')}
          className="text-sm text-neutral-600 font-medium hover:text-primary-500 transition-colors"
        >
          Entrar
        </button>
      </header>

      <section className="flex flex-col items-center justify-center text-center px-6 py-16 min-h-[80vh]">
        <div className="max-w-sm mx-auto">
          {ofertasAtivas !== null && ofertasAtivas > 0 && (
            <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-primary-600">
                {ofertasAtivas} {ofertasAtivas === 1 ? 'oferta ativa' : 'ofertas ativas'} agora
              </span>
            </div>
          )}
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
            🏪 Crie sua primeira oferta em 3 minutos
          </button>
        </div>
      </section>

      <section className="px-6 py-12 bg-neutral-50">
        <h2 className="text-lg font-bold text-neutral-800 text-center mb-8">Como funciona</h2>
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

      <section className="px-6 py-10">
        <p className="text-center text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-6">
          Negócios que já vendem mais rápido
        </p>
        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          {PROVAS_SOCIAIS.map((p) => (
            <div key={p.texto} className="flex items-center gap-3 bg-neutral-50 rounded-xl px-4 py-3">
              <span className="text-2xl">{p.icone}</span>
              <p className="text-sm text-neutral-700 font-medium">{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-12 bg-neutral-50">
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
          <button onClick={() => navigate('/login?role=pme')} className="btn-primary w-full">
            Começar grátis agora
          </button>
        </div>
      </section>

      <footer className="text-center px-6 py-8 border-t border-neutral-100">
        <p className="text-xs text-neutral-400">
          © 2026 LiquiBairro ·{' '}
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
