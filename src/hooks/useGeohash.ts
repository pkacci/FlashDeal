// ============================================================
// INÍCIO: src/hooks/useGeohash.ts
// Versão: 1.1.0 | Correção: imports corretos do geofire-common
// ============================================================

import {
  geohashForLocation,   // ← nome correto (não geohashForPoint)
  geohashQueryBounds,
  distanceBetween,
} from 'geofire-common';

/**
 * Calcula o geohash de uma coordenada
 */
export const calcGeohash = (lat: number, lng: number): string => {
  return geohashForLocation([lat, lng]);
};

/**
 * Gera os bounds de query para um raio em km
 * Retorna array de [start, end] para filtrar no Firestore
 */
export const calcQueryBounds = (
  lat: number,
  lng: number,
  raioKm: number
): [string, string][] => {
  return geohashQueryBounds([lat, lng], raioKm * 1000);
};

/**
 * Calcula distância em metros entre dois pontos (Haversine)
 */
export const calcDistanciaMetros = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  // distanceBetween retorna km — converte para metros
  return distanceBetween([lat1, lng1], [lat2, lng2]) * 1000;
};

const useGeohash = () => ({
  calcGeohash,
  calcQueryBounds,
  calcDistanciaMetros,
});

export default useGeohash;

// ============================================================
// FIM: src/hooks/useGeohash.ts
// ============================================================
