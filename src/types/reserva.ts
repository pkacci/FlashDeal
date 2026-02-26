// ============================================================
// INÍCIO: src/types/reserva.ts
// Versão: 1.1.0 | Correção: campos pmeNome, pmeEndereco,
//                            ofertaDataFim adicionados
// ============================================================

import { Timestamp } from 'firebase/firestore';

export interface Reserva {
  id: string;
  ofertaId: string;
  pmeId: string;
  consumidorId: string;
  consumidorNome: string;
  consumidorTelefone: string;
  ofertaTitulo: string;
  ofertaDataFim: Timestamp;        // ← adicionado
  pmeNome: string;                  // ← adicionado
  pmeEndereco: Record<string, string>; // ← adicionado
  valorPago: number;
  pixTransacaoId?: string;
  pixQrCode?: string;
  pixCopiaCola?: string;
  pixIdempotencyKey?: string;
  processado: boolean;
  voucherCodigo?: string;
  voucherQrCode?: string;
  status: 'pendente' | 'confirmado' | 'usado' | 'cancelado' | 'expirado';
  motivoCancelamento?: string;
  createdAt: Timestamp;
  dataConfirmacao?: Timestamp;
  dataCancelamento?: Timestamp;
  dataUso?: Timestamp;
}

// ============================================================
// FIM: src/types/reserva.ts
// ============================================================
