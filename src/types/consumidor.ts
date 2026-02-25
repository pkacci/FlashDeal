// ==========================================
// [ARQUIVO] consumidor.ts v1.0
// [DATA] 2026-02-25
// [REQUER] firebase.ts
// ==========================================

import { Timestamp, GeoPoint } from 'firebase/firestore'

// #region CONSUMIDOR — Espelha /consumidores/{uid} no Firestore
export interface Consumidor {
  id: string
  nome: string
  telefone?: string
  email?: string
  fotoPerfil?: string        // Google avatar ou null
  geo?: GeoPoint             // Última localização conhecida
  geohash?: string
  notificacoesAtivas: boolean
  totalReservas: number
  totalGasto: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
// #endregion CONSUMIDOR

// #region AUTH — Dados do usuário logado
export type UserRole = 'pme' | 'consumidor' | null

export interface AuthUser {
  uid: string
  email?: string
  displayName?: string
  photoURL?: string
  role: UserRole             // Custom claim do Firebase Auth
  phoneNumber?: string
}
// #endregion AUTH
