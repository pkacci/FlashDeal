/* --- PATH: src/pages/LoginPage.tsx --- */
// Versão: 1.1.0 | Alteração: Correção de redirecionamento por intenção (role=pme)
// FUNÇÕES PRESENTES: LoginPage, handleGoogle, handleEnviarSMS, handleConfirmarCodigo

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

type EtapaPhone = 'numero' | 'codigo';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { usuario, role, loading: authLoading } = useAuth();

  const rolePretendido = searchParams.get('role'); // 'pme' ou null
  const ofertaIdRetorno = (location.state as { ofertaId?: string } | null)?.ofertaId;

  const [etapa, setEtapa] = useState<EtapaPhone>('numero');
  const [telefone, setTelefone] = useState('');
  const [codigoSMS, setCodigoSMS] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reenvioTimer, setReenvioTimer] = useState(0);

  // #region Redirecionamento CORRIGIDO
  useEffect(() => {
    // Só age se o usuário estiver logado e o AuthContext não estiver mais carregando
    if (authLoading || !usuario) return;

    if (ofertaIdRetorno) {
      // 1. Prioridade Late Auth (Voltar para a oferta que estava comprando)
      navigate(`/oferta/${ofertaIdRetorno}`, { replace: true });
    } else if (role === 'pme') {
      // 2. Se já é PME confirmado, vai para o Dashboard
      navigate('/dashboard', { replace: true });
    } else if (rolePretendido === 'pme') {
      // 3. INTENÇÃO: Se clicou em "Cadastrar Negócio", vai para o Onboarding
      // Mesmo que a role ainda não tenha sido processada pela Cloud Function
      navigate('/onboarding-ia', { replace: true });
    } else {
      // 4. Default: Consumidor comum vai para ofertas
      navigate('/ofertas', { replace: true });
    }
  }, [usuario, role, authLoading, ofertaIdRetorno, rolePretendido, navigate]);
  // #endregion

  useEffect(() => {
    if (reenvioTimer <= 0) return;
    const t = setInterval(() => setReenvioTimer((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [reenvioTimer]);

  const handleGoogle = async () => {
    setErro(null);
    setLoadingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      setErro('Não foi possível entrar com Google.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleEnviarSMS = async () => {
    if (telefone.length < 10) {
      setErro('Informe um número válido.');
      return;
    }
    setErro(null);
    setLoadingPhone(true);
    try {
      const recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      const numeroFormatado = `+55${telefone.replace(/\D/g, '')}`;
      const result = await signInWithPhoneNumber(auth, numeroFormatado, recaptcha);
      setConfirmationResult(result);
      setEtapa('codigo');
      setReenvioTimer(30);
    } catch {
      setErro('Erro ao enviar SMS.');
    } finally {
      setLoadingPhone(false);
    }
  };

  const handleConfirmarCodigo = async () => {
    if (!confirmationResult || codigoSMS.length !== 6) return;
    setErro(null);
    setLoadingPhone(true);
    try {
      await confirmationResult.confirm(codigoSMS);
    } catch {
      setErro('Código inválido.');
    } finally {
      setLoadingPhone(false);
    }
  };

  if (authLoading) return <LoadingSpinner fullscreen />;

  const tituloPorContexto = ofertaIdRetorno
    ? 'Entre para garantir sua oferta'
    : rolePretendido === 'pme'
    ? 'Cadastre seu negócio'
    : 'Entre no FlashDeal';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center px-4 py-4 border-b border-neutral-100">
        <button onClick={() => navigate(-1)} className="text-neutral-500 mr-3 text-sm">←</button>
        <span className="text-xl font-bold text-orange-500">⚡ FlashDeal</span>
      </header>

      <main className="flex-1 flex flex-col px-6 py-8 max-w-sm mx-auto w-full text-center">
        <h1 className="text-xl font-bold text-neutral-800 mb-8">{tituloPorContexto}</h1>

        <button
          onClick={handleGoogle}
          disabled={loadingGoogle}
          className="w-full py-3 border-2 border-neutral-200 rounded-xl flex items-center justify-center gap-3 font-medium text-neutral-700 hover:border-neutral-300 disabled:opacity-50 mb-6"
        >
          {loadingGoogle ? <LoadingSpinner size="sm" /> : <><span className="text-lg">🔵</span> Continuar com Google</>}
        </button>

        <div className="flex items-center gap-3 mb-6">
          <hr className="flex-1 border-neutral-200" /><span className="text-xs text-neutral-400">ou</span><hr className="flex-1 border-neutral-200" />
        </div>

        {etapa === 'numero' ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex items-center px-3 border border-neutral-300 rounded-lg bg-neutral-50 text-sm text-neutral-500">🇧🇷 +55</div>
              <input
                type="tel" value={telefone} maxLength={11}
                onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
                placeholder="(11) 99999-9999"
                className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"
              />
            </div>
            <button onClick={handleEnviarSMS} disabled={loadingPhone || telefone.length < 10} className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold disabled:opacity-50">
              {loadingPhone ? 'Enviando...' : '📱 Enviar código SMS'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-500">Digite o código enviado para +55 {telefone}</p>
            <input
              type="number" value={codigoSMS} onChange={(e) => setCodigoSMS(e.target.value.slice(0, 6))}
              placeholder="000000"
              className="w-full border border-neutral-300 rounded-lg px-3 py-3 text-center text-lg font-mono tracking-widest focus:border-orange-500 outline-none"
            />
            <button onClick={handleConfirmarCodigo} disabled={loadingPhone || codigoSMS.length !== 6} className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold disabled:opacity-50">
              {loadingPhone ? 'Verificando...' : 'Confirmar código'}
            </button>
            <button onClick={() => setEtapa('numero')} disabled={reenvioTimer > 0} className="w-full text-sm text-neutral-400 disabled:opacity-50">
              {reenvioTimer > 0 ? `Reenviar em ${reenvioTimer}s` : 'Reenviar código'}
            </button>
          </div>
        )}

        {erro && <p className="mt-4 text-sm text-red-500">{erro}</p>}

        {!rolePretendido && (
          <p className="mt-8 text-sm text-neutral-400">
            É uma empresa? <button onClick={() => navigate('/login?role=pme')} className="text-orange-600 font-medium">Cadastre seu negócio</button>
          </p>
        )}
      </main>
      <div id="recaptcha-container" />
    </div>
  );
};

export default LoginPage;
