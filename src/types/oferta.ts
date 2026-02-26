// ============================================================
// INÍCIO: src/types/oferta.ts
// Versão: 1.1.0 | Correção: endereco adicionado
// ============================================================

import { Timestamp, GeoPoint } from 'firebase/firestore';

export interface Oferta {
  id: string;
  pmeId: string;
  pmeNome: string;
  pmeCategoria: string;
  titulo: string;
  valorOriginal: number;
  valorOferta: number;
  desconto: number;
  quantidadeTotal: number;
  quantidadeDisponivel: number;
  dataInicio: Timestamp;
  dataFim: Timestamp;
  ativa: boolean;
  geo: GeoPoint;
  geohash: string;
  cidade: string;
  estado: string;
  imagemUrl?: string;
  endereco?: Record<string, string>; // ← adicionado
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// FIM: src/types/oferta.ts
// ============================================================
