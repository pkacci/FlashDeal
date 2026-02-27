// ============================================================
// INÍCIO: src/pages/PerfilPage.tsx
// Versão: 1.2.0 | Data: 2026-02-27
// Deps: React, firebase/firestore, AuthContext, useImageUpload
// Correções v1.2:
//   — ModalEdicao agora recebe valor atual (não mais vazio)
//   — Email removido da edição via Firestore (Auth-only)
//   — Campos PME adicionados: nomeFantasia, endereço
//   — CNPJ exibido como somente leitura (segurança)
//   — Plano + uso de ofertas exibido para PME
//   — Avatar carrega imagemUrl do Firestore se existir
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import useImageUpload from '../hooks/useImageUpload';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region ModalEdicao
interface ModalEdicaoProps {
  label: string;
  valorAtual: string; // v1.2: recebe valor atual em vez de ""
  onSalvar: (v: string) => void;
  onFechar: () => void;
}

const ModalEdicao: React.FC<ModalEdicaoProps> = ({
  label,
  valorAtual,
  onSalvar,
  onFechar,
}) => {
  const [input, setInput] = useState(valorAtual); // v1.2: inicia com valor real

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <p className="font-semibold text-neutral-800 mb-3">{label}</p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="input mb-4"
          autoFocus
        />
        <button
          onClick={() => onSalvar(input)}
          className="btn-primary w-full mb-2"
        >
          Salvar
        </button>
        <button
          onClick={onFechar}
          className="w-full text-sm text-neutral-400 py-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
// #endregion

// #region Types internos
interface DadosPerfil {
  nomeFantasia?: string;
  telefone?: string;
  imagemUrl?: string;
  plano?: string;
  limiteOfertas?: number;
  ofertasCriadas?: number;
  endereco?: {
    rua?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
  cnpj?: string;
  nome?: string; // consumidor
}
// #endregion

// #region PerfilPage
const PerfilPage: React.FC = () => {
  const navigate = useNavigate();
  const { usuario, role, loading: authLoading, signOut } = useAuth();
  const { upload, previewUrl, status: uploadStatus } = useImageUpload();

  const [dados, setDados] = useState<DadosPerfil>({});
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const collection = role === 'pme' ? 'pmes' : 'consumidores';

  // #region Carregar dados do Firestore
  useEffect(() => {
    if (!usuario?.uid) return;

    const carregar = async () => {
      try {
        const snap = await getDoc(doc(db, collection, usuario.uid));
        if (snap.exists()) {
          setDados(snap.data() as DadosPerfil);
        }
      } catch (err) {
        console.error('Erro ao carregar perfil:', err);
      } finally {
        setCarregando(false);
      }
    };

    carregar();
  }, [usuario?.uid, collection]);
  // #endregion

  // #region Salvar campo
  const handleSalvarCampo = useCallback(
    async (campo: string, valor: string) => {
      if (!usuario?.uid) return;
      setSalvando(true);
      try {
        await updateDoc(doc(db, collection, usuario.uid), {
          [campo]: valor,
          updatedAt: Timestamp.now(),
        });
        // Atualiza estado local sem precisar recarregar do Firestore
        setDados((prev) => ({ ...prev, [campo]: valor }));
      } catch (err) {
        console.error('Erro ao salvar campo:', err);
      } finally {
        setSalvando(false);
        setModalAberto(null);
      }
    },
    [usuario?.uid, collection]
  );
  // #endregion

  // #region Trocar foto
  const handleTrocarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario?.uid) return;
    const path = `${collection}/${usuario.uid}/perfil.webp`;
    const url = await upload(file, path);
    if (url) {
      await updateDoc(doc(db, collection, usuario.uid), {
        imagemUrl: url,
        updatedAt: Timestamp.now(),
      });
      setDados((prev) => ({ ...prev, imagemUrl: url }));
    }
  };
  // #endregion

  // #region Logout
  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };
  // #endregion

  // #region Campos por role
  // Campos editáveis para CONSUMIDOR
  const camposConsumidor = [
    { label: '📱 Telefone', campo: 'telefone', valor: dados.telefone ?? '' },
    { label: '👤 Nome', campo: 'nome', valor: dados.nome ?? '' },
  ];

  // Campos editáveis para PME
  const camposPME = [
    {
      label: '🏪 Nome do negócio',
      campo: 'nomeFantasia',
      valor: dados.nomeFantasia ?? '',
    },
    {
      label: '📱 Telefone',
      campo: 'telefone',
      valor: dados.telefone ?? '',
    },
    {
      label: '📍 Rua',
      campo: 'endereco.rua',
      valor: dados.endereco?.rua ?? '',
    },
    {
      label: '🔢 Número',
      campo: 'endereco.numero',
      valor: dados.endereco?.numero ?? '',
    },
    {
      label: '🏘️ Bairro',
      campo: 'endereco.bairro',
      valor: dados.endereco?.bairro ?? '',
    },
  ];

  const campos = role === 'pme' ? camposPME : camposConsumidor;
  // #endregion

  // #region Guards
  if (authLoading || carregando) return <LoadingSpinner fullScreen />;
  if (!usuario) {
    navigate('/login');
    return null;
  }
  // #endregion

  // #region Helpers
  const fotoExibida = previewUrl ?? dados.imagemUrl ?? null;

  const enderecoFormatado = dados.endereco
    ? [
        dados.endereco.rua,
        dados.endereco.numero,
        dados.endereco.bairro,
        dados.endereco.cidade,
        dados.endereco.estado,
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  const valorModal = modalAberto
    ? campos.find((c) => c.campo === modalAberto)?.valor ?? ''
    : '';
  // #endregion

  return (
    <div className="min-h-screen bg-neutral-50 pb-nav">

      {/* Header */}
      <header className="px-4 py-4 bg-white border-b border-neutral-100">
        <p className="font-bold text-neutral-800 text-lg">
          {role === 'pme' ? 'Meu Negócio' : 'Meu Perfil'}
        </p>
      </header>

      <div className="px-4 py-6 space-y-4">

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
            {fotoExibida ? (
              <img
                src={fotoExibida}
                alt="Perfil"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl">
                {role === 'pme' ? '🏪' : '👤'}
              </span>
            )}
          </div>
          <label className="text-sm text-primary-500 underline cursor-pointer">
            {uploadStatus === 'enviando' ? 'Enviando...' : 'Trocar foto'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleTrocarFoto}
            />
          </label>
        </div>

        {/* Email — somente leitura (gerenciado pelo Firebase Auth) */}
        <div className="card px-4 py-3">
          <p className="text-xs text-neutral-400">📧 Email</p>
          <p className="text-sm text-neutral-800">{usuario.email ?? '—'}</p>
          <p className="text-xs text-neutral-300 mt-0.5">
            Para alterar o email, acesse as configurações da sua conta.
          </p>
        </div>

        {/* CNPJ — somente leitura para PME (segurança) */}
        {role === 'pme' && dados.cnpj && (
          <div className="card px-4 py-3">
            <p className="text-xs text-neutral-400">🏢 CNPJ</p>
            <p className="text-sm text-neutral-800 font-mono">
              {dados.cnpj.replace(
                /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                '$1.$2.$3/$4-$5'
              )}
            </p>
            <p className="text-xs text-neutral-300 mt-0.5">
              CNPJ não pode ser alterado após o cadastro.
            </p>
          </div>
        )}

        {/* Endereço formatado — somente leitura (resumo) */}
        {role === 'pme' && enderecoFormatado && (
          <div className="card px-4 py-3">
            <p className="text-xs text-neutral-400">📍 Endereço atual</p>
            <p className="text-sm text-neutral-800">{enderecoFormatado}</p>
          </div>
        )}

        {/* Campos editáveis */}
        <div className="card divide-y divide-neutral-100">
          {campos.map(({ label, campo, valor }) => (
            <div
              key={campo}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-xs text-neutral-400">{label}</p>
                <p className="text-sm text-neutral-800">{valor || '—'}</p>
              </div>
              <button
                onClick={() => setModalAberto(campo)}
                className="text-sm text-primary-500"
              >
                Editar
              </button>
            </div>
          ))}
        </div>

        {/* Plano PME */}
        {role === 'pme' && (
          <div className="card px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-neutral-800">
                📊 Plano:{' '}
                <span className="capitalize text-primary-500">
                  {dados.plano ?? 'free'}
                </span>
              </p>
              {dados.plano === 'free' && (
                <button
                  onClick={() => navigate('/upgrade')}
                  className="text-xs text-white bg-primary-500 px-3 py-1 rounded-full"
                >
                  ⬆️ Upgrade PRO
                </button>
              )}
            </div>
            {dados.plano === 'free' && (
              <>
                <div className="flex justify-between text-xs text-neutral-400 mb-1">
                  <span>Ofertas este mês</span>
                  <span>
                    {dados.ofertasCriadas ?? 0}/{dados.limiteOfertas ?? 10}
                  </span>
                </div>
                {/* Barra de progresso */}
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-primary-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        ((dados.ofertasCriadas ?? 0) /
                          (dados.limiteOfertas ?? 10)) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Spinner de salvamento */}
        {salvando && (
          <div className="flex justify-center">
            <LoadingSpinner size="sm" />
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 text-red-500 font-medium border border-red-200 rounded-xl"
        >
          🚪 Sair
        </button>
      </div>

      {/* Modal de edição — v1.2: passa valorAtual corretamente */}
      {modalAberto && (
        <ModalEdicao
          label={campos.find((c) => c.campo === modalAberto)?.label ?? modalAberto}
          valorAtual={valorModal}
          onSalvar={(v) => handleSalvarCampo(modalAberto, v)}
          onFechar={() => setModalAberto(null)}
        />
      )}
    </div>
  );
};
// #endregion

export default PerfilPage;

// ============================================================
// FIM: src/pages/PerfilPage.tsx
// ============================================================
