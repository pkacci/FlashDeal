// ============================================================
// INÍCIO: src/pages/OfertaDetalhesPage.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, firebase/firestore,
//       hooks/useAuth, hooks/useGeohash,
//       components/consumidor/OfertaDetalhe,
//       components/common/LoginModal
// Descrição: Page wrapper que carrega dados da oferta do Firestore
//            e orquestra o fluxo de autenticação (Late Auth)
//            — Se não logado: abre LoginModal ao clicar "Garantir"
//            — Se logado: navega direto para /pagamento-pix/:ofertaId
//            — LoginModal preserva ofertaId via navigate state
// ============================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Oferta } from '../types/oferta';
import useAuth from '../hooks/useAuth';
import useGeolocation from '../hooks/useGeolocation';
import useGeohash from '../hooks/useGeohash';
import OfertaDetalhe from '../components/consumidor/OfertaDetalhe';
import LoginModal from '../components/common/LoginModal';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region Component
const OfertaDetalhesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { lat: userLat, lng: userLng } = useGeolocation();
  const { calcDistanciaMetros } = useGeohash();

  const [oferta, setOferta] = useState<Oferta | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [distanciaMetros, setDistanciaMetros] = useState<number | undefined>();

  // Carrega oferta do Firestore
  useEffect(() => {
    if (!id) return;

    const carregarOferta = async () => {
      try {
        const snap = await getDoc(doc(db, 'ofertas', id));
        if (!snap.exists()) {
          setErro(true);
          return;
        }
        const data = { id: snap.id, ...snap.data() } as Oferta;
        setOferta(data);

        // Calcula distância usando geolocalização do hook
        if (userLat && userLng && data.geo) {
          const dist = calcDistanciaMetros(
            userLat,
            userLng,
            data.geo.latitude,
            data.geo.longitude
          );
          setDistanciaMetros(dist);
        }
      } catch {
        setErro(true);
      } finally {
        setLoading(false);
      }
    };

    carregarOferta();
  }, [id, calcDistanciaMetros]);

  // Ao clicar "Garantir com Pix"
  const handleGarantir = () => {
    if (!usuario) {
      // Late Auth: abre modal sem perder o contexto da oferta
      setShowLoginModal(true);
    } else {
      // Já autenticado: vai direto ao pagamento
      navigate(`/pagamento-pix/${id}`);
    }
  };

  // Após login bem-sucedido no modal
  const handleLoginSucesso = () => {
    setShowLoginModal(false);
    navigate(`/pagamento-pix/${id}`);
  };

  // Estados de loading/erro
  if (loading) return <LoadingSpinner fullscreen />;

  if (erro || !oferta) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-4">😕</p>
        <p className="text-lg font-semibold text-neutral-700 mb-2">Oferta não encontrada</p>
        <p className="text-sm text-neutral-400 mb-6">
          Esta oferta pode ter expirado ou sido removida.
        </p>
        <button onClick={() => navigate('/ofertas')} className="btn-primary">
          Ver outras ofertas
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-white px-4 py-4">
        <OfertaDetalhe
          oferta={oferta}
          distanciaMetros={distanciaMetros}
          isAutenticado={!!usuario}
          onGarantir={handleGarantir}
        />
      </div>

      {/* Modal de login tardio (Late Auth) */}
      {showLoginModal && (
        <LoginModal
          ofertaId={id!}
          onSucesso={handleLoginSucesso}
          onFechar={() => setShowLoginModal(false)}
        />
      )}
    </>
  );
};
// #endregion

export default OfertaDetalhesPage;

// ============================================================
// FIM: src/pages/OfertaDetalhesPage.tsx
// ============================================================
