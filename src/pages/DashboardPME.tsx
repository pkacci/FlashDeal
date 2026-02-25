// ============================================================
// INÍCIO: src/pages/DashboardPME.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, firebase/firestore,
//       hooks/useAuth,
//       components/pme/DashboardStats,
//       components/pme/OfertaAtiva,
//       components/pme/DicaMotor,
//       components/common/EmptyState
// Descrição: Painel principal da PME
//            — Métricas do dia em tempo real (onSnapshot)
//            — Lista de ofertas ativas
//            — Dica do Motor (Smart Template ou personalizada)
//            — Estado vazio com CTA para criar primeira oferta
//            — Indicador de limite do plano gratuito
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Oferta } from '../types/oferta';
import useAuth from '../hooks/useAuth';
import DashboardStats from '../components/pme/DashboardStats';
import OfertaAtiva from '../components/pme/OfertaAtiva';
import DicaMotor, { gerarDicaTemplate, Dica } from '../components/pme/DicaMotor';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region Types
interface MetricasDia {
  vendidoHoje: number;
  vendidoSemana: number;
  reservasAtivas: number;
  reservasHoje: number;
}
// #endregion

// #region Helpers
/** Verifica se um Timestamp é do dia de hoje */
const isHoje = (ts: Timestamp): boolean => {
  const d = ts.toDate();
  const hoje = new Date();
  return (
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear()
  );
};

/** Verifica se um Timestamp é desta semana (últimos 7 dias) */
const isSemana = (ts: Timestamp): boolean => {
  const diff = Date.now() - ts.toDate().getTime();
  return diff <= 7 * 24 * 60 * 60 * 1000;
};
// #endregion

// #region Component
const DashboardPME: React.FC = () => {
  const navigate = useNavigate();
  const { usuario, pmeData } = useAuth();

  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [metricas, setMetricas] = useState<MetricasDia>({
    vendidoHoje: 0,
    vendidoSemana: 0,
    reservasAtivas: 0,
    reservasHoje: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dica, setDica] = useState<Dica | null>(null);

  // #region Listener de ofertas ativas em tempo real
  useEffect(() => {
    if (!usuario?.uid) return;

    const q = query(
      collection(db, 'ofertas'),
      where('pmeId', '==', usuario.uid),
      where('ativa', '==', true),
      where('dataFim', '>', Timestamp.now()),
      orderBy('dataFim', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Oferta));
      setOfertas(lista);
      setLoading(false);
    });

    return () => unsub();
  }, [usuario?.uid]);
  // #endregion

  // #region Listener de reservas para métricas
  useEffect(() => {
    if (!usuario?.uid) return;

    const q = query(
      collection(db, 'reservas'),
      where('pmeId', '==', usuario.uid),
      where('status', 'in', ['confirmado', 'usado'])
    );

    const unsub = onSnapshot(q, (snap) => {
      let vendidoHoje = 0;
      let vendidoSemana = 0;
      let reservasAtivas = 0;
      let reservasHoje = 0;

      snap.forEach((d) => {
        const reserva = d.data();
        const confirmadoEm = reserva.dataConfirmacao as Timestamp | null;
        if (!confirmadoEm) return;

        if (isSemana(confirmadoEm)) vendidoSemana += reserva.valorPago ?? 0;
        if (isHoje(confirmadoEm)) {
          vendidoHoje += reserva.valorPago ?? 0;
          reservasHoje += 1;
        }
        if (reserva.status === 'confirmado') reservasAtivas += 1;
      });

      setMetricas({ vendidoHoje, vendidoSemana, reservasAtivas, reservasHoje });
    });

    return () => unsub();
  }, [usuario?.uid]);
  // #endregion

  // #region Gera dica do Motor ao montar
  useEffect(() => {
    if (!pmeData?.categoria) return;
    const agora = new Date();
    const dicaGerada = gerarDicaTemplate(
      pmeData.categoria,
      agora.getHours(),
      agora.getDay()
    );
    setDica(dicaGerada);
  }, [pmeData?.categoria]);
  // #endregion

  // #region Encerrar oferta antecipadamente
  const handleEncerrar = useCallback(async (ofertaId: string) => {
    try {
      await updateDoc(doc(db, 'ofertas', ofertaId), {
        ativa: false,
        updatedAt: Timestamp.now(),
      });
    } catch {
      // Silencioso — onSnapshot reflete mudança automaticamente
    }
  }, []);
  // #endregion

  // Calcula vendido por oferta com base nas reservas (simplificado)
  // Em produção, manter campo denormalizado na oferta
  const getVendidoPorOferta = (oferta: Oferta): number => {
    const vendidas = oferta.quantidadeTotal - oferta.quantidadeDisponivel;
    return vendidas * oferta.valorOferta;
  };

  const planoGratuito = pmeData?.plano === 'free';
  const ofertasCriadas = pmeData?.ofertasCriadas ?? 0;
  const limiteOfertas = pmeData?.limiteOfertas ?? 10;
  const percLimite = Math.round((ofertasCriadas / limiteOfertas) * 100);

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">

      {/* Header */}
      <header className="bg-white px-4 py-4 border-b border-neutral-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-400">Bem-vindo,</p>
          <p className="font-bold text-neutral-800">{pmeData?.nomeFantasia ?? 'sua empresa'}</p>
        </div>
        <button
          onClick={() => navigate('/perfil')}
          className="w-9 h-9 bg-neutral-100 rounded-full flex items-center justify-center text-sm"
        >
          👤
        </button>
      </header>

      <main className="px-4 pt-4 space-y-4">

        {/* Métricas */}
        <DashboardStats
          vendidoHoje={metricas.vendidoHoje}
          vendidoSemana={metricas.vendidoSemana}
          reservasAtivas={metricas.reservasAtivas}
          reservasHoje={metricas.reservasHoje}
        />

        {/* Botão criar oferta */}
        <button
          onClick={() => navigate('/criar-oferta')}
          className="btn-primary w-full py-4 text-base font-bold"
        >
          ➕ Criar nova oferta
        </button>

        {/* Dica do Motor */}
        {dica && (
          <DicaMotor
            dica={dica}
            onAcao={() => navigate('/criar-oferta')}
            onDismiss={() => setDica(null)}
          />
        )}

        {/* Indicador de limite — plano gratuito */}
        {planoGratuito && (
          <div className="card p-3">
            <div className="flex justify-between text-xs text-neutral-500 mb-1">
              <span>Plano Gratuito — {ofertasCriadas}/{limiteOfertas} ofertas este mês</span>
              <span>{percLimite}%</span>
            </div>
            <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${
                  percLimite >= 80 ? 'bg-red-400' : 'bg-primary-500'
                }`}
                style={{ width: `${percLimite}%` }}
              />
            </div>
            {percLimite >= 80 && (
              <button
                onClick={() => navigate('/perfil')}
                className="text-xs text-primary-500 font-semibold"
              >
                ⬆️ Upgrade PRO — R$49/mês →
              </button>
            )}
          </div>
        )}

        {/* Lista de ofertas ativas */}
        <div>
          <p className="text-sm font-semibold text-neutral-700 mb-3">
            Ofertas ativas ({ofertas.length})
          </p>

          {ofertas.length === 0 ? (
            <EmptyState
              icone="🚀"
              titulo="Crie sua primeira oferta"
              subtitulo="E comece a vender hoje!"
              ctaLabel="➕ Criar minha primeira oferta"
              onCta={() => navigate('/criar-oferta')}
            />
          ) : (
            <div className="space-y-3">
              {ofertas.map((oferta) => (
                <OfertaAtiva
                  key={oferta.id}
                  oferta={oferta}
                  vendidoTotal={getVendidoPorOferta(oferta)}
                  onEncerrar={handleEncerrar}
                />
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
};
// #endregion

export default DashboardPME;

// ============================================================
// FIM: src/pages/DashboardPME.tsx
// ============================================================
