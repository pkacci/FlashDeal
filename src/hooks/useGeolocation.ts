// ============================================================
// INÍCIO: src/hooks/useGeolocation.ts
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React
// Descrição: Hook de geolocalização com tratamento de permissão,
//            estado de loading e fallback para coordenadas padrão.
//            — Pede permissão apenas uma vez (lazy: ao chamar requestLocation)
//            — Fallback: São Paulo centro se permissão negada
//            — Usado por OfertasPage para calcular geohash do usuário
// ============================================================

import { useState, useCallback } from 'react';

// #region Types
export type GeoStatus = 'idle' | 'loading' | 'success' | 'denied' | 'unavailable';

export interface GeoState {
  lat: number | null;
  lng: number | null;
  status: GeoStatus;
  erro: string | null;
}

interface UseGeolocationReturn extends GeoState {
  requestLocation: () => void;  // Dispara pedido de permissão
  resetLocation: () => void;    // Volta para estado inicial
}
// #endregion

// #region Constantes
// Fallback: São Paulo centro — usado quando permissão é negada
// Permite que o app funcione sem geolocalização (mostra ofertas da cidade)
const FALLBACK_LAT = -23.5505;
const FALLBACK_LNG = -46.6333;

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,      // 10s — evita espera infinita no mobile
  maximumAge: 60_000,   // Aceita posição com até 1 min de cache
};
// #endregion

// #region Hook
const useGeolocation = (): UseGeolocationReturn => {
  const [state, setState] = useState<GeoState>({
    lat: null,
    lng: null,
    status: 'idle',
    erro: null,
  });

  const requestLocation = useCallback(() => {
    // Verifica suporte da API antes de pedir permissão
    if (!navigator.geolocation) {
      setState({
        lat: FALLBACK_LAT,
        lng: FALLBACK_LNG,
        status: 'unavailable',
        erro: 'Geolocalização não suportada neste dispositivo.',
      });
      return;
    }

    setState((prev) => ({ ...prev, status: 'loading', erro: null }));

    navigator.geolocation.getCurrentPosition(
      // Sucesso
      (position) => {
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          status: 'success',
          erro: null,
        });
      },
      // Erro — mapeia código para mensagem amigável
      (error) => {
        const mensagem =
          error.code === error.PERMISSION_DENIED
            ? 'Permissão de localização negada.'
            : error.code === error.TIMEOUT
            ? 'Tempo limite excedido ao obter localização.'
            : 'Não foi possível obter sua localização.';

        // Usa fallback para não bloquear o app
        setState({
          lat: FALLBACK_LAT,
          lng: FALLBACK_LNG,
          status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
          erro: mensagem,
        });
      },
      GEO_OPTIONS
    );
  }, []);

  const resetLocation = useCallback(() => {
    setState({ lat: null, lng: null, status: 'idle', erro: null });
  }, []);

  return { ...state, requestLocation, resetLocation };
};
// #endregion

export default useGeolocation;

// ============================================================
// FIM: src/hooks/useGeolocation.ts
// ============================================================
