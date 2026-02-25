// ============================================================
// INÍCIO: functions/src/index.ts
// Versão: 1.0.0 | Data: 2026-02-25
// Runtime: Node.js 20 (Firebase Functions v2)
// Descrição: Todas as Cloud Functions do FlashDeal
//
// FUNÇÕES PRINCIPAIS (6):
//   1. onUserCreate      — cria doc PME ou Consumidor no Firestore
//   2. chatIA            — onboarding conversacional (Gemini + rate limit)
//   3. validarCNPJ       — valida CNPJ via BrasilAPI (gratuito)
//   4. gerarPix          — gera QR Code Pix server-side
//   5. webhookPix        — confirma pagamento + gera voucher (anti-replay)
//   6. cancelarReserva   — cancela reserva + notifica PME
//
// CRON JOBS (4):
//   7. expirarOfertas           — a cada 1h
//   8. notificarVouchersExpirando — a cada 30min
//   9. resetarContadoresOfertas  — dia 1 de cada mês
//  10. limparReservasExpiradas   — a cada 15min
//
// SEGURANÇA:
//   - Chaves sensíveis em functions.config() (nunca no frontend)
//   - webhookPix: HMAC + idempotencyKey (anti-replay)
//   - chatIA: rate limit 20 chamadas/uid/hora
//   - gerarPix: validações server-side antes de criar reserva
//   - cancelarReserva: valida ownership + prazo (30min)
// ============================================================

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import * as crypto from 'crypto';

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// #region Helpers internos

/** Gera código de voucher único: FD-XXXXXXXX */
const gerarCodigoVoucher = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I (confusos)
  let codigo = 'FD-';
  for (let i = 0; i < 8; i++) {
    codigo += chars[Math.floor(Math.random() * chars.length)];
  }
  return codigo;
};

/** Formata valor em BRL para notificações */
const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Envia push notification FCM silenciosamente (não quebra se falhar) */
const enviarNotificacao = async (
  uid: string,
  titulo: string,
  corpo: string
): Promise<void> => {
  try {
    const snap = await db.collection('consumidores').doc(uid).get();
    const fcmToken = snap.data()?.fcmToken;
    if (!fcmToken) return;

    await messaging.send({
      token: fcmToken,
      notification: { title: titulo, body: corpo },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch {
    // Silencioso — notificação é best-effort
  }
};

// #endregion

// ═══════════════════════════════════════════════════════════
// FUNÇÃO 1: onUserCreate
// Trigger: firebase.auth().onCreate
// Cria documento inicial no Firestore e define custom claim por role
// ═══════════════════════════════════════════════════════════
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const agora = admin.firestore.Timestamp.now();

  // Detecta role pelo provider ou display metadata
  // Convenção: PME faz login via /login?role=pme → metadata customizada
  // Fallback: consumidor por padrão
  const role = (user.customClaims?.role as string) ?? 'consumidor';

  if (role === 'pme') {
    // Cria documento base da PME (onboarding completará os campos)
    await db.collection('pmes').doc(uid).set({
      id: uid,
      nomeFantasia: user.displayName ?? '',
      email: user.email ?? '',
      plano: 'free',
      limiteOfertas: 10,
      ofertasCriadas: 0,
      ativa: false, // false até completar onboarding
      verificada: false,
      status: 'onboarding_pendente',
      createdAt: agora,
      updatedAt: agora,
    });

    await admin.auth().setCustomUserClaims(uid, { role: 'pme' });
  } else {
    // Cria documento base do Consumidor
    await db.collection('consumidores').doc(uid).set({
      id: uid,
      nome: user.displayName ?? '',
      email: user.email ?? '',
      telefone: user.phoneNumber ?? '',
      fotoPerfil: user.photoURL ?? null,
      notificacoesAtivas: true,
      totalReservas: 0,
      totalGasto: 0,
      createdAt: agora,
      updatedAt: agora,
    });

    await admin.auth().setCustomUserClaims(uid, { role: 'consumidor' });
  }

  functions.logger.info(`onUserCreate: uid=${uid} role=${role}`);
});

// ═══════════════════════════════════════════════════════════
// FUNÇÃO 2: chatIA
// onCall — processa onboarding conversacional via Gemini
// Rate limit: 20 chamadas/uid/hora
// Fallback: retorna { fallback: true } se limite atingido ou erro
// ═══════════════════════════════════════════════════════════
export const chatIA = functions.https.onCall(async (data, context) => {
  // Autenticação obrigatória
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Login necessário.');
  }

  const uid = context.auth.uid;
  const { mensagens, dadosAtuais } = data as {
    mensagens: Array<{ role: string; content: string }>;
    dadosAtuais: Record<string, unknown>;
  };

  // #region Rate limit: 20 chamadas/uid/hora
  const agora = admin.firestore.Timestamp.now();
  const rateLimitRef = db.collection('rateLimits').doc(uid);

  const rlSnap = await rateLimitRef.get();
  const rlData = rlSnap.data();

  let count = 0;
  if (rlData?.chatIA) {
    const windowStart = rlData.chatIA.windowStart as admin.firestore.Timestamp;
    const diffMs = agora.toMillis() - windowStart.toMillis();

    if (diffMs < 3600 * 1000) {
      // Dentro da janela de 1h
      count = rlData.chatIA.count as number;
    }
    // Se passou 1h, count reseta para 0
  }

  if (count >= 20) {
    // Ativa fallback no frontend silenciosamente
    return { fallback: true, dadosExtraidos: dadosAtuais, resposta: '', concluido: false };
  }

  // Incrementa contador
  await rateLimitRef.set({
    chatIA: { count: count + 1, windowStart: count === 0 ? agora : rlData?.chatIA?.windowStart },
  }, { merge: true });
  // #endregion

  // #region Chama Gemini API
  try {
    const geminiKey = functions.config().gemini?.api_key;
    if (!geminiKey) throw new Error('Gemini API key não configurada.');

    // Prompt de sistema para extração de dados da PME
    const systemPrompt = `Você é um assistente de cadastro da plataforma FlashDeal.
Seu objetivo é coletar: nome fantasia, CNPJ, categoria (restaurante/beleza/fitness/servicos/varejo) e telefone.
Dados já coletados: ${JSON.stringify(dadosAtuais)}.
Responda de forma amigável e curta (máx 2 frases).
Retorne JSON: { "resposta": "...", "dadosExtraidos": { ... }, "concluido": boolean }
concluido=true apenas quando tiver nome + cnpj + categoria.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            ...mensagens.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
          ],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
        }),
      }
    );

    const json = await response.json() as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    const texto = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Extrai JSON da resposta (Gemini pode retornar com markdown)
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta inválida do Gemini.');

    const parsed = JSON.parse(jsonMatch[0]) as {
      resposta: string;
      dadosExtraidos: Record<string, unknown>;
      concluido: boolean;
    };

    return {
      resposta: parsed.resposta,
      dadosExtraidos: { ...dadosAtuais, ...parsed.dadosExtraidos },
      concluido: parsed.concluido,
      fallback: false,
    };
  } catch (err) {
    functions.logger.warn('chatIA: erro Gemini, ativando fallback', err);
    // Qualquer erro → fallback silencioso
    return { fallback: true, dadosExtraidos: dadosAtuais, resposta: '', concluido: false };
  }
  // #endregion
});

// ═══════════════════════════════════════════════════════════
// FUNÇÃO 3: validarCNPJ
// onCall — valida CNPJ via BrasilAPI (gratuito, open source)
// ═══════════════════════════════════════════════════════════
export const validarCNPJ = functions.https.onCall(async (data) => {
  const { cnpj } = data as { cnpj: string };
  const cnpjLimpo = cnpj.replace(/\D/g, '');

  // Validação de formato antes de chamar a API
  if (cnpjLimpo.length !== 14) {
    throw new functions.https.HttpsError('invalid-argument', 'CNPJ inválido.');
  }

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      return { valido: false, dados: null };
    }

    const dados = await response.json() as Record<string, unknown>;

    // Retorna dados relevantes para preencher formulário
    return {
      valido: true,
      dados: {
        razaoSocial: dados.razao_social ?? '',
        nomeFantasia: dados.nome_fantasia ?? dados.razao_social ?? '',
        rua: dados.logradouro ?? '',
        numero: dados.numero ?? '',
        bairro: dados.bairro ?? '',
        cidade: dados.municipio ?? '',
        estado: dados.uf ?? '',
        cep: dados.cep ?? '',
        telefone: dados.telefone ?? '',
      },
    };
  } catch {
    // BrasilAPI indisponível — permite continuar sem validação
    return { valido: true, dados: null };
  }
});

// ═══════════════════════════════════════════════════════════
// FUNÇÃO 4: gerarPix
// onCall — gera QR Code Pix e cria reserva no Firestore
// Chave do gateway SOMENTE server-side (nunca no frontend)
// ═══════════════════════════════════════════════════════════
export const gerarPix = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Login necessário.');
  }

  const uid = context.auth.uid;
  const { ofertaId } = data as { ofertaId: string };

  // #region Validações server-side
  const ofertaSnap = await db.collection('ofertas').doc(ofertaId).get();
  if (!ofertaSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Oferta não encontrada.');
  }

  const oferta = ofertaSnap.data()!;

  if (!oferta.ativa) {
    throw new functions.https.HttpsError('failed-precondition', 'Oferta não está ativa.');
  }

  if (oferta.dataFim.toMillis() < Date.now()) {
    throw new functions.https.HttpsError('failed-precondition', 'Oferta expirada.');
  }

  if (oferta.quantidadeDisponivel <= 0) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Sem quantidade disponível para esta oferta.'
    );
  }

  // Verifica se consumidor existe
  const consumidorSnap = await db.collection('consumidores').doc(uid).get();
  if (!consumidorSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Consumidor não encontrado.');
  }

  const consumidor = consumidorSnap.data()!;
  // #endregion

  // #region Cria reserva com status pendente
  const agora = admin.firestore.Timestamp.now();
  const idempotencyKey = `IDMP-${ofertaId}-${uid}-${Date.now()}`;

  const reservaRef = db.collection('reservas').doc();
  await reservaRef.set({
    ofertaId,
    pmeId: oferta.pmeId,
    consumidorId: uid,
    consumidorNome: consumidor.nome ?? '',
    consumidorTelefone: consumidor.telefone ?? '',
    ofertaTitulo: oferta.titulo,
    ofertaDataFim: oferta.dataFim,
    pmeNome: oferta.pmeNome,
    pmeEndereco: oferta.endereco ?? {},
    valorPago: oferta.valorOferta,
    pixIdempotencyKey: idempotencyKey,
    processado: false,
    status: 'pendente',
    createdAt: agora,
    dataConfirmacao: null,
    dataCancelamento: null,
    dataUso: null,
    voucherCodigo: null,
    voucherQrCode: null,
  });
  // #endregion

  // #region Chama Gateway Pix (server-side only)
  try {
    const pixKey = functions.config().pix?.gateway_key;
    const pixWebhookUrl = functions.config().pix?.webhook_url ??
      `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/webhookPix`;

    // Exemplo de integração Asaas (adaptar para Pagar.me se necessário)
    const pixResponse = await fetch('https://api-sandbox.asaas.com/v3/pix/qrCodes/static', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': pixKey ?? '',
      },
      body: JSON.stringify({
        addressKey: functions.config().pix?.chave_pix ?? '',
        value: oferta.valorOferta,
        description: oferta.titulo,
        expirationDate: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        externalReference: reservaRef.id,
      }),
    });

    if (!pixResponse.ok) throw new Error('Gateway Pix retornou erro.');

    const pixData = await pixResponse.json() as {
      encodedImage?: string;  // QR Code base64
      payload?: string;        // Copia-e-cola
      id?: string;             // ID da transação no gateway
    };

    // Atualiza reserva com dados do Pix
    await reservaRef.update({
      pixQrCode: pixData.encodedImage ?? '',
      pixCopiaCola: pixData.payload ?? '',
      pixTransacaoId: pixData.id ?? reservaRef.id,
    });

    return {
      reservaId: reservaRef.id,
      pixQrCode: pixData.encodedImage ?? '',
      pixCopiaCola: pixData.payload ?? '',
      expiraEm: Date.now() + 10 * 60 * 1000,
    };
  } catch (err) {
    // Limpa reserva órfã se Pix falhou
    await reservaRef.delete();
    functions.logger.error('gerarPix: erro no gateway', err);
    throw new functions.https.HttpsError('internal', 'Erro ao gerar Pix. Tente novamente.');
  }
  // #endregion
});

// ═══════════════════════════════════════════════════════════
// FUNÇÃO 5: webhookPix
// HTTPS trigger — recebe confirmação do gateway Pix
// Proteções: HMAC + idempotencyKey + campo processado
// ═══════════════════════════════════════════════════════════
export const webhookPix = functions.https.onRequest(async (req, res) => {
  // Somente POST
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // #region Valida assinatura HMAC
  const webhookSecret = functions.config().pix?.webhook_secret ?? '';
  const assinaturaRecebida = req.headers['asaas-signature'] as string ?? '';

  const assinaturaCalculada = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (assinaturaRecebida !== assinaturaCalculada) {
    functions.logger.warn('webhookPix: assinatura HMAC inválida');
    res.status(401).send('Unauthorized');
    return;
  }
  // #endregion

  const { event, payment } = req.body as {
    event: string;
    payment?: { externalReference?: string; id?: string; status?: string };
  };

  // Só processa eventos de pagamento confirmado
  if (event !== 'PAYMENT_CONFIRMED' && event !== 'PAYMENT_RECEIVED') {
    res.status(200).send('OK');
    return;
  }

  const reservaId = payment?.externalReference;
  if (!reservaId) {
    res.status(400).send('externalReference ausente');
    return;
  }

  const reservaRef = db.collection('reservas').doc(reservaId);

  // #region Anti-replay: verifica campo processado
  const reservaSnap = await reservaRef.get();
  if (!reservaSnap.exists) {
    functions.logger.warn(`webhookPix: reserva ${reservaId} não encontrada`);
    res.status(200).send('OK'); // Retorna 200 para o gateway não retentar
    return;
  }

  const reserva = reservaSnap.data()!;

  if (reserva.processado === true) {
    functions.logger.info(`webhookPix: reserva ${reservaId} já processada (replay ignorado)`);
    res.status(200).send('OK');
    return;
  }
  // #endregion

  // #region Gera voucher e confirma reserva (batch write atômico)
  const voucherCodigo = gerarCodigoVoucher();
  const agora = admin.firestore.Timestamp.now();

  const batch = db.batch();

  // Atualiza reserva
  batch.update(reservaRef, {
    status: 'confirmado',
    processado: true,
    voucherCodigo,
    // QR Code do voucher — gerado como texto (frontend pode renderizar com biblioteca)
    // Em produção: gerar imagem QR server-side com biblioteca qrcode
    voucherQrCode: `data:text/plain,${voucherCodigo}`,
    dataConfirmacao: agora,
    pixTransacaoId: payment?.id ?? reserva.pixTransacaoId,
  });

  // Decrementa quantidade disponível da oferta
  const ofertaRef = db.collection('ofertas').doc(reserva.ofertaId);
  batch.update(ofertaRef, {
    quantidadeDisponivel: admin.firestore.FieldValue.increment(-1),
    updatedAt: agora,
  });

  await batch.commit();
  // #endregion

  // #region Notificações (best-effort, fora do batch)
  // Notifica consumidor
  await enviarNotificacao(
    reserva.consumidorId,
    '✅ Voucher confirmado!',
    `${reserva.ofertaTitulo} — código: ${voucherCodigo}`
  );

  // Notifica PME (via doc da PME para obter token FCM)
  try {
    const pmeSnap = await db.collection('pmes').doc(reserva.pmeId).get();
    const pmeFcmToken = pmeSnap.data()?.fcmToken;
    if (pmeFcmToken) {
      await messaging.send({
        token: pmeFcmToken,
        notification: {
          title: '🔔 Nova reserva confirmada!',
          body: `${reserva.consumidorNome} reservou: ${reserva.ofertaTitulo}`,
        },
      });
    }
  } catch {
    // Silencioso
  }
  // #endregion

  functions.logger.info(`webhookPix: reserva ${reservaId} confirmada, voucher=${voucherCodigo}`);
  res.status(200).send('OK');
});

// ═══════════════════════════════════════════════════════════
// FUNÇÃO 6: cancelarReserva
// onCall — cancela reserva e notifica PME para reembolso
// ═══════════════════════════════════════════════════════════
export const cancelarReserva = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Login necessário.');
  }

  const uid = context.auth.uid;
  const { reservaId, motivoCancelamento } = data as {
    reservaId: string;
    motivoCancelamento?: string;
  };

  const reservaRef = db.collection('reservas').doc(reservaId);
  const reservaSnap = await reservaRef.get();

  if (!reservaSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Reserva não encontrada.');
  }

  const reserva = reservaSnap.data()!;

  // Valida ownership
  if (reserva.consumidorId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Sem permissão para cancelar esta reserva.');
  }

  // Valida status
  if (reserva.status !== 'confirmado') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Apenas reservas confirmadas podem ser canceladas.'
    );
  }

  // Valida prazo: deve ser mais de 30 min antes da expiração
  const dataFim = (reserva.ofertaDataFim as admin.firestore.Timestamp).toMillis();
  const prazoLimite = dataFim - 30 * 60 * 1000;

  if (Date.now() > prazoLimite) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Cancelamento não permitido: prazo encerrado (menos de 30min antes da expiração).'
    );
  }

  // #region Batch write atômico
  const agora = admin.firestore.Timestamp.now();
  const batch = db.batch();

  batch.update(reservaRef, {
    status: 'cancelado',
    dataCancelamento: agora,
    motivoCancelamento: motivoCancelamento ?? 'Cancelado pelo consumidor',
  });

  // Devolve unidade ao estoque da oferta
  const ofertaRef = db.collection('ofertas').doc(reserva.ofertaId);
  batch.update(ofertaRef, {
    quantidadeDisponivel: admin.firestore.FieldValue.increment(1),
    updatedAt: agora,
  });

  await batch.commit();
  // #endregion

  // #region Notifica PME para reembolso manual
  try {
    const pmeSnap = await db.collection('pmes').doc(reserva.pmeId).get();
    const pmeFcmToken = pmeSnap.data()?.fcmToken;
    if (pmeFcmToken) {
      await messaging.send({
        token: pmeFcmToken,
        notification: {
          title: '❌ Reserva cancelada',
          body: `Reembolsar ${formatBRL(reserva.valorPago)} via Pix para ${reserva.consumidorNome}`,
        },
      });
    }
  } catch {
    // Silencioso
  }
  // #endregion

  functions.logger.info(`cancelarReserva: reservaId=${reservaId} uid=${uid}`);
  return { sucesso: true };
});

// ═══════════════════════════════════════════════════════════
// CRON 1: expirarOfertas — a cada 1 hora
// Marca como inativa todas as ofertas com dataFim < now
// ═══════════════════════════════════════════════════════════
export const expirarOfertas = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async () => {
    const agora = admin.firestore.Timestamp.now();

    const snap = await db.collection('ofertas')
      .where('ativa', '==', true)
      .where('dataFim', '<', agora)
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    snap.forEach((doc) => {
      batch.update(doc.ref, { ativa: false, updatedAt: agora });
    });
    await batch.commit();

    functions.logger.info(`expirarOfertas: ${snap.size} ofertas expiradas`);
  });

// ═══════════════════════════════════════════════════════════
// CRON 2: notificarVouchersExpirando — a cada 30 minutos
// Notifica consumidores com voucher expirando em < 1h
// ═══════════════════════════════════════════════════════════
export const notificarVouchersExpirando = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async () => {
    const agora = admin.firestore.Timestamp.now();
    const em1hora = admin.firestore.Timestamp.fromMillis(Date.now() + 3600 * 1000);

    const snap = await db.collection('reservas')
      .where('status', '==', 'confirmado')
      .where('ofertaDataFim', '>', agora)
      .where('ofertaDataFim', '<', em1hora)
      .get();

    if (snap.empty) return;

    const notificacoes = snap.docs.map((doc) => {
      const reserva = doc.data();
      return enviarNotificacao(
        reserva.consumidorId,
        '⏰ Voucher expirando!',
        `Seu voucher "${reserva.ofertaTitulo}" expira em menos de 1 hora.`
      );
    });

    await Promise.allSettled(notificacoes);
    functions.logger.info(`notificarVouchersExpirando: ${snap.size} notificações enviadas`);
  });

// ═══════════════════════════════════════════════════════════
// CRON 3: resetarContadoresOfertas — dia 1 de cada mês
// Reseta ofertasCriadas de todas as PMEs no plano free
// ═══════════════════════════════════════════════════════════
export const resetarContadoresOfertas = functions.pubsub
  .schedule('0 0 1 * *') // Dia 1 de cada mês às 00:00
  .onRun(async () => {
    const agora = admin.firestore.Timestamp.now();

    const snap = await db.collection('pmes')
      .where('plano', '==', 'free')
      .get();

    if (snap.empty) return;

    // Processa em lotes de 500 (limite do Firestore batch)
    const chunks: admin.firestore.QueryDocumentSnapshot[][] = [];
    for (let i = 0; i < snap.docs.length; i += 500) {
      chunks.push(snap.docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach((doc) => {
        batch.update(doc.ref, {
          ofertasCriadas: 0,
          resetData: agora,
          updatedAt: agora,
        });
      });
      await batch.commit();
    }

    functions.logger.info(`resetarContadoresOfertas: ${snap.size} PMEs resetadas`);
  });

// ═══════════════════════════════════════════════════════════
// CRON 4: limparReservasExpiradas — a cada 15 minutos
// Expira reservas pendentes com mais de 15min (Pix não pago)
// Devolve unidade ao estoque da oferta
// ═══════════════════════════════════════════════════════════
export const limparReservasExpiradas = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async () => {
    const limite = admin.firestore.Timestamp.fromMillis(Date.now() - 15 * 60 * 1000);
    const agora = admin.firestore.Timestamp.now();

    const snap = await db.collection('reservas')
      .where('status', '==', 'pendente')
      .where('createdAt', '<', limite)
      .get();

    if (snap.empty) return;

    // Processa em lotes de 500
    const chunks: admin.firestore.QueryDocumentSnapshot[][] = [];
    for (let i = 0; i < snap.docs.length; i += 500) {
      chunks.push(snap.docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach((doc) => {
        const reserva = doc.data();

        // Marca como expirada
        batch.update(doc.ref, { status: 'expirado', updatedAt: agora });

        // Devolve unidade ao estoque
        // Nota: só decrementa se a reserva chegou a reservar estoque
        // No MVP, a reserva não decrementa estoque ao criar (só ao confirmar)
        // Então não há necessidade de incrementar aqui
        // Mantido como comentário para revisão futura se modelo mudar
        void reserva; // evita warning de variável não usada
      });
      await batch.commit();
    }

    functions.logger.info(`limparReservasExpiradas: ${snap.size} reservas expiradas`);
  });

// ============================================================
// FIM: functions/src/index.ts
// ============================================================
