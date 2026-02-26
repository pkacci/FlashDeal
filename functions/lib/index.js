"use strict";
// ============================================================
// INÍCIO: functions/src/index.ts
// Versão: 2.0.0 | Correção: API firebase-functions v2 correta
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onOfertaCreated = exports.resetarContadoresOfertas = exports.notificarVouchersExpirando = exports.limparReservasExpiradas = exports.expirarOfertas = exports.confirmarEntrega = exports.validarVoucher = exports.cancelarReserva = exports.confirmarPagamentoManual = exports.webhookPix = exports.gerarPix = exports.validarCNPJ = exports.chatIA = exports.promoverParaPME = exports.onUserCreate = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const v1_1 = require("firebase-functions/v1"); // auth.user().onCreate ainda é v1
admin.initializeApp();
const db = admin.firestore();
// ============================================================
// HELPERS
// ============================================================
function gerarCodigoVoucher() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'FD-';
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
async function enviarNotificacao(uid, titulo, corpo) {
    try {
        const snap = await db.collection('consumidores').doc(uid).get();
        const token = snap.data()?.fcmToken;
        if (!token)
            return;
        await admin.messaging().send({
            token,
            notification: { title: titulo, body: corpo },
        });
    }
    catch {
        // Notificação é best-effort — não bloqueia o fluxo principal
    }
}
// ============================================================
// FUNCTION 1: onUserCreate (v1 — auth trigger só existe no v1)
// ============================================================
exports.onUserCreate = v1_1.auth.user().onCreate(async (user) => {
    const { uid, email, phoneNumber, displayName, photoURL } = user;
    // Tenta detectar role pelo metadata customizado
    // Por padrão, cria como consumidor; PME é criada via fluxo de onboarding
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
    // Define custom claim padrão como consumidor
    await admin.auth().setCustomUserClaims(uid, { role: 'consumidor' });
});
// ============================================================
// FUNCTION 2: promoverParaPME — chamada durante onboarding
// ============================================================
exports.promoverParaPME = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    await admin.auth().setCustomUserClaims(uid, { role: 'pme' });
    const agora = admin.firestore.Timestamp.now();
    const dados = request.data;
    await db.collection('pmes').doc(uid).set({
        id: uid,
        ...dados,
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
// ============================================================
exports.chatIA = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    // Rate limit: 20 chamadas/uid/hora
    const agora = admin.firestore.Timestamp.now();
    const rateLimitRef = db.collection('rateLimits').doc(uid);
    const rateLimitSnap = await rateLimitRef.get();
    if (rateLimitSnap.exists) {
        const data = rateLimitSnap.data();
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
    }
    else {
        await rateLimitRef.set({ chatIA: { count: 1, windowStart: agora } });
    }
    const { mensagens, dadosAtuais } = request.data;
    try {
        const geminiKey = process.env.GEMINI_API_KEY ??
            (await Promise.resolve().then(() => __importStar(require('firebase-functions')))).params.defineString('GEMINI_API_KEY').value();
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                            text: `Você é um assistente amigável que ajuda PMEs brasileiras a se cadastrarem no FlashDeal.
Extraia os dados: nomeFantasia, cnpj, categoria (restaurante/salao/academia/servico/varejo), telefone.
Responda em JSON: { "resposta": "mensagem amigável", "dadosExtraidos": {...}, "concluido": false }
Quando tiver todos os dados obrigatórios (nomeFantasia + cnpj + categoria), defina concluido: true.
Dados já coletados: ${JSON.stringify(dadosAtuais)}`
                        }]
                },
                contents: mensagens.map((m) => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }],
                })),
            }),
        });
        const json = await response.json();
        const texto = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const match = texto.match(/\{[\s\S]*\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            return parsed;
        }
        return { fallback: true };
    }
    catch {
        return { fallback: true };
    }
});
// ============================================================
// FUNCTION 4: validarCNPJ — via BrasilAPI
// ============================================================
exports.validarCNPJ = (0, https_1.onCall)(async (request) => {
    const { cnpj } = request.data;
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
        throw new https_1.HttpsError('invalid-argument', 'CNPJ inválido');
    }
    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
        if (!response.ok) {
            return { valido: false, mensagem: 'CNPJ não encontrado' };
        }
        const dados = await response.json();
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
    }
    catch {
        // Se BrasilAPI estiver fora, permite continuar sem validação
        return { valido: true, dados: null };
    }
});
// ============================================================
// FUNCTION 5: gerarPix — cria reserva e QR Code Pix
// ============================================================
exports.gerarPix = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    const { ofertaId } = request.data;
    const agora = admin.firestore.Timestamp.now();
    // Valida oferta
    const ofertaSnap = await db.collection('ofertas').doc(ofertaId).get();
    if (!ofertaSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Oferta não encontrada');
    }
    const oferta = ofertaSnap.data();
    if (!oferta.ativa)
        throw new https_1.HttpsError('failed-precondition', 'Oferta inativa');
    if (oferta.dataFim.toDate() < new Date()) {
        throw new https_1.HttpsError('failed-precondition', 'Oferta expirada');
    }
    if (oferta.quantidadeDisponivel <= 0) {
        throw new https_1.HttpsError('failed-precondition', 'Oferta esgotada');
    }
    // Verifica consumidor
    const consumidorSnap = await db.collection('consumidores').doc(uid).get();
    if (!consumidorSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Consumidor não encontrado');
    }
    const consumidor = consumidorSnap.data();
    const idempotencyKey = `IDMP-${uid}-${ofertaId}-${Date.now()}`;
    // Cria reserva
    const reservaRef = db.collection('reservas').doc();
    await reservaRef.set({
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
        pixIdempotencyKey: idempotencyKey,
        processado: false,
        status: 'pendente',
        createdAt: agora,
    });
    // Tenta chamar gateway Pix (Asaas sandbox)
    // Se não configurado, retorna QR Code simulado para testes
    const pixKey = process.env.PIX_GATEWAY_KEY;
    if (!pixKey) {
        // Modo sandbox/simulação para testes beta
        const pixCopiaCola = `00020126580014BR.GOV.BCB.PIX0136${reservaRef.id}5204000053039865802BR5925FLASHDEAL PAGAMENTOS LTDA6009SAO PAULO62070503***6304`;
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
                value: oferta.valorOferta,
                dueDate: new Date(Date.now() + 10 * 60 * 1000).toISOString().split('T')[0],
                description: oferta.titulo,
                externalReference: reservaRef.id,
            }),
        });
        const pagamento = await response.json();
        await reservaRef.update({
            pixTransacaoId: pagamento.id,
        });
        return {
            reservaId: reservaRef.id,
            pixQrCode: pagamento.encodedImage ?? null,
            pixCopiaCola: pagamento.payload ?? '',
            expiraEm: 600,
        };
    }
    catch {
        await reservaRef.delete();
        throw new https_1.HttpsError('internal', 'Erro ao gerar Pix. Tente novamente.');
    }
});
// ============================================================
// FUNCTION 6: webhookPix — confirma pagamento
// ============================================================
exports.webhookPix = (0, https_1.onRequest)(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const evento = req.body;
    // Aceita eventos de pagamento confirmado
    if (!['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(evento.event)) {
        res.status(200).send('Evento ignorado');
        return;
    }
    const pagamentoId = evento.payment?.id;
    if (!pagamentoId) {
        res.status(400).send('ID de pagamento ausente');
        return;
    }
    // Busca reserva pelo pixTransacaoId
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
    // Batch write atômico
    const batch = db.batch();
    batch.update(reservaDoc.ref, {
        status: 'confirmado',
        processado: true,
        voucherCodigo,
        dataConfirmacao: agora,
    });
    batch.update(db.collection('ofertas').doc(reserva.ofertaId), {
        quantidadeDisponivel: admin.firestore.FieldValue.increment(-1),
    });
    await batch.commit();
    // Notifica (best-effort)
    await enviarNotificacao(reserva.consumidorId, '✅ Pagamento confirmado!', `Seu voucher ${voucherCodigo} está pronto.`);
    res.status(200).send('OK');
});
// ============================================================
// FUNCTION 7: confirmarPagamentoManual — para testes beta (sandbox)
// ============================================================
exports.confirmarPagamentoManual = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    const { reservaId } = request.data;
    const reservaSnap = await db.collection('reservas').doc(reservaId).get();
    if (!reservaSnap.exists)
        throw new https_1.HttpsError('not-found', 'Reserva não encontrada');
    const reserva = reservaSnap.data();
    if (reserva.consumidorId !== uid)
        throw new https_1.HttpsError('permission-denied', 'Sem permissão');
    if (reserva.processado)
        return { voucherCodigo: reserva.voucherCodigo };
    const voucherCodigo = gerarCodigoVoucher();
    const agora = admin.firestore.Timestamp.now();
    const batch = db.batch();
    batch.update(reservaSnap.ref, {
        status: 'confirmado',
        processado: true,
        voucherCodigo,
        dataConfirmacao: agora,
    });
    batch.update(db.collection('ofertas').doc(reserva.ofertaId), {
        quantidadeDisponivel: admin.firestore.FieldValue.increment(-1),
    });
    await batch.commit();
    return { voucherCodigo };
});
// ============================================================
// FUNCTION 8: cancelarReserva
// ============================================================
exports.cancelarReserva = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    const { reservaId, motivoCancelamento } = request.data;
    const reservaSnap = await db.collection('reservas').doc(reservaId).get();
    if (!reservaSnap.exists)
        throw new https_1.HttpsError('not-found', 'Reserva não encontrada');
    const reserva = reservaSnap.data();
    if (reserva.consumidorId !== uid)
        throw new https_1.HttpsError('permission-denied', 'Sem permissão');
    if (reserva.status !== 'confirmado') {
        throw new https_1.HttpsError('failed-precondition', 'Reserva não pode ser cancelada');
    }
    const agora = admin.firestore.Timestamp.now();
    const ofertaSnap = await db.collection('ofertas').doc(reserva.ofertaId).get();
    const oferta = ofertaSnap.data();
    const trintaMinutesAntes = new Date((oferta?.dataFim?.toDate()?.getTime() ?? 0) - 30 * 60 * 1000);
    if (new Date() > trintaMinutesAntes) {
        throw new https_1.HttpsError('failed-precondition', 'Prazo de cancelamento encerrado');
    }
    const batch = db.batch();
    batch.update(reservaSnap.ref, {
        status: 'cancelado',
        dataCancelamento: agora,
        motivoCancelamento: motivoCancelamento ?? 'Cancelado pelo usuário',
    });
    batch.update(db.collection('ofertas').doc(reserva.ofertaId), {
        quantidadeDisponivel: admin.firestore.FieldValue.increment(1),
    });
    await batch.commit();
    // Notifica PME
    await enviarNotificacao(reserva.pmeId, '⚠️ Reserva cancelada', `Reembolsar R$ ${reserva.valorPago.toFixed(2)} para ${reserva.consumidorNome} via Pix`);
    return { sucesso: true };
});
// ============================================================
// FUNCTION 9: validarVoucher — PME valida voucher do cliente
// ============================================================
exports.validarVoucher = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    const { codigo } = request.data;
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
exports.confirmarEntrega = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    const { reservaId } = request.data;
    const reservaSnap = await db.collection('reservas').doc(reservaId).get();
    if (!reservaSnap.exists)
        throw new https_1.HttpsError('not-found', 'Reserva não encontrada');
    const reserva = reservaSnap.data();
    if (reserva.pmeId !== uid)
        throw new https_1.HttpsError('permission-denied', 'Sem permissão');
    await reservaSnap.ref.update({
        status: 'usado',
        dataUso: admin.firestore.Timestamp.now(),
    });
    await enviarNotificacao(reserva.consumidorId, '⭐ Como foi?', `Avalie sua experiência em ${reserva.pmeNome}`);
    return { sucesso: true };
});
// ============================================================
// CRON 1: expirarOfertas — a cada 1 hora
// ============================================================
exports.expirarOfertas = (0, scheduler_1.onSchedule)('every 60 minutes', async () => {
    const agora = admin.firestore.Timestamp.now();
    const snap = await db.collection('ofertas')
        .where('ativa', '==', true)
        .where('dataFim', '<', agora)
        .get();
    if (snap.empty)
        return;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.update(doc.ref, { ativa: false }));
    await batch.commit();
});
// ============================================================
// CRON 2: limparReservasExpiradas — a cada 15 minutos
// ============================================================
exports.limparReservasExpiradas = (0, scheduler_1.onSchedule)('every 15 minutes', async () => {
    const quinzeMinutosAtras = new Date(Date.now() - 15 * 60 * 1000);
    const limite = admin.firestore.Timestamp.fromDate(quinzeMinutosAtras);
    const snap = await db.collection('reservas')
        .where('status', '==', 'pendente')
        .where('createdAt', '<', limite)
        .get();
    if (snap.empty)
        return;
    const batch = db.batch();
    snap.docs.forEach((doc) => {
        batch.update(doc.ref, { status: 'expirado' });
    });
    await batch.commit();
});
// ============================================================
// CRON 3: notificarVouchersExpirando — a cada 30 minutos
// ============================================================
exports.notificarVouchersExpirando = (0, scheduler_1.onSchedule)('every 30 minutes', async () => {
    const agora = new Date();
    const umaHora = new Date(agora.getTime() + 60 * 60 * 1000);
    const snap = await db.collection('reservas')
        .where('status', '==', 'confirmado')
        .get();
    for (const doc of snap.docs) {
        const reserva = doc.data();
        const dataFim = reserva.ofertaDataFim?.toDate();
        if (dataFim && dataFim > agora && dataFim < umaHora) {
            await enviarNotificacao(reserva.consumidorId, '⏰ Voucher expirando!', `Seu voucher de ${reserva.ofertaTitulo} expira em menos de 1 hora.`);
        }
    }
});
// ============================================================
// CRON 4: resetarContadoresOfertas — dia 1 de cada mês
// ============================================================
exports.resetarContadoresOfertas = (0, scheduler_1.onSchedule)('0 0 1 * *', async () => {
    const snap = await db.collection('pmes')
        .where('plano', '==', 'free')
        .get();
    if (snap.empty)
        return;
    const agora = admin.firestore.Timestamp.now();
    const chunks = [];
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
exports.onOfertaCreated = (0, firestore_1.onDocumentCreated)('ofertas/{ofertaId}', async (event) => {
    const oferta = event.data?.data();
    if (!oferta?.pmeId)
        return;
    await db.collection('pmes').doc(oferta.pmeId).update({
        ofertasCriadas: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.Timestamp.now(),
    });
});
// ============================================================
// FIM: functions/src/index.ts
// ============================================================
//# sourceMappingURL=index.js.map