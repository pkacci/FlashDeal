// ==========================================
// [ARQUIVO] reserva.ts v1.0
// [DATA] 2026-02-25
// [REQUER] oferta.ts
// ==========================================

import { Timestamp } from 'firebase/firestore'

// #region ENUMS
export type StatusReserva =
  | 'pendente'    // Aguardando pagamento Pix
  | 'confirmado'  // Pix confirmado, voucher gerado
  | 'usado'       // Voucher escaneado pela PME
  | 'cancelado'   // Cancelado pelo consumidor
  | 'expirado'    // Pix não pago em 15min
// #endregion ENUMS

// #region RESERVA — Espelha /reservas/{id} no Firestore
export interface Reserva {
  id: string
  ofertaId: string
  pmeId: string
  consumidorId: string
  consumidorNome: string
  consumidorTelefone: string
  ofertaTitulo: string
  valorPago: number
  pixTransacaoId?: string
  pixQrCode?: string          // QR Code base64 para exibir
  pixIdempotencyKey?: string  // Anti-replay no webhook
  processado: boolean         // Controle de duplicidade
  voucherCodigo?: string      // FD-XXXXXXXX
  voucherQrCode?: string      // QR Code do voucher
  status: StatusReserva
  motivoCancelamento?: string
  createdAt: Timestamp
  dataConfirmacao?: Timestamp
  dataCancelamento?: Timestamp
  dataUso?: Timestamp
}
// #endregion RESERVA
