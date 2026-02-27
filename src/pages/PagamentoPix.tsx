// ============================================================
// INÍCIO: src/pages/PagamentoPix.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, firebase/functions,
//       firebase/firestore, hooks/useAuth
// Descrição: Tela de pagamento via Pix após reserva
//            — Chama Cloud Function gerarPix() server-side
//            — Exibe QR Code + código copia-e-cola
//            — Timer de 10 minutos para expiração do Pix
//            — Listener onSnapshot para detectar confirmação
//            — Polling backup a cada 5s (fallback do listener)
//            — Ao confirmar: redireciona para /voucher/:id
// ============================================================

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import useAuth from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region Types
interface GerarPixResponse {
  reservaId: string;
  pixQrCode: string;       // String QR Code (base64 ou payload)
  pixCopiaCola: string;    // Código copia-e-cola
  expiraEm: number;        // Timestamp Unix (ms)
}
// #endregion

// #region Constantes
const PIX_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos
const POLLING_INTERVAL_MS = 5_000;     // 5 segundos
// #endregion

// #region Helpers
const formatTimer = (ms: number): string => {
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
// #endregion

// #region Component
const PagamentoPix: React.FC = () => {
  const { ofertaId } = useParams<{ ofertaId: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [pixData, setPixData] = useState<GerarPixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [timerMs, setTimerMs] = useState(PIX_TIMEOUT_MS);
  const [copiado, setCopiado] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // #region Limpar listeners ao desmontar
  const limparTudo = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (unsubRef.current) unsubRef.current();
  }, []);

  useEffect(() => () => limparTudo(), [limparTudo]);
  // #endregion

  // #region Inicia listener + polling após obter reservaId
  const iniciarMonitoramento = useCallback((reservaId: string) => {
    // Listener Firestore (principal)
    const unsub = onSnapshot(doc(db, 'reservas', reservaId), (snap) => {
      const status = snap.data()?.status;
      if (status === 'confirmado') {
        limparTudo();
        navigate(`/voucher/${reservaId}`, { replace: true });
      }
    });
    unsubRef.current = unsub;

    // Polling backup a cada 5s (fallback caso listener falhe)
    pollingRef.current = setInterval(async () => {
      const snap = await import('firebase/firestore').then(({ getDoc }) =>
        getDoc(doc(db, 'reservas', reservaId))
      );
      if (snap.data()?.status === 'confirmado') {
        limparTudo();
        navigate(`/voucher/${reservaId}`, { replace: true });
      }
    }, POLLING_INTERVAL_MS);

    // Timer regressivo visual (10 minutos)
    const inicio = Date.now();
    timerRef.current = setInterval(() => {
      const restante = PIX_TIMEOUT_MS - (Date.now() - inicio);
      if (restante <= 0) {
        limparTudo();
        setErro('O Pix expirou. Tente novamente.');
        setTimerMs(0);
      } else {
        setTimerMs(restante);
      }
    }, 1000);
  }, [navigate, limparTudo]);
  // #endregion

  // #region Chama Cloud Function gerarPix ao montar
  useEffect(() => {
    if (!ofertaId || !usuario) return;

    const gerarPix = async () => {
      try {
        const functions = getFunctions();
        const fn = httpsCallable<{ ofertaId: string }, GerarPixResponse>(
          functions,
          'gerarPix'
        );
        const result = await fn({ ofertaId });
        setPixData(result.data);
        iniciarMonitoramento(result.data.reservaId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro ao gerar Pix.';
        // Mensagens amigáveis para erros comuns
        if (msg.includes('quantidade')) {
          setErro('Essa oferta esgotou agora. Tente outra!');
        } else {
          setErro('Não foi possível gerar o Pix. Tente novamente.');
        }
      } finally {
        setLoading(false);
      }
    };

    gerarPix();
  }, [ofertaId, usuario, iniciarMonitoramento]);
  // #endregion

  // #region Copiar código copia-e-cola
  const handleCopiar = async () => {
    if (!pixData?.pixCopiaCola) return;
    await navigator.clipboard.writeText(pixData.pixCopiaCola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };
  // #endregion

  if (loading) return <LoadingSpinner fullscreen />;

  if (erro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-4">❌</p>
        <p className="text-lg font-bold text-neutral-800 mb-2">Algo deu errado</p>
        <p className="text-sm text-neutral-500 mb-6">{erro}</p>
        <button onClick={() => navigate(-1)} className="btn-primary">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-neutral-100">
        <button onClick={() => navigate(-1)} className="text-neutral-500 text-sm">←</button>
        <p className="font-semibold text-neutral-800">Pagamento Pix</p>
      </header>

      <main className="px-6 py-8 flex flex-col items-center">

        {/* QR Code */}
        <div className="card p-6 w-full max-w-xs text-center mb-6">
          {pixData?.pixQrCode ? (
            <img
              src={pixData.pixQrCode.startsWith('data:') ? pixData.pixQrCode : `data:image/png;base64,${pixData.pixQrCode}`}
              alt="QR Code Pix"
              className="w-48 h-48 mx-auto mb-4"
            />
          ) : (
            // Sandbox: sem QR Code real — orienta usar copia-e-cola
            <div className="w-48 h-48 bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-xl mx-auto mb-4 flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">📋</span>
              <p className="text-xs text-neutral-400 text-center px-2">Use o código copia-e-cola abaixo</p>
            </div>
          )}

          {/* Timer */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-sm text-neutral-500">⏱ Expira em</span>
            <span className={`text-lg font-bold tabular-nums ${timerMs < 60000 ? 'text-red-500' : 'text-neutral-800'}`}>
              {formatTimer(timerMs)}
            </span>
          </div>

          <p className="text-xs text-neutral-400">
            Abra o app do seu banco e escaneie o QR Code
          </p>
        </div>

        {/* Copia e cola */}
        <button
          onClick={handleCopiar}
          className={`w-full max-w-xs py-3 rounded-xl border-2 font-medium text-sm transition-colors mb-6
            ${copiado
              ? 'border-success-500 text-success-500 bg-green-50'
              : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'}`}
        >
          {copiado ? '✅ Código copiado!' : '📋 Copiar código Pix'}
        </button>

        {/* Instrução */}
        <div className="text-center max-w-xs">
          <p className="text-sm text-neutral-500 mb-1">
            Abra o app do seu banco, escaneie o QR ou cole o código.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <LoadingSpinner size="sm" />
            <p className="text-sm text-neutral-400">Aguardando pagamento...</p>
          </div>
        </div>

      </main>
    </div>
  );
};
// #endregion

export default PagamentoPix;

// ============================================================
// FIM: src/pages/PagamentoPix.tsx
// ============================================================
