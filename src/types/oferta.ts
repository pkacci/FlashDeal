// ==========================================
// [ARQUIVO] oferta.ts v1.0
// [DATA] 2026-02-25
// [REQUER] pme.ts
// ==========================================

import { Timestamp, GeoPoint } from 'firebase/firestore'
import { CategoriaPME } from './pme'

// #region OFERTA — Espelha /ofertas/{id} no Firestore
export interface Oferta {
  id: string
  pmeId: string
  pmeNome: string
  pmeCategoria: CategoriaPME
  titulo: string
  valorOriginal: number
  valorOferta: number
  desconto: number           // Percentual 5-80%
  quantidadeTotal: number
  quantidadeDisponivel: number
  dataInicio: Timestamp
  dataFim: Timestamp
  ativa: boolean
  geo: GeoPoint              // Localização da PME
  geohash: string            // Queries por raio
  cidade: string
  estado: string
  imagemUrl?: string         // Foto da oferta .webp
  createdAt: Timestamp
  updatedAt: Timestamp
}
// #endregion OFERTA

// #region COMPUTED — Campos calculados no frontend
export interface OfertaComDistancia extends Oferta {
  distanciaMetros: number    // Calculado via Haversine
  distanciaLabel: string     // "350m" ou "1.2km"
  minutosRestantes: number   // Para o timer
  percentualVendido: number  // Para a StockBar
}
// #endregion COMPUTED

// #region FORM — Dados para criar oferta
export interface OfertaFormData {
  titulo: string
  valorOriginal: number
  desconto: number
  quantidadeTotal: number
  dataFim: Date
  imagemFile?: File
}
// #endregion FORM

// #region TEMPLATE — Smart Templates locais
export interface SmartTemplate {
  id: string
  label: string              // "🔥 MAIS POPULAR"
  titulo: string             // Template do título
  descontoSugerido: number
  horarioIdeal?: string      // "Qui-Sex 17h-19h"
  categoria: CategoriaPME[]  // Categorias compatíveis
}
// #endregion TEMPLATE

