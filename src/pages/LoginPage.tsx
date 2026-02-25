// ============================================================
// INÍCIO: src/pages/LoginPage.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, firebase/auth, AuthContext
// Descrição: Tela de login/cadastro unificada
//            — Google Sign-In (1 toque)
//            — Phone Auth com SMS (fallback)
//            — Contexto por query param: ?role=pme redireciona ao onboarding
//            — Late Auth: preserva ofertaId no estado de navegação
//            — Após auth: redireciona por role (PME → /onboarding-ia ou /dashboard)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import useAuth from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region Types
type EtapaPhone = 'numero' | 'codigo';
// #endregion

// #region Component
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { usuario, role, loading: authLoading } = useAuth();

  const rolePretendido = searchParams.get('role'); // 'pme' ou null
  // Estado de navegação preservado pelo Late Auth (LoginModal)
  const ofertaIdRetorno = (location.state as { ofertaId?: string } | null)?.ofertaId;

  const [etapa, setEtapa] = useState<EtapaPhone>('numero');
  const [telefone, setTelefone] = useState('');
  const [codigoSMS, setCodigoSMS] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reenvioTimer, setReenvioTimer] = useState(0);

  // #region Redirecionamento pós-auth
  // Se já está logado, redireciona imediatamente
  useEffect(() => {
    if (authLoading || !usuario) return;

    if (ofertaIdRetorno) {
      // Late Auth: volta para a oferta que estava vendo
      navigate(`/oferta/${ofertaIdRetorno}`, { replace: true });
    } else if (role === 'pme') {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/ofertas', { replace: true });
    }
  }, [usuario, role, authLoading, ofertaIdRetorno, navigate]);
  // #endregion

  // #region Timer de reenvio de SMS
  useEffect(() => {
    if (reenvioTimer <= 0) return;
    const t = setInterval(() => setReenvioTimer((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [reenvioTimer]);
  // #endregion

  // #region Google Sign-In
  const handleGoogle = async () => {
    setErro(null);
    setLoadingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // useEffect acima cuida do redirect
    } catch {
      setErro('Não foi possível entrar com Google. Tente novamente.');
    } finally {
      setLoadingGoogle(false);
    }
  };
  // #endregion

  // #region Phone Auth — Etapa 1: enviar SMS
  const handleEnviarSMS = async () => {
    if (telefone.length < 10) {
      setErro('Informe um número de telefone válido.');
      return;
    }
    setErro(null);
    setLoadingPhone(true);

    try {
      // reCAPTCHA invisível — obrigatório pelo Firebase Phone Auth
      const recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });

      const numeroFormatado = `+55${telefone.replace(/\D/g, '')}`;
      const result = await signInWithPhoneNumber(auth, numeroFormatado, recaptcha);
      setConfirmationResult(result);
      setEtapa('codigo');
      setReenvioTimer(30); // Bloqueia reenvio por 30s
    } catch {
      setErro('Não foi possível enviar o SMS. Verifique o número e tente novamente.');
    } finally {
      setLoadingPhone(false);
    }
  };
  // #endregion

  // #region Phone Auth — Etapa 2: confirmar código
  const handleConfirmarCodigo = async () => {
    if (!confirmationResult || codigoSMS.length !== 6) return;
    setErro(null);
    setLoadingPhone(true);

    try {
      await confirmationResult.confirm(codigoSMS);
      // useEffect acima cuida do redirect
    } catch {
      setErro('Código inválido ou expirado. Tente novamente.');
    } finally {
      setLoadingPhone(false);
    }
  };
  // #endregion

  // Aguarda resolução de auth antes de renderizar
  if (authLoading) return <LoadingSpinner fullscreen />;

  const tituloPorContexto = ofertaIdRetorno
    ? 'Entre para garantir sua oferta'
    : rolePretendido === 'pme'
    ? 'Cadastre seu negócio'
    : 'Entre no FlashDeal';

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Header */}
      <header className="flex items-center px-4 py-4 border-b border-neutral-100">
        <button
          onClick={() => navigate(-1)}
          className="text-neutral-500 mr-3 text-sm"
        >
          ←
        </button>
        <span className="text-xl font-bold text-primary-500">⚡ FlashDeal</span>
      </header>

      <main className="flex-1 flex flex-col px-6 py-8 max-w-sm mx-auto w-full">
        <h1 className="text-xl font-bold text-neutral-800 mb-8 text-center">
          {tituloPorContexto}
        </h1>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogle}
          disabled={loadingGoogle}
          className="w-full py-3 border-2 border-neutral-200 rounded-xl flex items-center justify-center gap-3 font-medium text-neutral-700 hover:border-neutral-300 transition-colors disabled:opacity-50 mb-6"
        >
          {loadingGoogle ? (
            <LoadingSpinner size="sm" />
          ) : (
            <>
              <span className="text-lg">🔵</span>
              Continuar com Google
            </>
          )}
        </button>

        {/* Separador */}
        <div className="flex items-center gap-3 mb-6">
          <hr className="flex-1 border-neutral-200" />
          <span className="text-xs text-neutral-400">ou</span>
          <hr className="flex-1 border-neutral-200" />
        </div>

        {/* Phone Auth */}
        {etapa === 'numero' ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex items-center px-3 border border-neutral-300 rounded-lg bg-neutral-50 text-sm text-neutral-500 shrink-0">
                🇧🇷 +55
              </div>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
                placeholder="(11) 99999-9999"
                maxLength={11}
                className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <button
              onClick={handleEnviarSMS}
              disabled={loadingPhone || telefone.length < 10}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loadingPhone ? 'Enviando...' : '📱 Enviar código SMS'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-500 text-center">
              Digite o código enviado para +55 {telefone}
            </p>
            {/* Input de 6 dígitos */}
            <input
              type="number"
              value={codigoSMS}
              onChange={(e) => setCodigoSMS(e.target.value.slice(0, 6))}
              placeholder="000000"
              className="w-full border border-neutral-300 rounded-lg px-3 py-3 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-primary-500"
            />
            <button
              onClick={handleConfirmarCodigo}
              disabled={loadingPhone || codigoSMS.length !== 6}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loadingPhone ? 'Verificando...' : 'Confirmar código'}
            </button>
            {/* Reenvio */}
            <button
              onClick={() => { setEtapa('numero'); setCodigoSMS(''); }}
              disabled={reenvioTimer > 0}
              className="w-full text-sm text-neutral-400 disabled:opacity-50"
            >
              {reenvioTimer > 0 ? `Reenviar em ${reenvioTimer}s` : 'Reenviar código'}
            </button>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <p className="mt-4 text-sm text-red-500 text-center">{erro}</p>
        )}

        {/* Link PME */}
        {!rolePretendido && (
          <p className="mt-8 text-center text-sm text-neutral-400">
            É uma empresa?{' '}
            <button
              onClick={() => navigate('/login?role=pme')}
              className="text-primary-500 font-medium"
            >
              Cadastre seu negócio
            </button>
          </p>
        )}

        {/* Termos */}
        <p className="mt-6 text-xs text-neutral-400 text-center">
          Ao continuar, você aceita os{' '}
          <span className="underline cursor-pointer">Termos de Uso</span>
          {' '}e a{' '}
          <span className="underline cursor-pointer">Política de Privacidade</span>
        </p>
      </main>

      {/* reCAPTCHA invisível — obrigatório pelo Firebase Phone Auth */}
      <div id="recaptcha-container" />

    </div>
  );
};
// #endregion

export default LoginPage;

// ============================================================
// FIM: src/pages/LoginPage.tsx
// ============================================================
