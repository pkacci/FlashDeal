// ============================================================
// INÍCIO: src/pages/PerfilPage.tsx
// Versão: 1.1.0 | Correção: removido formatBRL não usado
// ============================================================

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import useImageUpload from '../hooks/useImageUpload';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region ModalEdicao
interface ModalEdicaoProps {
  label: string;
  valor: string;
  onSalvar: (v: string) => void;
  onFechar: () => void;
}

const ModalEdicao: React.FC<ModalEdicaoProps> = ({ label, valor, onSalvar, onFechar }) => {
  const [input, setInput] = useState(valor);
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
        <button onClick={() => onSalvar(input)} className="btn-primary w-full mb-2">
          Salvar
        </button>
        <button onClick={onFechar} className="w-full text-sm text-neutral-400 py-2">
          Cancelar
        </button>
      </div>
    </div>
  );
};
// #endregion

const PerfilPage: React.FC = () => {
  const navigate = useNavigate();
  const { usuario, role, loading: authLoading, signOut } = useAuth();
  const { upload, previewUrl, status: uploadStatus } = useImageUpload();

  const [modalAberto, setModalAberto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const collection = role === 'pme' ? 'pmes' : 'consumidores';

  const handleSalvarCampo = useCallback(async (campo: string, valor: string) => {
    if (!usuario?.uid) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, collection, usuario.uid), {
        [campo]: valor,
        updatedAt: Timestamp.now(),
      });
    } finally {
      setSalvando(false);
      setModalAberto(null);
    }
  }, [usuario?.uid, collection]);

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
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  if (authLoading) return <LoadingSpinner fullScreen />;
  if (!usuario) { navigate('/login'); return null; }

  return (
    <div className="min-h-screen bg-neutral-50 pb-nav">
      <header className="px-4 py-4 bg-white border-b border-neutral-100">
        <p className="font-bold text-neutral-800 text-lg">
          {role === 'pme' ? 'Meu Negócio' : 'Meu Perfil'}
        </p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <img src={previewUrl} alt="Perfil" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">
                {role === 'pme' ? '🏪' : '👤'}
              </span>
            )}
          </div>
          <label className="text-sm text-primary-500 underline cursor-pointer">
            {uploadStatus === 'enviando' ? 'Enviando...' : 'Trocar foto'}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleTrocarFoto} />
          </label>
        </div>

        {/* Campos */}
        <div className="card divide-y divide-neutral-100">
          {[
            { label: '📧 Email', campo: 'email', valor: usuario.email ?? '' },
            { label: '📱 Telefone', campo: 'telefone', valor: usuario.phoneNumber ?? '' },
          ].map(({ label, campo, valor }) => (
            <div key={campo} className="flex items-center justify-between px-4 py-3">
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

      {/* Modal de edição */}
      {modalAberto && (
        <ModalEdicao
          label={modalAberto}
          valor=""
          onSalvar={(v) => handleSalvarCampo(modalAberto, v)}
          onFechar={() => setModalAberto(null)}
        />
      )}
    </div>
  );
};

export default PerfilPage;

// ============================================================
// FIM: src/pages/PerfilPage.tsx
// ============================================================
