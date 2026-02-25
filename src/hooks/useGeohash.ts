// ============================================================
// INÍCIO: src/hooks/useGeohash.ts
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: geofire-common
// Instalação: npm install geofire-common
// Descrição: Wrapper de geohash para queries por raio no Firestore
//            — geohashForPoint: converte lat/lng em geohash
//            — geohashQueryBounds: gera range de prefixos para query
//            — distanceBetween: distância em km entre dois pontos (Haversine)
//            — Reduz leituras desnecessárias no Firestore (economia de custo)
//            — Documentação: seção 5.1 e 7.2 do doc mestre
// ============================================================

import { useCallback } from 'react';
import {
  geohashForPoint,
  geohashQueryBounds,
  distanceBetween,
} from 'geofire-common';

// #region Types
export interface GeohashBound {
  startHash: string;
  endHash: string;
}

interface UseGeohashReturn {
  /** Converte lat/lng em string de geohash (precisão 9 por padrão) */
  calcGeohash: (lat: number, lng: number, precision?: number) => string;

  /** Gera array de bounds para queries por raio no Firestore */
  calcQueryBounds: (
    centerLat: number,
    centerLng: number,
    radiusKm: number
  ) => GeohashBound[];

  /**
   * Distância em metros entre dois pontos (via Haversine)
   * Usado para filtrar resultados após a query por geohash
   * (geohash gera falsos positivos — filtragem exata é obrigatória)
   */
  calcDistanciaMetros: (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ) => number;
}
// #endregion

// #region Hook
const useGeohash = (): UseGeohashReturn => {

  const calcGeohash = useCallback(
    (lat: number, lng: number, precision = 9): string => {
      return geohashForPoint([lat, lng], precision);
    },
    []
  );

  const calcQueryBounds = useCallback(
    (centerLat: number, centerLng: number, radiusKm: number): GeohashBound[] => {
      // geohashQueryBounds retorna array de [startHash, endHash]
      const bounds = geohashQueryBounds([centerLat, centerLng], radiusKm * 1000);
      return bounds.map(([startHash, endHash]) => ({ startHash, endHash }));
    },
    []
  );

  const calcDistanciaMetros = useCallback(
    (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      // distanceBetween retorna km — convertemos para metros
      const distKm = distanceBetween([lat1, lng1], [lat2, lng2]);
      return Math.round(distKm * 1000);
    },
    []
  );

  return { calcGeohash, calcQueryBounds, calcDistanciaMetros };
};
// #endregion

export default useGeohash;

// ============================================================
// FIM: src/hooks/useGeohash.ts
// ============================================================
