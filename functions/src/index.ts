// ============================================================
// INÍCIO: functions/src/index.ts
// Versão: 3.0.0 | Security Review 2026-02-28
//
// FIXES APLICADOS (ver SECURITY_AUDIT.md):
//   [P0-1] webhookPix: verificação de token Asaas anti-forgery
//   [P0-2] gerarPix: transação atômica elimina race condition de estoque
//   [P0-3] promoverParaPME: whitelist explícita de campos (anti mass-assignment)
//   [P1-4] confirmarPagamentoManual: sandbox gate — bloqueado em produção
//   [P1-5] chatIA: key via process.env somente + validação de payload
//   [P1-6] validarCNPJ: auth obrigatória + fallback seguro (não valida CNPJ inválido)
//   [P2-7] gerarCodigoVoucher: crypto.randomBytes em vez de Math.random()
//   [ADJ]  limparReservasExpiradas: restaura estoque de pendentes com estoqueReservado
//   [ADJ]  webhookPix: remove decremento de estoque (agora feito em gerarPix)
//   [ADJ]  confirmarPagamentoManual: remove decremento de estoque
// ============================================================

import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto'; // [P2-7] CSPRNG para vouchers

import {
  onCall,
  onRequest,
  HttpsError,
  CallableRequest,
} from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { auth } from 'firebase-functions/v1'; // auth.user().onCreate ainda é v1

admin.initializeApp();
const db = admin.firestore();

// ============================================================
// HELPERS
// ============================================================

// [P2-7] Usa crypto.randomBytes em vez de Math.random() — resistente a previsão
function gerarCodigoVoucher(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = 'FD-';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

async function enviarNotificacao(
  uid: string,
  titulo: string,
  corpo: string
): Promise<void> {
  try {
    const snap = await db.collection('consumidores').doc(uid).get();
    const token = snap.data()?.fcmToken;
    if (!token) return;
    await admin.messaging().send({
      token,
      notification: { title: titulo, body: corpo },
    });
  } catch {
    // Notificação é best-effort — não bloqueia o fluxo principal
  }
}

// ============================================================
// FUNCTION 1: onUserCreate (v1 — auth trigger só existe no v1)
// ============================================================
export const onUserCreate = auth.user().onCreate(async (user) => {
  const { uid, email, phoneNumber, displayName, photoURL } = user;

  // Por padrão, cria como consumidor; PME é promovida via promoverParaPME()
  const agora = admin.firestore.Timestamp.now();

  await db.collection('consumidores').doc(uid).set({
    id: uid,
    nome: displayName ?? '',
    email: email ?? '',
    telefone: phoneNumber ?? '',
    fotoPerfil: photoURL ?? null,
    notificacoesAtivas: true,
    totalReservas: 0,
    totalGasto: 0,
    createdAt: agora,
    updatedAt: agora,
  });

  await admin.auth().setCustomUserClaims(uid, { role: 'consumidor' });
});

// ============================================================
// FUNCTION 2: promoverParaPME
// [P0-3] Whitelist explícita de campos — elimina mass assignment via ...dados
// ============================================================
export const promoverParaPME = onCall(async (request: CallableRequest) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado');

  const raw = request.data as Record<string, unknown>;

  // [P0-3] Apenas campos explicitamente permitidos são aceitos.
  // Campos sensíveis (plano, limiteOfertas, verificada, etc.) são ignorados
  // mesmo que o cliente os envie — definidos abaixo com valores fixos.
  const camposPermitidos = {
    nomeFantasia: typeof raw.nomeFantasia === 'string'
      ? raw.nomeFantasia.trim().slice(0, 100)
      : '',
    cnpj: typeof raw.cnpj === 'string'
      ? raw.cnpj.replace(/\D/g, '').slice(0, 14)
      : '',
    categoria: typeof raw.categoria === 'string'
      ? raw.categoria.trim().slice(0, 30)
      : '',
    telefone: typeof raw.telefone === 'string'
      ? raw.telefone.replace(/\D/g, '').slice(0, 20)
      : null,
    endereco: (raw.endereco !== null && typeof raw.endereco === 'object')
      ? raw.endereco as Record<string, string>
      : {},
    imagemUrl: typeof raw.imagemUrl === 'string'
      ? raw.imagemUrl.slice(0, 500)
      : null,
    geo: (raw.geo !== null && typeof raw.geo === 'object') ? raw.geo : null,
    geohash: typeof raw.geohash === 'string'
      ? raw.geohash.slice(0, 20)
      : null,
  };

  await admin.auth().setCustomUserClaims(uid, { role: 'pme' });

  const agora = admin.firestore.Timestamp.now();
  await db.collection('pmes').doc(uid).set({
    id: uid,
    ...camposPermitidos,
    // Campos de controle: sempre definidos server-side, NUNCA aceitos do cliente
    plano: 'free',
    limiteOfertas: 10,
    ofertasCriadas: 0,
    ativa: true,
    verificada: false,
    createdAt: agora,
    updatedAt: agora,
  });

  return { sucesso: true };
});

// ============================================================
// FUNCTION 3: chatIA — onboarding conversacional com Gemini
// [P1-5] Chave via process.env somente | validação de payload
// ============================================================
export const chatIA = onCall(async (request: CallableRequest) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado');

  const { mensagens, dadosAtuais } = request.data as {
    mensagens: { role: string; content: string }[];
    dadosAtuais: Record<string, unknown>;
  };

  // [P1-5] Valida tamanho do payload antes de processar
  if (!Array.isArray(mensagens) || mensagens.length > 50) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos');
  }

  // Rate limit: 20 chamadas/uid/hora
  const agora = admin.firestore.Timestamp.now();
  const rateLimitRef = db.collection('rateLimits').doc(uid);
  const rateLimitSnap = await rateLimitRef.get();

  if (rateLimitSnap.exists) {
    const data = rateLimitSnap.data()!;
    const windowStart = data.chatIA?.windowStart?.toDate() ?? new Date(0);
    const count = data.chatIA?.count ?? 0;
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);

    if (windowStart > umaHoraAtras && count >= 20) {
      return { fallback: true, motivo: 'rate_limit' };
    }

    const novoCount = windowStart > umaHoraAtras ? count + 1 : 1;
    await rateLimitRef.update({
      'chatIA.count': novoCount,
      'chatIA.windowStart': windowStart > umaHoraAtras ? data.chatIA.windowStart : agora,
    });
  } else {
    await rateLimitRef.set({ chatIA: { count: 1, windowStart: agora } });
  }

  // [P1-5] Usa APENAS process.env — defineString deve ser chamado no nível do módulo,
  //        não dentro de funções. Injetar via --set-secrets no deploy.
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('chatIA: GEMINI_API_KEY não configurada. Use --set-secrets no deploy.');
    return { fallback: true, motivo: 'config_error' };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `Você é um assistente amigável que ajuda PMEs brasileiras a se cadastrarem no LiquiBairro.
Extraia os dados: nomeFantasia, cnpj, categoria (restaurante/supermercado/beleza/fitness/saude/educacao/pet/bar/hotel/servicos/varejo), telefone.
Responda em JSON: { "resposta": "mensagem amigável", "dadosExtraidos": {...}, "concluido": false }
Quando tiver todos os dados obrigatórios (nomeFantasia + cnpj + categoria), defina concluido: true.
Dados já coletados: ${JSON.stringify(dadosAtuais)}`
            }]
          },
          contents: mensagens.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            // [P1-5] Limita tamanho de cada mensagem para evitar abuso de quota Gemini
            parts: [{ text: typeof m.content === 'string' ? m.content.slice(0, 2000) : '' }],
          })),
        }),
      }
    );

    const json = await response.json() as {
      candidates?: { content: { parts: { text: string }[] } }[]
    };
    const texto = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const match = texto.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed;
    }

    return { fallback: true };
  } catch {
    return { fallback: true };
  }
});

// ============================================================
// FUNCTION 4: validarCNPJ — via BrasilAPI
// [P1-6] Auth obrigatória | fallback seguro (rejeita CNPJ em caso de falha)
// ============================================================
export const validarCNPJ = onCall(async (request: CallableRequest) => {
  // [P1-6] Exige autenticação — evita scraping/abuso da BrasilAPI via proxy
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado');

  const { cnpj } = request.data as { cnpj: string };
  const cnpjLimpo = cnpj.replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) {
    throw new HttpsError('invalid-argument', 'CNPJ inválido');
  }

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`
    );

    if (!response.ok) {
      return { valido: false, mensagem: 'CNPJ não encontrado' };
    }

    const dados = await response.json() as Record<string, unknown>;

    return {
      valido: true,
      dados: {
        razaoSocial: dados.razao_social,
        nomeFantasia: dados.nome_fantasia || dados.razao_social,
        endereco: {
          rua: dados.logradouro,
          numero: dados.numero,
          bairro: dados.bairro,
          cidade: dados.municipio,
          estado: dados.uf,
          cep: dados.cep,
        },
        telefone: dados.ddd_telefone_1,
        situacao: dados.descricao_situacao_cadastral,
      },
    };
  } catch {
    // [P1-6] BrasilAPI offline → retorna ERRO, nunca valida automaticamente.
    // Antes retornava { valido: true } — isso permitia CNPJ falso em caso de falha.
    console.warn('validarCNPJ: BrasilAPI indisponível para CNPJ', cnpjLimpo.slice(0, 4) + '...');
    return {
      valido: false,
      mensagem: 'Serviço de validação temporariamente indisponível. Tente novamente em instantes.',
    };
  }
});

// ============================================================
// FUNCTION 5: gerarPix — cria reserva e QR Code Pix
// [P0-2] Transação atômica: verifica + decrementa estoque atomicamente
//        Elimina race condition que causava overselling
// ============================================================
export const gerarPix = onCall(async (request: CallableRequest) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado');

  const { ofertaId } = request.data as { ofertaId: string };
  const agora = admin.firestore.Timestamp.now();

  // Verifica consumidor antes da transação
  const consumidorSnap = await db.collection('consumidores').doc(uid).get();
  if (!consumidorSnap.exists) {
    throw new HttpsError('not-found', 'Consumidor não encontrado');
  }
  const consumidor = consumidorSnap.data()!;

  const reservaRef = db.collection('reservas').doc();

  // Captura dados da oferta fora da transação para uso posterior
  let ofertaCapturada: admin.firestore.DocumentData;

  // [P0-2] Transação atômica: garante que verificação de estoque e decremento
  //        são inseparáveis. Sem isso, múltiplas chamadas concorrentes passavam
  //        pela verificação e criavam reservas além do estoque disponível.
  try {
    await db.runTransaction(async (tx) => {
      const ofertaSnap = await tx.get(db.collection('ofertas').doc(ofertaId));

      if (!ofertaSnap.exists) {
        throw new HttpsError('not-found', 'Oferta não encontrada');
      }

      const oferta = ofertaSnap.data()!;

      if (!oferta.ativa) {
        throw new HttpsError('failed-precondition', 'Oferta inativa');
      }
      if (typeof oferta.dataFim?.toDate !== 'function' || oferta.dataFim.toDate() < new Date()) {
        throw new HttpsError('failed-precondition', 'Oferta expirada');
      }
      if ((oferta.quantidadeDisponivel ?? 0) <= 0) {
        throw new HttpsError('failed-precondition', 'Oferta esgotada');
      }

      ofertaCapturada = oferta;

      // Decrementa estoque dentro da transação (atômico + consistente)
      tx.update(db.collection('ofertas').doc(ofertaId), {
        quantidadeDisponivel: admin.firestore.FieldValue.increment(-1),
      });

      // Cria reserva com flag estoqueReservado para restauração em caso de expiração
      tx.set(reservaRef, {
        id: reservaRef.id,
        ofertaId,
        pmeId: oferta.pmeId,
        consumidorId: uid,
        consumidorNome: consumidor.nome ?? '',
        consumidorTelefone: consumidor.telefone ?? '',
        ofertaTitulo: oferta.titulo,
        ofertaDataFim: oferta.dataFim,
        pmeNome: oferta.pmeNome ?? '',
        pmeEndereco: oferta.endereco ?? {},
        valorPago: oferta.valorOferta,
        pixIdempotencyKey: `IDMP-${uid}-${ofertaId}-${Date.now()}`,
        processado: false,
        estoqueReservado: true, // sinaliza limparReservasExpiradas para restaurar o estoque
        status: 'pendente',
        createdAt: agora,
      });
    });
  } catch (err) {
    // Propaga HttpsError sem alterar
    if (err instanceof HttpsError) throw err;
    console.error('gerarPix: Erro na transação:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    throw new HttpsError('internal', 'Erro ao processar reserva. Tente novamente.');
  }

  const pixKey = process.env.ASAAS_API_KEY;
  console.log('DEBUG pixKey presente:', !!pixKey, '| tamanho:', pixKey?.length ?? 0);

  if (!pixKey) {
    // Modo sandbox/simulação para testes beta
    const pixCopiaCola = `00020126580014BR.GOV.BCB.PIX0136${reservaRef.id}5204000053039865802BR5925LIQUIBAIRRO PAGAMENTOS6009SAO PAULO62070503***6304`;
    return {
      reservaId: reservaRef.id,
      pixQrCode: null,
      pixCopiaCola,
      expiraEm: 600,
      sandbox: true,
    };
  }

  try {
    const response = await fetch('https://sandbox.asaas.com/api/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': pixKey,
      },
      body: JSON.stringify({
        billingType: 'PIX',
        value: ofertaCapturada!.valorOferta,
        dueDate: new Date(Date.now() + 10 * 60 * 1000).toISOString().split('T')[0],
        description: ofertaCapturada!.titulo,
        externalReference: reservaRef.id,
      }),
    });

    const pagamento = await response.json() as {
      id: string;
      encodedImage?: string;
      payload?: string;
    };

    await reservaRef.update({
      pixTransacaoId: pagamento.id,
    });

    return {
      reservaId: reservaRef.id,
      pixQrCode: pagamento.encodedImage ?? null,
      pixCopiaCola: pagamento.payload ?? '',
      expiraEm: 600,
    };
  } catch (err) {
    console.error('ERRO gerarPix Asaas:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    // Estoque já foi decrementado na transação — restaura e cancela reserva
    const batch = db.batch();
    batch.update(db.collection('ofertas').doc(ofertaId), {
      quantidadeDisponivel: admin.firestore.FieldValue.increment(1),
    });
    batch.delete(reservaRef);
    await batch.commit();
    throw new HttpsError('internal', 'Erro ao gerar Pix. Tente novamente.');
  }
});

// ============================================================
// FUNCTION 6: webhookPix — confirma pagamento
// [P0-1] Verifica token Asaas antes de processar qualquer evento
// [ADJ]  Não decrementa mais estoque (já decrementado em gerarPix)
// ============================================================
export const webhookPix = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // [P0-1] Verifica autenticidade do webhook via token do Asaas.
  // Sem isso, qualquer atacante que conheça a URL pode confirmar pagamentos falsos
  // e obter vouchers sem pagar.
  const pixKey = process.env.ASAAS_API_KEY;
  const tokenRecebido = req.headers['asaas-access-token'];

  if (!pixKey || tokenRecebido !== pixKey) {
    console.warn('webhookPix: token Asaas inválido ou ausente. Possível ataque de forgery.', {
      tokenPresente: !!tokenRecebido,
    });
    res.status(401).send('Unauthorized');
    return;
  }

  const evento = req.body;

  if (!['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(evento.event)) {
    res.status(200).send('Evento ignorado');
    return;
  }

  const pagamentoId = evento.payment?.id;
  if (!pagamentoId) {
    res.status(400).send('ID de pagamento ausente');
    return;
  }

  const reservasSnap = await db.collection('reservas')
    .where('pixTransacaoId', '==', pagamentoId)
    .limit(1)
    .get();

  if (reservasSnap.empty) {
    res.status(200).send('Reserva não encontrada');
    return;
  }

  const reservaDoc = reservasSnap.docs[0];
  const reserva = reservaDoc.data();

  // Anti-replay
  if (reserva.processado === true) {
    res.status(200).send('Já processado');
    return;
  }

  const voucherCodigo = gerarCodigoVoucher();
  const agora = admin.firestore.Timestamp.now();

  // [ADJ] Estoque já foi decrementado em gerarPix (transação atômica).
  //       Apenas confirma o pagamento e gera o voucher.
  await reservaDoc.ref.update({
    status: 'confirmado',
    processado: true,
    voucherCodigo,
    dataConfirmacao: agora,
  });

  // Notifica (best-effort)
  await enviarNotificacao(
    reserva.consumidorId,
    '✅ Pagamento confirmado!',
    `Seu voucher ${voucherCodigo} está pronto.`
  );

  res.status(200).send('OK');
});

// ============================================================
// FUNCTION 7: confirmarPagamentoManual — testes beta (sandbox)
// [P1-4] Sandbox gate: bloqueado quando ASAAS_API_KEY está configurada em produção
// [ADJ]  Não decrementa mais estoque (já decrementado em gerarPix)
// ============================================================
export const confirmarPagamentoManual = onCall(async (request: CallableRequest) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado');

  // [P1-4] Sandbox gate: se ASAAS_API_KEY está presente (produção), bloqueia.
  // Sem isso, qualquer consumidor pode confirmar seu próprio pagamento sem pagar.
  const emProducao = !!process.env.ASAAS_API_KEY && process.env.SANDBOX_MODE !== 'true';
  if (emProducao) {
    // Retorna 'not-found' para não vazar informação sobre a existência da função
    throw new HttpsError('not-found', 'Função não disponível');
  }

  const { reservaId } = request.data as { reservaId: string };

  const reservaSnap = await db.collection('reservas').doc(reservaId).get();
  if (!reservaSnap.exists) throw new HttpsError('not-found', 'Reserva não encontrada');

  const reserva = reservaSnap.data()!;
  if (reserva.consumidorId !== uid) throw new HttpsError('permission-denied', 'Sem permissão');
  if (reserva.processado) return { voucherCodigo: reserva.voucherCodigo };

  const voucherCodigo = gerarCodigoVoucher();
  const agora = admin.firestore.Timestamp.now();

  // [ADJ] Estoque já decrementado em gerarPix — apenas confirma a reserva
  await reservaSnap.ref.update({
    status: 'confirmado',
    processado: true,
    voucherCodigo,
    dataConfirmacao: agora,
  });

  return { voucherCodigo };
});

// ============================================================
// FUNCTION 8: cancelarReserva
// ============================================================
export const cancelarReserva = onCall(async (request: CallableRequest) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado');

  const { reservaId, motivoCancelamento } = request.data as {
    reservaId: string;
    motivoCancelamento?: string;
  };

  const reservaSnap = await db.collection('reservas').doc(reservaId).get();
  if (!reservaSnap.exists) throw new HttpsError('not-found', 'Reserva não encontrada');

  const reserva = reservaSnap.data()!;
  if (reserva.consumidorId !== uid) throw new HttpsError('permission-denied', 'Sem permissão');
  if (reserva.status !== 'confirmado') {
    throw new HttpsError('failed-precondition', 'Reserva não pode ser cancelada');
  }

  const agora = admin.firestore.Timestamp.now();
  const ofertaSnap = await db.collection('ofertas').doc(reserva.ofertaId).get();
  const oferta = ofertaSnap.data();
  const trintaMinutesAntes = new Date(
    (oferta?.dataFim?.toDate()?.getTime() ?? 0) - 30 * 60 * 1000
  );

  if (new Date() > trintaMinutesAntes) {
    throw new HttpsError('failed-precondition', 'Prazo de cancelamento encerrado');
  }

  const batch = db.batch();
  batch.update(reservaSnap.ref, {
    status: 'cancelado',
    dataCancelamento: agora,
    motivoCancelamento: motivoCancelamento ?? 'Cancelado pelo usuário',
  });
  // Restaura estoque ao cancelar reserva confirmada
  batch.update(db.collection('ofertas').doc(reserva.ofertaId), {
    quantidadeDisponivel: admin.firestore.FieldValue.increment(1),
  });
  await batch.commit();

  // Notifica PME
  await enviarNotificacao(
    reserva.pmeId,
    '⚠️ Reserva cancelada',
    `Reembolsar R$ ${reserva.valorPago.toFixed(2)} para ${reserva.consumidorNome} via Pix`
  );

  return { sucesso: true };
});

// ============================================================
// FUNCTION 9: validarVoucher — PME valida voucher do cliente
// ============================================================
export const validarVoucher = onCall(async (request: CallableRequest) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado');

  const { codigo } = request.data as { codigo: string };

  const reservasSnap = await db.collection('reservas')
    .where('voucherCodigo', '==', codigo.toUpperCase())
    .limit(1)
    .get();

  if (reservasSnap.empty) {
    return { valido: false, motivo: 'Voucher não encontrado' };
  }

  const reserva = reservasSnap.docs[0].data();

  if (reserva.pmeId !== uid) {
    return { valido: false, motivo: 'Voucher de outra loja' };
  }
  if (reserva.status === 'usado') {
    return { valido: false, motivo: 'Voucher já utilizado' };
  }
  if (reserva.status === 'cancelado') {
    return { valido: false, motivo: 'Voucher cancelado' };
  }
  if (reserva.status !== 'confirmado') {
    return { valido: false, motivo: 'Pagamento pendente' };
  }

  return {
    valido: true,
    reservaId: reservasSnap.docs[0].id,
    ofertaTitulo: reserva.ofertaTitulo,
    consumidorNome: reserva.consumidorNome,
    valorPago: reserva.valorPago,
  };
});

// ============================================================
// FUNCTION 10: confirmarEntrega — PME marca voucher como usado
// ============================================================
export const confirmarEntrega = onCall(async (request: CallableRequest) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado');

  const { reservaId } = request.data as { reservaId: string };

  const reservaSnap = await db.collection('reservas').doc(reservaId).get();
  if (!reservaSnap.exists) throw new HttpsError('not-found', 'Reserva não encontrada');

  const reserva = reservaSnap.data()!;
  if (reserva.pmeId !== uid) throw new HttpsError('permission-denied', 'Sem permissão');

  await reservaSnap.ref.update({
    status: 'usado',
    dataUso: admin.firestore.Timestamp.now(),
  });

  await enviarNotificacao(
    reserva.consumidorId,
    '⭐ Como foi?',
    `Avalie sua experiência em ${reserva.pmeNome}`
  );

  return { sucesso: true };
});

// ============================================================
// CRON 1: expirarOfertas — a cada 1 hora
// ============================================================
export const expirarOfertas = onSchedule('every 60 minutes', async () => {
  const agora = admin.firestore.Timestamp.now();
  const snap = await db.collection('ofertas')
    .where('ativa', '==', true)
    .where('dataFim', '<', agora)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.update(doc.ref, { ativa: false }));
  await batch.commit();
});

// ============================================================
// CRON 2: limparReservasExpiradas — a cada 15 minutos
// [ADJ] Restaura estoque de reservas com estoqueReservado: true
//       (aquelas criadas após o fix P0-2 em gerarPix)
// ============================================================
export const limparReservasExpiradas = onSchedule('every 15 minutes', async () => {
  const quinzeMinutosAtras = new Date(Date.now() - 15 * 60 * 1000);
  const limite = admin.firestore.Timestamp.fromDate(quinzeMinutosAtras);

  const snap = await db.collection('reservas')
    .where('status', '==', 'pendente')
    .where('createdAt', '<', limite)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    const reserva = doc.data();

    batch.update(doc.ref, { status: 'expirado' });

    // [ADJ] Restaura estoque apenas para reservas criadas com a nova lógica
    // (estoqueReservado: true). Reservas antigas (sem esse campo) não decrementaram
    // estoque em gerarPix, portanto não precisam ser restauradas.
    if (reserva.estoqueReservado === true) {
      batch.update(db.collection('ofertas').doc(reserva.ofertaId), {
        quantidadeDisponivel: admin.firestore.FieldValue.increment(1),
      });
    }
  });

  await batch.commit();
});

// ============================================================
// CRON 3: notificarVouchersExpirando — a cada 30 minutos
// ============================================================
export const notificarVouchersExpirando = onSchedule('every 30 minutes', async () => {
  const agora = new Date();
  const umaHora = new Date(agora.getTime() + 60 * 60 * 1000);

  const snap = await db.collection('reservas')
    .where('status', '==', 'confirmado')
    .get();

  for (const doc of snap.docs) {
    const reserva = doc.data();
    const dataFim = reserva.ofertaDataFim?.toDate();
    if (dataFim && dataFim > agora && dataFim < umaHora) {
      await enviarNotificacao(
        reserva.consumidorId,
        '⏰ Voucher expirando!',
        `Seu voucher de ${reserva.ofertaTitulo} expira em menos de 1 hora.`
      );
    }
  }
});

// ============================================================
// CRON 4: resetarContadoresOfertas — dia 1 de cada mês
// ============================================================
export const resetarContadoresOfertas = onSchedule('0 0 1 * *', async () => {
  const snap = await db.collection('pmes')
    .where('plano', '==', 'free')
    .get();

  if (snap.empty) return;

  const agora = admin.firestore.Timestamp.now();
  const chunks: FirebaseFirestore.QueryDocumentSnapshot[][] = [];

  for (let i = 0; i < snap.docs.length; i += 500) {
    chunks.push(snap.docs.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach((doc) => {
      batch.update(doc.ref, { ofertasCriadas: 0, resetData: agora });
    });
    await batch.commit();
  }
});

// Trigger auxiliar: quando PME cria oferta, incrementa contador
export const onOfertaCreated = onDocumentCreated('ofertas/{ofertaId}', async (event) => {
  const oferta = event.data?.data();
  if (!oferta?.pmeId) return;

  await db.collection('pmes').doc(oferta.pmeId).update({
    ofertasCriadas: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.Timestamp.now(),
  });
});

// ============================================================
// FIM: functions/src/index.ts
// ============================================================
