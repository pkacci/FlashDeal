// ============================================================
// INÍCIO: src/components/consumidor/MapView.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, leaflet, react-leaflet, types/oferta.ts
// Instalação: npm install leaflet react-leaflet @types/leaflet
// Descrição: Mapa Leaflet com pins das ofertas próximas
//            — Tiles gratuitos via OpenStreetMap (zero custo)
//            — Toque no pin → card flutuante → navega para detalhes
//            — Círculo azul: posição do usuário
//            — Sem Google Maps (evita cobrança > 28k loads/mês)
// ============================================================

import React, { useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { Oferta } from '../../types/oferta';

// #region Fix: ícones Leaflet quebram com bundlers (Vite/Webpack)
// Leaflet tenta carregar ícones via URL relativa que bundlers não resolvem.
// Solução padrão: apontar para CDN do unpkg.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
// #endregion

// #region Ícone customizado por categoria
const criarIconeCategoria = (emoji: string): L.DivIcon =>
  L.divIcon({
    html: `<div style="
      background: white;
      border: 2px solid #f97316;
      border-radius: 50%;
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    ">${emoji}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });

const ICONE_POR_CATEGORIA: Record<string, L.DivIcon> = {
  restaurante: criarIconeCategoria('🍕'),
  beleza:      criarIconeCategoria('💇'),
  fitness:     criarIconeCategoria('💪'),
  servicos:    criarIconeCategoria('🛠️'),
  varejo:      criarIconeCategoria('🛍️'),
  default:     criarIconeCategoria('✨'),
};

const getIcone = (categoria: string): L.DivIcon =>
  ICONE_POR_CATEGORIA[categoria] ?? ICONE_POR_CATEGORIA.default;
// #endregion

// #region Types
interface MapViewProps {
  ofertas: Oferta[];
  userLat: number;
  userLng: number;
  raioPadrao?: number; // metros — padrão 2km
}
// #endregion

// #region Sub-component: centraliza mapa na posição do usuário
const CentrarMapa: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  // Centraliza apenas na montagem inicial
  React.useEffect(() => {
    map.setView([lat, lng], 15);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};
// #endregion

// #region Helpers
const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcTempoRestante = (dataFim: Date): string => {
  const diff = dataFim.getTime() - Date.now();
  if (diff <= 0) return 'Expirada';
  const horas = Math.floor(diff / (1000 * 60 * 60));
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (horas > 0) return `${horas}h`;
  return `${minutos}min`;
};
// #endregion

// #region Component principal
const MapView: React.FC<MapViewProps> = ({
  ofertas,
  userLat,
  userLng,
  raioPadrao = 2000,
}) => {
  const navigate = useNavigate();
  // Oferta selecionada pelo toque no pin → exibe card flutuante
  const [ofertaSelecionada, setOfertaSelecionada] = useState<Oferta | null>(null);

  return (
    <div className="relative w-full h-full">
      {/* Mapa Leaflet — tiles OpenStreetMap (gratuito) */}
      <MapContainer
        center={[userLat, userLng]}
        zoom={15}
        className="w-full h-full rounded-xl z-0"
        zoomControl={false} // Remove zoom no mobile — usa pinch nativo
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Centraliza na posição do usuário */}
        <CentrarMapa lat={userLat} lng={userLng} />

        {/* Círculo azul: posição do usuário */}
        <Circle
          center={[userLat, userLng]}
          radius={raioPadrao}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            weight: 1,
          }}
        />
        {/* Ponto central do usuário */}
        <Circle
          center={[userLat, userLng]}
          radius={30}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.8,
            weight: 2,
          }}
        />

        {/* Pins das ofertas */}
        {ofertas.map((oferta) => {
          const lat = oferta.geo?.latitude;
          const lng = oferta.geo?.longitude;
          if (!lat || !lng) return null;

          return (
            <Marker
              key={oferta.id}
              position={[lat, lng]}
              icon={getIcone(oferta.pmeCategoria)}
              eventHandlers={{
                // Toque no pin → seleciona oferta → exibe card flutuante
                click: () => setOfertaSelecionada(oferta),
              }}
            >
              {/* Popup nativo do Leaflet (opcional — sobreposto pelo card flutuante) */}
              <Popup>
                <p className="font-semibold text-xs">{oferta.titulo}</p>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Card flutuante — aparece ao tocar em um pin */}
      {ofertaSelecionada && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div
            className="card p-4 cursor-pointer active:scale-95 transition-transform"
            onClick={() => navigate(`/oferta/${ofertaSelecionada.id}`)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-neutral-800 truncate">
                  {ofertaSelecionada.titulo}
                </p>
                <p className="text-xs text-neutral-500">{ofertaSelecionada.pmeNome}</p>
              </div>

              {/* Fechar card flutuante */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Evita navegar ao fechar
                  setOfertaSelecionada(null);
                }}
                className="shrink-0 text-neutral-400 hover:text-neutral-600 p-1"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div>
                <span className="text-xs text-neutral-400 line-through mr-1">
                  {formatBRL(ofertaSelecionada.valorOriginal)}
                </span>
                <span className="text-base font-bold text-neutral-800">
                  {formatBRL(ofertaSelecionada.valorOferta)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>⏱ {calcTempoRestante(ofertaSelecionada.dataFim.toDate())}</span>
                <span className="text-primary-500 font-semibold">Ver →</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
// #endregion

export default MapView;

// ============================================================
// FIM: src/components/consumidor/MapView.tsx
// ============================================================
