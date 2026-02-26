// ============================================================
// INÍCIO: src/components/pme/QRScanner.tsx
// Versão: 1.1.0 | Correção: ordem dos useCallback + props obrigatórias
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';

export interface QRScannerProps {
  onValidar?: (codigo: string) => void;
  onConfirmarEntrega?: (reservaId: string) => void;
}

type ScanStatus = 'idle' | 'scanning' | 'validando' | 'valido' | 'invalido';

interface VoucherResult {
  valido: boolean;
  reservaId?: string;
  ofertaTitulo?: string;
  consumidorNome?: string;
  valorPago?: number;
  motivo?: string;
}

const QRScanner: React.FC<QRScannerProps> = ({ onValidar, onConfirmarEntrega }) => {
  const { usuario } = useAuth();
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [codigoManual, setCodigoManual] = useState('');
  const [resultado, setResultado] = useState<VoucherResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  // #region Parar câmera — declarado ANTES de ser usado em deps
  const pararCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    setStatus('idle');
  }, []);
  // #endregion

  // #region Validar voucher via Cloud Function
  const handleValidar = useCallback(async (codigo: string) => {
    if (!usuario?.uid || !codigo.trim()) return;

    setStatus('validando');
    pararCamera();

    try {
      const fn = httpsCallable<{ codigo: string }, VoucherResult>(
        getFunctions(), 'validarVoucher'
      );
      const result = await fn({ codigo: codigo.trim().toUpperCase() });
      setResultado(result.data);
      setStatus(result.data.valido ? 'valido' : 'invalido');
      onValidar?.(codigo);
    } catch {
      setResultado({ valido: false, motivo: 'Erro ao validar. Tente novamente.' });
      setStatus('invalido');
    }
  }, [usuario?.uid, pararCamera, onValidar]);
  // #endregion

  // #region Iniciar câmera e scan
  const iniciarCamera = useCallback(async () => {
    setStatus('scanning');
    setErro(null);
    setResultado(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Importa jsQR dinamicamente
      const { default: jsQR } = await import('jsqr');

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const scanFrame = () => {
        if (!videoRef.current || !ctx) return;
        const { videoWidth: w, videoHeight: h } = videoRef.current;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, w, h);

        if (code?.data) {
          handleValidar(code.data);
          return;
        }

        animFrameRef.current = requestAnimationFrame(scanFrame);
      };

      animFrameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setErro('Câmera não disponível. Use o código manual.');
      setStatus('idle');
    }
  }, [handleValidar]);
  // #endregion

  // #region Confirmar entrega
  const handleConfirmarEntrega = useCallback(async () => {
    if (!resultado?.reservaId) return;

    try {
      const fn = httpsCallable(getFunctions(), 'confirmarEntrega');
      await fn({ reservaId: resultado.reservaId });
      onConfirmarEntrega?.(resultado.reservaId);
      setStatus('idle');
      setResultado(null);
    } catch {
      setErro('Erro ao confirmar. Tente novamente.');
    }
  }, [resultado, onConfirmarEntrega]);
  // #endregion

  // Cleanup ao desmontar
  useEffect(() => () => pararCamera(), [pararCamera]);

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Scanner de câmera */}
      {status === 'scanning' ? (
        <div className="relative">
          <video
            ref={videoRef}
            className="w-full rounded-2xl"
            playsInline
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 border-4 border-white/60 rounded-2xl" />
          </div>
          <button
            onClick={pararCamera}
            className="mt-3 w-full text-sm text-neutral-500 underline"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={iniciarCamera}
          className="btn-primary w-full py-4"
        >
          📷 Escanear QR Code
        </button>
      )}

      {erro && <p className="text-xs text-red-500 text-center">{erro}</p>}

      {/* Separador */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="text-xs text-neutral-400">ou</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      {/* Código manual */}
      <div className="flex gap-2">
        <input
          type="text"
          value={codigoManual}
          onChange={(e) => setCodigoManual(e.target.value.toUpperCase())}
          placeholder="FD-XXXXXXXX"
          maxLength={11}
          className="input flex-1 uppercase"
        />
        <button
          onClick={() => handleValidar(codigoManual)}
          disabled={codigoManual.length < 3 || status === 'validando'}
          className="btn-primary px-4 disabled:opacity-50"
        >
          {status === 'validando' ? '⏳' : '🔍'}
        </button>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className={`card p-4 ${resultado.valido ? 'border-success-300' : 'border-red-200'}`}>
          {resultado.valido ? (
            <>
              <p className="text-success-700 font-bold text-lg mb-3">✅ VOUCHER VÁLIDO</p>
              <p className="text-sm text-neutral-700">{resultado.ofertaTitulo}</p>
              <p className="text-sm text-neutral-500">Cliente: {resultado.consumidorNome}</p>
              <p className="text-sm text-neutral-500">
                Valor: R$ {resultado.valorPago?.toFixed(2)}
              </p>
              <button
                onClick={handleConfirmarEntrega}
                className="btn-primary w-full mt-4"
              >
                ✅ Confirmar Entrega
              </button>
            </>
          ) : (
            <>
              <p className="text-red-600 font-bold text-lg mb-2">❌ VOUCHER INVÁLIDO</p>
              <p className="text-sm text-neutral-500">{resultado.motivo}</p>
              <button
                onClick={() => { setResultado(null); setStatus('idle'); }}
                className="btn-primary w-full mt-4"
              >
                🔄 Tentar outro
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default QRScanner;

// ============================================================
// FIM: src/components/pme/QRScanner.tsx
// ============================================================
