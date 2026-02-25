// ============================================================
// INÍCIO: src/components/pme/QRScanner.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React
// Descrição: Scanner de QR Code para validação de vouchers PME
//            — Usa jsQR via câmera do dispositivo (mobile-first)
//            — Fallback: input manual do código
//            — Validação server-side via Cloud Function validarVoucher()
// NOTA: jsQR deve ser instalado: npm install jsqr
//       Alternativa zero-cost: html5-qrcode (mais pesado)
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';

// #region Types
export type ResultadoValidacao =
  | { status: 'valido'; codigo: string; titulo: string; consumidorNome: string; valorPago: number }
  | { status: 'invalido'; motivo: string }
  | { status: 'erro'; mensagem: string };

interface QRScannerProps {
  onValidar: (codigo: string) => Promise<ResultadoValidacao>;
  onConfirmarEntrega: (codigo: string) => Promise<void>;
}
// #endregion

// #region Estado da tela
type TelaEstado = 'scanner' | 'resultado_valido' | 'resultado_invalido' | 'confirmado';
// #endregion

// #region Component
const QRScanner: React.FC<QRScannerProps> = ({ onValidar, onConfirmarEntrega }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const [tela, setTela] = useState<TelaEstado>('scanner');
  const [codigoManual, setCodigoManual] = useState('');
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
  const [codigoAtual, setCodigoAtual] = useState('');
  const [loading, setLoading] = useState(false);
  const [erroCamera, setErroCamera] = useState(false);
  const [scanAtivo, setScanAtivo] = useState(false);

  // #region Câmera
  /** Inicia stream de câmera traseira */
  const iniciarCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Câmera traseira
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanAtivo(true);
        setErroCamera(false);
      }
    } catch {
      // Sem câmera ou permissão negada → mostra fallback manual
      setErroCamera(true);
    }
  }, []);

  /** Para o stream de câmera e o loop de scan */
  const pararCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanAtivo(false);
  }, []);
  // #endregion

  // #region Loop de scan via jsQR
  /**
   * Loop de captura de frame do vídeo e leitura do QR Code
   * NOTA: jsQR é importado dinamicamente para não bloquear bundle inicial
   */
  const iniciarScanLoop = useCallback(() => {
    const scan = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animFrameRef.current = requestAnimationFrame(scan);
        return;
      }

      // Captura frame
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Tenta ler QR Code
      try {
        // Import dinâmico — não bloqueia carregamento inicial
        const jsQR = (await import('jsqr')).default;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(imageData.data, canvas.width, canvas.height);

        if (qr?.data) {
          pararCamera();
          await handleValidar(qr.data);
          return; // Para o loop após detectar
        }
      } catch {
        // jsQR não instalado ou erro de leitura — continua tentando
      }

      // Continua o loop
      animFrameRef.current = requestAnimationFrame(scan);
    };

    animFrameRef.current = requestAnimationFrame(scan);
  }, [pararCamera, handleValidar]); // handleValidar é useCallback — deps corretas
  // #endregion

  // #region Ciclo de vida da câmera
  useEffect(() => {
    iniciarCamera();
    return () => pararCamera(); // Limpa ao desmontar
  }, [iniciarCamera, pararCamera]);

  // Inicia loop de scan quando câmera estiver ativa
  useEffect(() => {
    if (scanAtivo) iniciarScanLoop();
  }, [scanAtivo, iniciarScanLoop]);
  // #endregion

  // #region Handlers
  /** Chama Cloud Function para validar o código */
  const handleValidar = useCallback(async (codigo: string) => {
    setLoading(true);
    setCodigoAtual(codigo);
    try {
      const res = await onValidar(codigo);
      setResultado(res);
      setTela(res.status === 'valido' ? 'resultado_valido' : 'resultado_invalido');
    } catch {
      setResultado({ status: 'erro', mensagem: 'Erro de conexão. Tente novamente.' });
      setTela('resultado_invalido');
    } finally {
      setLoading(false);
    }
  }, [onValidar]);

  /** Confirma entrega do voucher válido → atualiza status para 'usado' */
  const handleConfirmar = async () => {
    setLoading(true);
    try {
      await onConfirmarEntrega(codigoAtual);
      setTela('confirmado');
    } catch {
      // Erro silencioso — PME ainda pode tentar novamente
    } finally {
      setLoading(false);
    }
  };

  /** Reseta para novo scan — para câmera antes de reiniciar para evitar duplo stream */
  const handleNovoScan = () => {
    pararCamera(); // Garante que stream anterior foi encerrado
    setTela('scanner');
    setResultado(null);
    setCodigoManual('');
    setCodigoAtual('');
    iniciarCamera();
  };
  // #endregion

  // #region Renders condicionais
  if (tela === 'confirmado') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-neutral-800 mb-2">Entrega Confirmada!</h2>
        <p className="text-neutral-500 mb-6">Voucher marcado como utilizado.</p>
        <button onClick={handleNovoScan} className="btn-primary">
          Escanear Próximo
        </button>
      </div>
    );
  }

  if (tela === 'resultado_valido' && resultado?.status === 'valido') {
    return (
      <div className="space-y-4">
        {/* Card verde — voucher válido */}
        <div className="card p-5 border-2 border-green-400 bg-green-50">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">✅</div>
            <h2 className="text-lg font-bold text-green-700">VOUCHER VÁLIDO</h2>
          </div>
          <div className="space-y-2 text-sm text-neutral-700">
            <p>
              <span className="font-medium">Oferta:</span> {resultado.titulo}
            </p>
            <p>
              <span className="font-medium">Cliente:</span> {resultado.consumidorNome}
            </p>
            <p>
              <span className="font-medium">Valor pago:</span> R${' '}
              {resultado.valorPago.toFixed(2)}
            </p>
            <p>
              <span className="font-medium">Código:</span>{' '}
              <code className="bg-white px-2 py-0.5 rounded border">{resultado.codigo}</code>
            </p>
          </div>
        </div>

        <button
          onClick={handleConfirmar}
          disabled={loading}
          className="btn-primary w-full py-3"
        >
          {loading ? 'Confirmando...' : '✅ Confirmar Entrega'}
        </button>
        <button
          onClick={handleNovoScan}
          className="w-full text-sm text-neutral-500 py-2"
        >
          ❌ Reportar Problema
        </button>
      </div>
    );
  }

  if (tela === 'resultado_invalido') {
    const motivo =
      resultado?.status === 'invalido'
        ? resultado.motivo
        : resultado?.status === 'erro'
        ? resultado.mensagem
        : 'Código inválido';

    return (
      <div className="space-y-4">
        {/* Card vermelho — voucher inválido */}
        <div className="card p-5 border-2 border-red-300 bg-red-50 text-center">
          <div className="text-4xl mb-2">❌</div>
          <h2 className="text-lg font-bold text-red-700 mb-1">VOUCHER INVÁLIDO</h2>
          <p className="text-sm text-neutral-600">{motivo}</p>
        </div>
        <button onClick={handleNovoScan} className="btn-primary w-full">
          🔄 Escanear Outro
        </button>
      </div>
    );
  }
  // #endregion

  // #region Tela principal: Scanner
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500 text-center">
        Aponte a câmera para o QR Code do cliente
      </p>

      {/* Viewfinder da câmera */}
      {!erroCamera ? (
        <div className="relative aspect-square bg-neutral-900 rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            aria-label="Câmera para scan de QR Code"
          />
          {/* Canvas oculto usado para captura de frame */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Guia visual — moldura de mira */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-white rounded-lg opacity-70" />
          </div>

          {loading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <p className="text-white text-sm">Validando...</p>
            </div>
          )}
        </div>
      ) : (
        /* Câmera indisponível: mostra aviso */
        <div className="aspect-square bg-neutral-100 rounded-xl flex flex-col items-center justify-center text-neutral-400 p-6 text-center">
          <span className="text-4xl mb-3">📷</span>
          <p className="text-sm">Câmera não disponível.</p>
          <p className="text-xs mt-1">Use o campo abaixo para digitar o código.</p>
        </div>
      )}

      {/* Separador */}
      <div className="flex items-center gap-3">
        <hr className="flex-1 border-neutral-200" />
        <span className="text-xs text-neutral-400">ou</span>
        <hr className="flex-1 border-neutral-200" />
      </div>

      {/* Fallback: input manual */}
      <div className="flex gap-2">
        <input
          type="text"
          value={codigoManual}
          onChange={(e) => setCodigoManual(e.target.value.toUpperCase())}
          placeholder="FD-XXXXXXXX"
          maxLength={11}
          className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && codigoManual.length >= 8) {
              handleValidar(codigoManual);
            }
          }}
        />
        <button
          onClick={() => handleValidar(codigoManual)}
          disabled={codigoManual.length < 8 || loading}
          className="btn-primary px-4 text-sm disabled:opacity-50"
        >
          {loading ? '...' : '🔍'}
        </button>
      </div>
    </div>
  );
  // #endregion
};
// #endregion

export default QRScanner;

// ============================================================
// FIM: src/components/pme/QRScanner.tsx
// ============================================================
