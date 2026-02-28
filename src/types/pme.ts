// ==========================================
// [ARQUIVO] pme.ts v1.0
// [DATA] 2026-02-25
// [REQUER] firebase.ts
// ==========================================

import { Timestamp, GeoPoint } from 'firebase/firestore'

// #region ENUMS
export type PlanoPME = 'free' | 'pro' | 'premium'
export type CategoriaPME =
  | 'restaurante'
  | 'beleza'
  | 'fitness'
  | 'estetica'
  | 'varejo'
  | 'servicos'
// #endregion ENUMS

// #region ENDERECO
export interface EnderecoPME {
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  geo: GeoPoint        // Coordenadas para o mapa
}
// #endregion ENDERECO

// #region PME — Espelha /pmes/{uid} no Firestore
export interface PME {
  id: string
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  categoria: CategoriaPME
  subcategoria?: string
  endereco: EnderecoPME
  geo?: GeoPoint         // Coordenadas raiz (para queries geohash)
  geohash: string        // Queries por raio (geofire-common)
  telefone: string
  email: string
  imagemUrl?: string     // Foto da fachada .webp
  plano: PlanoPME
  limiteOfertas: number  // 10 free | ilimitado pro
  ofertasCriadas: number // Contador mensal
  resetData: Timestamp   // Reset dia 1 de cada mês
  ativa: boolean
  verificada: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
// #endregion PME

// #region FORM — Dados do onboarding
export interface PMEFormData {
  nomeFantasia: string
  cnpj: string
  categoria: CategoriaPME
  subcategoria?: string
  telefone: string
  endereco: Omit<EnderecoPME, 'geo'>
  imagemFile?: File      // Upload da fachada
}
// #endregion FORM
