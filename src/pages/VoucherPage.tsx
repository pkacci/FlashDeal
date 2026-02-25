// ============================================================
// INÍCIO: src/pages/VoucherPage.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, firebase/firestore,
//       firebase/functions, hooks/useAuth
// Descrição: Tela de voucher confirmado do consumidor
//            — Exibe QR Code grande para mostrar na loja
//            — Código alfanumérico legível (FD-XXXXXXXX)
//            — Botão "Como chegar" abre Maps nativo
//            — Botão "Cancelar reserva" com confirmação
//            — Regra de cancelamento: até 30min antes da expiração
// ============================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../services/firebase';
import { Reserva } from '../types/reserva';
import useAuth from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region Component
const VoucherPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erroCancelamento, setErroCancelamento] = useState<string | null>(null);

  // #region Listener da reserva em tempo real
  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(doc(db, 'reservas', id), (snap) => {
      if (snap.exists()) {
        setReserva({ id: snap.id, ...snap.data() } as Reserva);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [id]);
  // #endregion

  // #region Cancelamento
  const handleCancelar = async () => {
    if (!id) return;
    setCancelando(true);
    setErroCancelamento(null);

    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, 'cancelarReserva');
      await fn({ reservaId: id, motivoCancelamento: motivo || 'Cancelado pelo consumidor' });
      // onSnapshot detecta mudança e atualiza status automaticamente
      setShowConfirmCancel(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('prazo')) {
        setErroCancelamento('Cancelamento não permitido: prazo encerrado (< 30min antes da expiração).');
      } else {
        setErroCancelamento('Não foi possível cancelar. Tente novamente.');
      }
    } finally {
      setCancelando(false);
    }
  };
  // #endregion

  // #region Como chegar — abre Maps nativo
  const handleComoChegar = () => {
    if (!reserva?.pmeEndereco) return;
    const { rua, numero, cidade, estado } = reserva.pmeEndereco as Record<string, string>;
    const endereco = encodeURIComponent(`${rua} ${numero}, ${cidade} ${estado}`);
    // Abre Google Maps app no mobile, fallback para web
    window.open(`https://maps.google.com/?q=${endereco}`, '_blank');
  };
  // #endregion

  if (loading) return <LoadingSpinner fullscreen />;

  if (!reserva) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-4">😕</p>
        <p className="font-semibold text-neutral-700 mb-4">Voucher não encontrado</p>
        <button onClick={() => navigate('/minhas-reservas')} className="btn-primary">
          Minhas reservas
        </button>
      </div>
    );
  }

  // Verifica se pertence ao usuário logado
  if (reserva.consumidorId !== usuario?.uid) {
    navigate('/ofertas', { replace: true });
    return null;
  }

  const podeCancelar =
    reserva.status === 'confirmado' &&
    reserva.ofertaDataFim &&
    (reserva.ofertaDataFim.toDate().getTime() - Date.now()) > 30 * 60 * 1000;

  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <header className={`text-center py-6 ${
        reserva.status === 'confirmado' ? 'bg-green-50' :
        reserva.status === 'usado' ? 'bg-neutral-100' : 'bg-red-50'
      }`}>
        <p className="text-3xl mb-1">
          {reserva.status === 'confirmado' ? '✅' :
           reserva.status === 'usado' ? '☑️' : '❌'}
        </p>
        <p className={`text-lg font-bold ${
          reserva.status === 'confirmado' ? 'text-green-700' :
          reserva.status === 'usado' ? 'text-neutral-500' : 'text-red-600'
        }`}>
          {reserva.status === 'confirmado' ? 'CONFIRMADO!' :
           reserva.status === 'usado' ? 'UTILIZADO' : 'CANCELADO'}
        </p>
      </header>

      <main className="px-6 py-6 space-y-6">

        {/* QR Code */}
        {reserva.status === 'confirmado' && (
          <div className="card p-6 text-center">
            {reserva.voucherQrCode ? (
              <img
                src={reserva.voucherQrCode}
                alt="QR Code do voucher"
                className="w-48 h-48 mx-auto mb-4"
              />
            ) : (
              <div className="w-48 h-48 bg-neutral-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <p className="text-neutral-400 text-sm">QR Code</p>
              </div>
            )}
            <p className="text-xs text-neutral-400 mb-1">Código</p>
            <p className="font-mono text-lg font-bold text-neutral-800 tracking-widest">
              {reserva.voucherCodigo}
            </p>
          </div>
        )}

        {/* Detalhes da reserva */}
        <div className="card p-4 space-y-2">
          <p className="font-semibold text-neutral-800">{reserva.ofertaTitulo}</p>
          {reserva.pmeNome && (
            <p className="text-sm text-neutral-500">{reserva.pmeNome}</p>
          )}
          {reserva.pmeEndereco && (
            <p className="text-xs text-neutral-400">
              {(reserva.pmeEndereco as Record<string, string>).rua},{' '}
              {(reserva.pmeEndereco as Record<string, string>).numero} —{' '}
              {(reserva.pmeEndereco as Record<string, string>).bairro},{' '}
              {(reserva.pmeEndereco as Record<string, string>).cidade}
            </p>
          )}
          <p className="text-sm text-neutral-600">
            Valor pago:{' '}
            <span className="font-bold">
              R$ {reserva.valorPago.toFixed(2)}
            </span>
          </p>
        </div>

        {/* Instrução */}
        {reserva.status === 'confirmado' && (
          <p className="text-sm text-neutral-500 text-center">
            Mostre este QR Code na loja para retirar sua oferta.
          </p>
        )}

        {/* CTAs */}
        <div className="space-y-3">
          {reserva.pmeEndereco && (
            <button onClick={handleComoChegar} className="w-full py-3 border-2 border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 hover:border-neutral-300 transition-colors">
              📍 Como chegar
            </button>
          )}

          {podeCancelar && !showConfirmCancel && (
            <button
              onClick={() => setShowConfirmCancel(true)}
              className="w-full py-3 text-sm text-red-400 border border-red-100 rounded-xl hover:bg-red-50 transition-colors"
            >
              ❌ Cancelar reserva
            </button>
          )}
        </div>

        {/* Modal de confirmação de cancelamento */}
        {showConfirmCancel && (
          <div className="card p-4 border-2 border-red-200 space-y-3">
            <p className="text-sm font-semibold text-neutral-700">
              Cancelar esta reserva?
            </p>
            <p className="text-xs text-neutral-400">
              O reembolso de R$ {reserva.valorPago.toFixed(2)} será feito pela {reserva.pmeNome} via Pix.
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (opcional)"
              rows={2}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-300 resize-none"
            />
            {erroCancelamento && (
              <p className="text-xs text-red-500">{erroCancelamento}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowConfirmCancel(false); setErroCancelamento(null); }}
                className="flex-1 py-2 text-sm border border-neutral-200 rounded-lg text-neutral-600"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelar}
                disabled={cancelando}
                className="flex-1 py-2 text-sm bg-red-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {cancelando ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/minhas-reservas')}
          className="w-full text-sm text-neutral-400 py-2"
        >
          Ver todas as reservas
        </button>

      </main>
    </div>
  );
};
// #endregion

export default VoucherPage;

// ============================================================
// FIM: src/pages/VoucherPage.tsx
// ============================================================
