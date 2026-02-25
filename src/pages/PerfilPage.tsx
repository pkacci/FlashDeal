// ============================================================
// INÍCIO: src/pages/PerfilPage.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, firebase/auth,
//       firebase/firestore, hooks/useAuth, hooks/useImageUpload
// Descrição: Tela de perfil — renderização por role
//            — Consumidor: nome, telefone, notificações
//            — PME: dados do negócio, plano, foto, upgrade
//            — Edição inline via modal (sem navegar)
//            — Foto fachada: mesmo fluxo useImageUpload (.webp)
//            — Logout: signOut() + redirect para /
// ============================================================

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import useAuth from '../hooks/useAuth';
import useImageUpload from '../hooks/useImageUpload';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region Types
interface CampoEditavel {
  campo: 'nomeFantasia' | 'telefone' | null;
  valor: string;
}
// #endregion

// #region Helpers
const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// #endregion

// #region Component
const PerfilPage: React.FC = () => {
  const navigate = useNavigate();
  const { usuario, role, pmeData, loading: authLoading } = useAuth();
  const { upload, previewUrl, status: uploadStatus } = useImageUpload();

  const [editando, setEditando] = useState<CampoEditavel>({ campo: null, valor: '' });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(true);

  // #region Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate('/', { replace: true });
  };
  // #endregion

  // #region Salvar campo editado
  const handleSalvar = useCallback(async () => {
    if (!usuario?.uid || !editando.campo || !editando.valor.trim()) return;
    setSalvando(true);
    setErroSalvar(null);

    try {
      const colecao = role === 'pme' ? 'pmes' : 'consumidores';
      await updateDoc(doc(db, colecao, usuario.uid), {
        [editando.campo]: editando.valor.trim(),
        updatedAt: Timestamp.now(),
      });
      setEditando({ campo: null, valor: '' });
    } catch {
      setErroSalvar('Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }, [usuario?.uid, role, editando]);
  // #endregion

  // #region Trocar foto da fachada (PME)
  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario?.uid) return;

    const path = `pmes/${usuario.uid}/fachada.webp`;
    const url = await upload(file, path);
    if (url) {
      await updateDoc(doc(db, 'pmes', usuario.uid), {
        imagemUrl: url,
        updatedAt: Timestamp.now(),
      });
    }
  };
  // #endregion

  if (authLoading) return <LoadingSpinner fullscreen />;

  // #region Perfil Consumidor
  if (role === 'consumidor') {
    return (
      <div className="min-h-screen bg-neutral-50 pb-24">
        <header className="bg-white px-4 py-4 border-b border-neutral-100 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-neutral-500 text-sm">←</button>
          <p className="font-semibold text-neutral-800">Meu Perfil</p>
        </header>

        <main className="px-4 pt-6 space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center py-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-2xl mb-2">
              {usuario?.photoURL
                ? <img src={usuario.photoURL} alt="avatar" className="w-full h-full rounded-full object-cover" />
                : <span>{(usuario?.displayName ?? 'U')[0].toUpperCase()}</span>}
            </div>
            <p className="font-semibold text-neutral-800">{usuario?.displayName ?? 'Usuário'}</p>
            <p className="text-sm text-neutral-400">{usuario?.email ?? usuario?.phoneNumber ?? ''}</p>
          </div>

          {/* Opções */}
          <div className="card divide-y divide-neutral-100">
            {/* Notificações */}
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-neutral-700">🔔 Notificações</p>
              <button
                onClick={() => setNotificacoesAtivas((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  notificacoesAtivas ? 'bg-primary-500' : 'bg-neutral-300'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  notificacoesAtivas ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Telefone */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-neutral-700">📱 Telefone</p>
                <p className="text-xs text-neutral-400">{usuario?.phoneNumber ?? 'Não informado'}</p>
              </div>
              <button
                onClick={() => setEditando({ campo: 'telefone', valor: usuario?.phoneNumber ?? '' })}
                className="text-xs text-primary-500 font-medium"
              >
                Editar
              </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 border border-red-100 rounded-xl text-sm text-red-400 hover:bg-red-50 transition-colors"
          >
            🚪 Sair da conta
          </button>
        </main>

        {/* Modal de edição inline */}
        {editando.campo && (
          <ModalEdicao
            label={editando.campo === 'telefone' ? 'Telefone' : 'Nome'}
            valor={editando.valor}
            onChange={(v) => setEditando((p) => ({ ...p, valor: v }))}
            onSalvar={handleSalvar}
            onFechar={() => setEditando({ campo: null, valor: '' })}
            salvando={salvando}
            erro={erroSalvar}
          />
        )}
      </div>
    );
  }
  // #endregion

  // #region Perfil PME
  const percLimite = pmeData
    ? Math.round(((pmeData.ofertasCriadas ?? 0) / (pmeData.limiteOfertas ?? 10)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <header className="bg-white px-4 py-4 border-b border-neutral-100 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-neutral-500 text-sm">←</button>
        <p className="font-semibold text-neutral-800">Meu Negócio</p>
      </header>

      <main className="px-4 pt-6 space-y-4">
        {/* Foto fachada */}
        <div className="flex flex-col items-center py-4">
          <label className="cursor-pointer">
            <div className="w-20 h-20 bg-neutral-100 rounded-2xl overflow-hidden mb-2 relative">
              {previewUrl || pmeData?.imagemUrl ? (
                <img
                  src={previewUrl ?? pmeData?.imagemUrl}
                  alt="Fachada"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">🏪</div>
              )}
              {uploadStatus === 'enviando' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
            <p className="text-xs text-primary-500 text-center font-medium">Trocar foto</p>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
          </label>
          <p className="font-bold text-neutral-800 mt-1">{pmeData?.nomeFantasia ?? '—'}</p>
          <p className="text-xs text-neutral-400">CNPJ: {pmeData?.cnpj ?? '—'}</p>
        </div>

        {/* Plano */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-neutral-700">
              📊 Plano {pmeData?.plano === 'pro' ? 'PRO' : 'Gratuito'}
            </p>
            {pmeData?.plano !== 'pro' && (
              <button
                onClick={() => {/* TODO: Stripe checkout */}}
                className="text-xs text-primary-500 font-semibold border border-primary-200 rounded-full px-3 py-1"
              >
                ⬆️ Upgrade PRO — R$49/mês
              </button>
            )}
          </div>
          {pmeData?.plano !== 'pro' && (
            <>
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>{pmeData?.ofertasCriadas ?? 0}/{pmeData?.limiteOfertas ?? 10} ofertas este mês</span>
                <span>{percLimite}%</span>
              </div>
              <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${percLimite >= 80 ? 'bg-red-400' : 'bg-primary-500'}`}
                  style={{ width: `${percLimite}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Dados do negócio */}
        <div className="card divide-y divide-neutral-100">
          {[
            { label: '🏪 Nome fantasia', valor: pmeData?.nomeFantasia, campo: 'nomeFantasia' as const },
            { label: '📱 Telefone', valor: pmeData?.telefone, campo: 'telefone' as const },
          ].map(({ label, valor, campo }) => (
            <div key={campo} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-neutral-700">{label}</p>
                <p className="text-xs text-neutral-400">{valor ?? 'Não informado'}</p>
              </div>
              <button
                onClick={() => setEditando({ campo, valor: valor ?? '' })}
                className="text-xs text-primary-500 font-medium"
              >
                Editar
              </button>
            </div>
          ))}

          {/* Endereço (somente leitura no MVP) */}
          <div className="px-4 py-3">
            <p className="text-sm text-neutral-700">📍 Endereço</p>
            <p className="text-xs text-neutral-400">
              {pmeData?.endereco?.rua
                ? `${pmeData.endereco.rua}, ${pmeData.endereco.numero} — ${pmeData.endereco.bairro}`
                : 'Não informado'}
            </p>
          </div>

          {/* Notificações */}
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm text-neutral-700">🔔 Notificações</p>
            <button
              onClick={() => setNotificacoesAtivas((v) => !v)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                notificacoesAtivas ? 'bg-primary-500' : 'bg-neutral-300'
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                notificacoesAtivas ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 border border-red-100 rounded-xl text-sm text-red-400 hover:bg-red-50 transition-colors"
        >
          🚪 Sair da conta
        </button>
      </main>

      {/* Modal de edição inline */}
      {editando.campo && (
        <ModalEdicao
          label={editando.campo === 'nomeFantasia' ? 'Nome fantasia' : 'Telefone'}
          valor={editando.valor}
          onChange={(v) => setEditando((p) => ({ ...p, valor: v }))}
          onSalvar={handleSalvar}
          onFechar={() => setEditando({ campo: null, valor: '' })}
          salvando={salvando}
          erro={erroSalvar}
        />
      )}
    </div>
  );
  // #endregion
};
// #endregion

// #region ModalEdicao — reutilizável por campo
interface ModalEdicaoProps {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  onSalvar: () => void;
  onFechar: () => void;
  salvando: boolean;
  erro: string | null;
}

const ModalEdicao: React.FC<ModalEdicaoProps> = ({
  label, valor, onChange, onSalvar, onFechar, salvando, erro,
}) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
    <div className="bg-white w-full rounded-t-2xl p-6 space-y-4">
      <p className="font-semibold text-neutral-800">Editar {label}</p>
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
        autoFocus
      />
      {erro && <p className="text-xs text-red-500">{erro}</p>}
      <div className="flex gap-3">
        <button onClick={onFechar} className="flex-1 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-600">
          Cancelar
        </button>
        <button
          onClick={onSalvar}
          disabled={salvando || !valor.trim()}
          className="flex-1 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  </div>
);
// #endregion

export default PerfilPage;

// ============================================================
// FIM: src/pages/PerfilPage.tsx
// ============================================================
