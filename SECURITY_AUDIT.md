# Relatório de Auditoria de Segurança — LiquiBairro
**Data:** 2026-02-28
**Auditor:** Claude (Arquiteto de Segurança Senior)
**Branch:** `claude/liquibairro-security-review-qVPPx`
**Arquivo central auditado:** `functions/src/index.ts` + `firestore.rules` + `storage.rules`

---

## Sumário Executivo

| Severidade | Qtd | Status |
|---|---|---|
| 🔴 CRÍTICO (P0) | 3 | ✅ Corrigido |
| 🟠 ALTO (P1) | 3 | ✅ Corrigido |
| 🟡 MÉDIO (P2) | 1 | ✅ Corrigido |
| 🟢 BAIXO (P3) | 3 | ⚠️ Documentado (pós-MVP) |

---

## 🔴 CRÍTICO — P0 (Corrigidos)

### [P0-1] `webhookPix` — Sem verificação de assinatura do webhook Asaas
**Arquivo:** `functions/src/index.ts` → `webhookPix`
**Impacto:** Qualquer atacante que descobrir a URL pública da Cloud Function pode enviar um `POST` com um evento `PAYMENT_CONFIRMED` falso e obter um voucher sem pagar.
**Vetor de ataque:**
1. Usuário cria uma reserva via `gerarPix` e vê seu `pixTransacaoId` no Firestore
2. Envia `POST` para a URL do `webhookPix` com payload `{ event: "PAYMENT_CONFIRMED", payment: { id: "<pixTransacaoId>" } }`
3. Obtém voucher grátis — pagamento nunca ocorreu

**Fix aplicado:** Verifica o header `asaas-access-token` contra `process.env.ASAAS_API_KEY` antes de processar qualquer evento. Retorna HTTP 401 em caso de falha.

```typescript
const tokenRecebido = req.headers['asaas-access-token'];
if (!pixKey || tokenRecebido !== pixKey) {
  res.status(401).send('Unauthorized');
  return;
}
```

---

### [P0-2] `gerarPix` — Race condition permite overselling
**Arquivo:** `functions/src/index.ts` → `gerarPix`
**Impacto:** Múltiplas chamadas concorrentes de `gerarPix` para a mesma oferta passam simultaneamente pela verificação `quantidadeDisponivel > 0` antes de qualquer decremento, resultando em mais reservas do que o estoque permite.

**Vetor de ataque:**
1. Oferta tem `quantidadeDisponivel = 1`
2. Usuários A e B chamam `gerarPix` simultaneamente
3. Ambos veem `quantidadeDisponivel = 1` → ambos criam reservas
4. Ambos pagam → `webhookPix` decrementa duas vezes → `quantidadeDisponivel = -1`

**Fix aplicado:** Toda a lógica de verificação + decremento de estoque + criação de reserva foi envolta em `db.runTransaction()`. A transação é atômica e serializada — garante que nenhuma outra chamada lê o documento da oferta entre a verificação e o decremento.

Consequências do fix:
- Estoque é decrementado em `gerarPix` (não mais em `webhookPix`)
- `webhookPix` apenas confirma o pagamento (sem tocar no estoque)
- `limparReservasExpiradas` restaura o estoque quando reservas `pendente` expiram (via flag `estoqueReservado: true`)
- `cancelarReserva` continua restaurando o estoque (já fazia antes)

---

### [P0-3] `promoverParaPME` — Mass Assignment via `...dados`
**Arquivo:** `functions/src/index.ts` → `promoverParaPME`
**Impacto:** O spread `...dados` (dados fornecidos pelo cliente) no objeto do Firestore permite que um atacante injete campos arbitrários no documento da PME.

**Campos injetáveis no código original:**
- `id` — sobrescreve o UID real
- Qualquer campo não listado explicitamente após o spread (futuros campos de negócio)
- `asaasCustomerId`, `stripeSubscriptionId` ou qualquer campo que a lógica de negócio futura possa consultar

**Nota:** Campos como `plano`, `limiteOfertas`, `verificada` eram listados APÓS o spread e portanto sobrescritos corretamente. O risco é nos campos listados ANTES do spread (`id`) e em campos arbitrários não cobertos.

**Fix aplicado:** Whitelist explícita de campos permitidos. Apenas `nomeFantasia`, `cnpj`, `categoria`, `telefone`, `endereco`, `imagemUrl`, `geo`, `geohash` são aceitos do cliente. Todos os campos de controle de negócio são definidos server-side.

```typescript
// ANTES (vulnerável):
await db.collection('pmes').doc(uid).set({ id: uid, ...dados, plano: 'free', ... });

// DEPOIS (seguro):
const camposPermitidos = { nomeFantasia: ..., cnpj: ..., ... }; // whitelist explícita
await db.collection('pmes').doc(uid).set({ id: uid, ...camposPermitidos, plano: 'free', ... });
```

---

## 🟠 ALTO — P1 (Corrigidos)

### [P1-4] `confirmarPagamentoManual` — Voucher grátis em produção
**Arquivo:** `functions/src/index.ts` → `confirmarPagamentoManual`
**Impacto:** Qualquer consumidor autenticado pode confirmar sua própria reserva `pendente` sem que o pagamento Pix tenha ocorrido, obtendo voucher grátis.

**Fix aplicado:** Sandbox gate — a função é bloqueada quando `ASAAS_API_KEY` está configurada (indicativo de ambiente de produção) e `SANDBOX_MODE` não está explicitamente em `'true'`.

```typescript
const emProducao = !!process.env.ASAAS_API_KEY && process.env.SANDBOX_MODE !== 'true';
if (emProducao) throw new HttpsError('not-found', 'Função não disponível');
```

**TODO pós-MVP:** Remover completamente esta função antes do go-live em produção.

---

### [P1-5] `chatIA` — Chave Gemini via `params.defineString` incorreto
**Arquivo:** `functions/src/index.ts` → `chatIA`
**Impacto:** `params.defineString()` deve ser chamado no nível do módulo (inicialização), não dentro de funções. Chamado dentro da função assíncrona pode não retornar o valor correto, causando falha silenciosa da IA — ou pior, expor a ausência de validação.

**Código original problemático:**
```typescript
const geminiKey = process.env.GEMINI_API_KEY ??
  (await import('firebase-functions')).params.defineString('GEMINI_API_KEY').value();
```

**Fix aplicado:** Remove o fallback incorreto. Usa apenas `process.env.GEMINI_API_KEY` (injetado via `--set-secrets` no deploy). Adiciona erro explícito se a chave não estiver configurada.

**Bonus fix:** Valida `mensagens.length <= 50` e trunca cada mensagem em 2000 chars para evitar abuso de quota Gemini.

---

### [P1-6] `validarCNPJ` — Sem autenticação + fallback valida CNPJ inválido
**Arquivo:** `functions/src/index.ts` → `validarCNPJ`
**Impactos:**
1. **Sem auth:** Qualquer cliente pode chamar a função sem estar autenticado, usando o backend LiquiBairro como proxy gratuito para a BrasilAPI (scraping de CNPJs)
2. **Fallback perigoso:** Quando a BrasilAPI cai, o código original retornava `{ valido: true }`, permitindo que qualquer CNPJ (incluindo inválidos ou de empresas fechadas) passasse na validação

**Fix aplicado:**
```typescript
// Auth obrigatória
if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Não autenticado');

// Fallback seguro: rejeita em vez de aprovar
return { valido: false, mensagem: 'Serviço de validação temporariamente indisponível...' };
```

---

## 🟡 MÉDIO — P2 (Corrigido)

### [P2-7] `gerarCodigoVoucher` — `Math.random()` não é CSPRNG
**Arquivo:** `functions/src/index.ts` → `gerarCodigoVoucher()`
**Impacto:** `Math.random()` usa um PRNG (Pseudo Random Number Generator) determinístico. Em Node.js, o V8 usa xorshift128+, que pode ser previsto se o atacante conseguir amostras suficientes de saída. Vouchers poderiam ser adivinhados.

**Fix aplicado:** Substituído por `crypto.randomBytes(8)` do módulo nativo `crypto` do Node.js, que usa entropia do sistema operacional (CSPRNG — Cryptographically Secure PRNG).

```typescript
import { randomBytes } from 'crypto';

function gerarCodigoVoucher(): string {
  const bytes = randomBytes(8);
  let code = 'FD-';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
```

**Nota:** Com 32 chars e 8 posições (32^8 ≈ 1 trilhão de combinações), brute force ainda é inviável. O fix elimina a possibilidade de predição por análise estatística da PRNG.

---

## 🟢 BAIXO — P3 (Pós-MVP)

### [P3-A] `AuthContext.tsx` — Uso de `any` (violação Regra 4)
**Arquivo:** `src/contexts/AuthContext.tsx`
**Linhas afetadas:** `endereco?: Record<string, any>` e `const geo = raw.geo as any`
**Recomendação:** Criar interface `GeoPoint` tipada e interface para `Endereco`.

### [P3-B] `onUserCreate` — Cria documento `consumidores` para usuários PME
**Arquivo:** `functions/src/index.ts` → `onUserCreate`
**Impacto:** Toda PME terá um documento órfão em `/consumidores`. Não é risco de segurança imediato, mas pode confundir lógica futura.
**Recomendação pós-MVP:** Detectar o fluxo de criação de PME e não criar documento de consumidor nesses casos.

### [P3-C] Firebase App Check não configurado
**Impacto:** Chamadas às Cloud Functions podem ser feitas diretamente via curl/Postman sem que a requisição venha de um app legítimo.
**Recomendação:** Habilitar Firebase App Check com reCAPTCHA Enterprise para Cloud Functions onCall após estabilização do MVP.

---

## Análise das Regras de Segurança (Firestore + Storage)

### Firestore Rules — ✅ Boas práticas aplicadas
- Reservas bloqueadas de criação client-side (`allow create: if false`) — correto
- RateLimits completamente bloqueados para leitura/escrita client-side — correto
- PME só lê/edita seus próprios documentos — correto
- Consumidor só cancela reservas `confirmado` e com `diff().hasOnly(...)` — correto

### Storage Rules — ✅ Adequadas para MVP
- Imagens restritas a `.webp` e máximo 2MB — correto
- Escrita autenticada apenas para o dono do `pmeId` — correto
- Leitura pública (necessário para CDN) — correto

**Recomendação Storage:** Implementar CDN (Firebase CDN ou Cloudflare) para evitar egress direto do Storage. Principal risco de custo Firebase: egress de imagens.

---

## Checklist de Segurança para Go-Live

- [ ] Configurar `ASAAS_API_KEY` com chave de produção (não sandbox) via Secret Manager
- [ ] Configurar `GEMINI_API_KEY` via `--set-secrets` no deploy
- [ ] Remover ou desabilitar definitivamente `confirmarPagamentoManual`
- [ ] Habilitar Firebase App Check
- [ ] Configurar alertas de Cloud Function errors no GCP Console
- [ ] Testar fluxo completo do webhook com assinatura real do Asaas produção
- [ ] Revisar índices Firestore em `firestore.indexes.json` antes do launch

---

## Arquivos Modificados nesta Review

| Arquivo | Alteração |
|---|---|
| `functions/src/index.ts` | 7 fixes de segurança (P0-1, P0-2, P0-3, P1-4, P1-5, P1-6, P2-7) + ajustes de consistência |
| `SECURITY_AUDIT.md` | Novo (este arquivo) |
