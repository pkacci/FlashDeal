// ============================================================
// INÍCIO: src/pages/MinhasReservas.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, firebase/firestore,
//       firebase/functions, hooks/useAuth,
//       components/consumidor/ReservaCard,
//       components/common/EmptyState
// Descrição: Lista de reservas do consumidor com abas por status
//            — Ativas: confirmadas e pendentes
//            — Histórico: usadas, canceladas, expiradas
//            — onSnapshot para atualização em tempo real
//            — Cancelamento via Cloud Function cancelarReserva()
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../services/firebase';
import { Reserva } from '../types/reserva';
import useAuth from '../hooks/useAuth';
import ReservaCard from '../components/consumidor/ReservaCard';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region Types
type Aba = 'ativas' | 'historico';
// #endregion

// #region Component
const MinhasReservas: React.FC = () => {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>('ativas');

  // #region Listener em tempo real
  useEffect(() => {
    if (!usuario?.uid) return;

    const q = query(
      collection(db, 'reservas'),
      where('consumidorId', '==', usuario.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reserva));
      setReservas(lista);
      setLoading(false);
    });

    return () => unsub();
  }, [usuario?.uid]);
  // #endregion

  // #region Filtros por aba
  const ativas = reservas.filter((r) =>
    r.status === 'confirmado' || r.status === 'pendente'
  );
  const historico = reservas.filter((r) =>
    r.status === 'usado' || r.status === 'cancelado' || r.status === 'expirado'
  );
  const listaAtual = aba === 'ativas' ? ativas : historico;
  // #endregion

  // #region Cancelamento
  const handleCancelar = useCallback(async (reservaId: string) => {
    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, 'cancelarReserva');
      await fn({ reservaId, motivoCancelamento: 'Cancelado pelo consumidor' });
      // onSnapshot atualiza a lista automaticamente
    } catch {
      // Silencioso — ReservaCard pode tratar erro individualmente se necessário
    }
  }, []);
  // #endregion

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">

      {/* Header */}
      <header className="bg-white px-4 py-4 border-b border-neutral-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-neutral-500 text-sm">←</button>
          <p className="font-semibold text-neutral-800">Minhas Reservas</p>
        </div>

        {/* Abas */}
        <div className="flex gap-2">
          {(['ativas', 'historico'] as Aba[]).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                aba === a
                  ? 'bg-primary-500 text-white'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {a === 'ativas'
                ? `🟢 Ativas (${ativas.length})`
                : `📋 Histórico (${historico.length})`}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pt-4">
        {listaAtual.length === 0 ? (
          aba === 'ativas' ? (
            <EmptyState
              icone="🎫"
              titulo="Você não tem reservas ativas"
              subtitulo="Garanta uma oferta perto de você agora!"
              ctaLabel="🔍 Ver ofertas"
              onCta={() => navigate('/ofertas')}
            />
          ) : (
            <EmptyState
              icone="📋"
              titulo="Nenhuma reserva no histórico"
              subtitulo="Suas reservas usadas e canceladas aparecerão aqui."
            />
          )
        ) : (
          <div className="space-y-3">
            {listaAtual.map((reserva) => (
              <ReservaCard
                key={reserva.id}
                reserva={reserva}
                onCancelar={reserva.status === 'confirmado' ? handleCancelar : undefined}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
// #endregion

export default MinhasReservas;

// ============================================================
// FIM: src/pages/MinhasReservas.tsx
// ============================================================
