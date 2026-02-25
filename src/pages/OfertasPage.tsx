// ============================================================
// INÍCIO: src/pages/OfertasPage.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, firebase/firestore,
//       geofire-common, hooks/useGeolocation, hooks/useGeohash,
//       components/consumidor/FiltroCategoria,
//       components/consumidor/MapView,
//       components/common/EmptyState
// Descrição: Tela principal de busca de ofertas do consumidor
//            — Toggle lista ↔ mapa (1 toque)
//            — Query Firestore por geohash range (queries por raio)
//            — Filtragem pós-query por distância real (Haversine)
//            — Filtro por categoria via chips
//            — Estado vazio com CTA de notificação
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Oferta } from '../types/oferta';
import useGeolocation from '../hooks/useGeolocation';
import useGeohash from '../hooks/useGeohash';
import FiltroCategoria, { CategoriaFiltro } from '../components/consumidor/FiltroCategoria';
import MapView from '../components/consumidor/MapView';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region Constantes
const RAIO_KM = 2;       // Raio padrão de busca: 2km
const MAX_OFERTAS = 30;  // Limite de resultados por query
// #endregion

// #region Helpers
const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcTempoRestante = (dataFim: Date): string => {
  const diff = dataFim.getTime() - Date.now();
  if (diff <= 0) return 'Expirada';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const formatDistancia = (metros: number) =>
  metros < 1000 ? `${metros}m` : `${(metros / 1000).toFixed(1)}km`;
// #endregion

// #region OfertaCard (inline — evita importar componente ainda não criado)
interface OfertaCardProps {
  oferta: Oferta;
  distanciaMetros: number;
  onClick: () => void;
}

const OfertaCard: React.FC<OfertaCardProps> = ({ oferta, distanciaMetros, onClick }) => {
  const percEstoque = oferta.quantidadeTotal > 0
    ? Math.round(((oferta.quantidadeTotal - oferta.quantidadeDisponivel) / oferta.quantidadeTotal) * 100)
    : 0;

  return (
    <div
      className="card overflow-hidden cursor-pointer active:scale-95 transition-transform"
      onClick={onClick}
    >
      {/* Imagem */}
      <div className="h-36 bg-neutral-100 relative overflow-hidden">
        {oferta.imagemUrl ? (
          <img src={oferta.imagemUrl} alt={oferta.titulo} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 text-4xl">🖼️</div>
        )}
        <div className="absolute top-2 left-2 bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          -{oferta.desconto}%
        </div>
      </div>

      {/* Corpo */}
      <div className="p-3">
        <p className="font-semibold text-sm text-neutral-800 truncate mb-0.5">{oferta.titulo}</p>
        <p className="text-xs text-neutral-400 mb-2">
          {oferta.pmeNome} · {formatDistancia(distanciaMetros)}
        </p>

        {/* Barra de estoque */}
        <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden mb-1">
          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${percEstoque}%` }} />
        </div>
        <p className="text-xs text-neutral-400 mb-2">
          {oferta.quantidadeDisponivel}/{oferta.quantidadeTotal} restantes
        </p>

        {/* Preço + timer */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 line-through">{formatBRL(oferta.valorOriginal)}</p>
            <p className="text-base font-bold text-neutral-800">{formatBRL(oferta.valorOferta)}</p>
          </div>
          <p className="text-xs text-neutral-500">
            ⏱ {calcTempoRestante(oferta.dataFim.toDate())}
          </p>
        </div>
      </div>
    </div>
  );
};
// #endregion

// #region Component principal
const OfertasPage: React.FC = () => {
  const navigate = useNavigate();
  const { lat, lng, status: geoStatus, requestLocation } = useGeolocation();
  const { calcQueryBounds, calcDistanciaMetros } = useGeohash();

  const [ofertas, setOfertas] = useState<Array<Oferta & { distanciaMetros: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [modoMapa, setModoMapa] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaFiltro>('todos');

  // Pede localização ao montar
  useEffect(() => {
    requestLocation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Busca ofertas quando localização estiver disponível
  const buscarOfertas = useCallback(async () => {
    if (!lat || !lng) return;

    setLoading(true);
    try {
      const bounds = calcQueryBounds(lat, lng, RAIO_KM);
      const agora = Timestamp.now();
      const todas: Array<Oferta & { distanciaMetros: number }> = [];

      // Uma query por bound de geohash (geohashQueryBounds pode retornar múltiplos ranges)
      await Promise.all(
        bounds.map(async ({ startHash, endHash }) => {
          const q = query(
            collection(db, 'ofertas'),
            where('ativa', '==', true),
            where('dataFim', '>', agora),
            where('geohash', '>=', startHash),
            where('geohash', '<=', endHash),
            orderBy('dataFim', 'asc')
          );

          const snap = await getDocs(q);
          snap.forEach((doc) => {
            const oferta = { id: doc.id, ...doc.data() } as Oferta;

            // Filtragem exata por distância (geohash tem falsos positivos)
            const ofLat = oferta.geo?.latitude;
            const ofLng = oferta.geo?.longitude;
            if (!ofLat || !ofLng) return;

            const distanciaMetros = calcDistanciaMetros(lat, lng, ofLat, ofLng);
            if (distanciaMetros <= RAIO_KM * 1000) {
              todas.push({ ...oferta, distanciaMetros });
            }
          });
        })
      );

      // Ordena por distância e limita resultado
      todas.sort((a, b) => a.distanciaMetros - b.distanciaMetros);
      setOfertas(todas.slice(0, MAX_OFERTAS));
    } catch (err) {
      console.error('Erro ao buscar ofertas:', err);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, calcQueryBounds, calcDistanciaMetros]);

  useEffect(() => {
    buscarOfertas();
  }, [buscarOfertas]);

  // Filtra por categoria client-side (já carregadas)
  const ofertasFiltradas =
    categoria === 'todos'
      ? ofertas
      : ofertas.filter((o) => o.pmeCategoria === categoria);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">

      {/* Header */}
      <header className="bg-white px-4 py-3 border-b border-neutral-100 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-bold text-primary-500">⚡ FlashDeal</span>
          <span className="text-xs text-neutral-400">
            {geoStatus === 'success' ? '📍 Perto de você' : '📍 São Paulo'}
          </span>
        </div>

        {/* Filtros de categoria */}
        <FiltroCategoria categoriaSelecionada={categoria} onChange={setCategoria} />

        {/* Toggle lista / mapa */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setModoMapa(false)}
            className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              !modoMapa ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            📋 Lista
          </button>
          <button
            onClick={() => setModoMapa(true)}
            className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              modoMapa ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            🗺️ Mapa
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : modoMapa ? (
          /* Modo Mapa */
          <div className="h-[calc(100vh-200px)] rounded-xl overflow-hidden">
            {lat && lng ? (
              <MapView
                ofertas={ofertasFiltradas}
                userLat={lat}
                userLng={lng}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-neutral-100 rounded-xl">
                <LoadingSpinner />
              </div>
            )}
          </div>
        ) : ofertasFiltradas.length === 0 ? (
          /* Estado vazio */
          <EmptyState
            icone="📍"
            titulo="Nenhuma oferta perto de você agora"
            subtitulo="Novas ofertas aparecem toda hora. Volte em breve!"
            ctaLabel="🔔 Me avise quando tiver"
            onCta={() => {/* TODO: implementar push opt-in */}}
          />
        ) : (
          /* Lista de ofertas */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ofertasFiltradas.map((oferta) => (
              <OfertaCard
                key={oferta.id}
                oferta={oferta}
                distanciaMetros={oferta.distanciaMetros}
                onClick={() => navigate(`/oferta/${oferta.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
// #endregion

export default OfertasPage;

// ============================================================
// FIM: src/pages/OfertasPage.tsx
// ============================================================
