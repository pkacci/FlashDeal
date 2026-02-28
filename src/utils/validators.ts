// ============================================================
// INÍCIO: src/utils/validators.ts
// Versão: 2.0.0 | Data: 2026-02-26
// Adições v2: mapeamento CNAE → categoria LiquiBairro
// ============================================================

export function validarFormatoCNPJ(cnpj: string): boolean {
  const n = cnpj.replace(/\D/g, '');
  if (n.length !== 14) return false;
  const inv = ['00000000000000','11111111111111','22222222222222','33333333333333','44444444444444','55555555555555','66666666666666','77777777777777','88888888888888','99999999999999'];
  if (inv.includes(n)) return false;
  let s = 0, p = 5;
  for (let i = 0; i < 12; i++) { s += parseInt(n[i]) * p; p = p === 2 ? 9 : p - 1; }
  const d1 = s % 11 < 2 ? 0 : 11 - (s % 11);
  if (parseInt(n[12]) !== d1) return false;
  s = 0; p = 6;
  for (let i = 0; i < 13; i++) { s += parseInt(n[i]) * p; p = p === 2 ? 9 : p - 1; }
  const d2 = s % 11 < 2 ? 0 : 11 - (s % 11);
  return parseInt(n[13]) === d2;
}

export interface DadosCNPJ {
  razaoSocial: string;
  nomeFantasia: string;
  situacao: string;
  ativa: boolean;
  cnaeCode?: string;
  categoriaDetectada?: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  telefone: string;
  email: string;
}

export interface ResultadoValidacaoCNPJ {
  valido: boolean;
  dados?: DadosCNPJ;
  erro?: string;
}

// ─── Mapeamento CNAE → Categoria LiquiBairro ───────────────────
// CNAE é o código de atividade econômica retornado pela Receita Federal
// Prefixos de 2 dígitos cobrem a maioria dos casos
const CNAE_PARA_CATEGORIA: Record<string, string> = {
  // Restaurantes / Alimentação
  '56': 'restaurante',
  '10': 'restaurante',
  '11': 'restaurante',

  // Supermercado / Mercado
  '47': 'supermercado',
  '46': 'supermercado',

  // Beleza
  '96': 'beleza',

  // Fitness / Academia
  '93': 'fitness',

  // Saúde / Farmácia
  '86': 'saude',
  '87': 'saude',
  '47.71': 'saude', // farmácias

  // Educação
  '85': 'educacao',
  '82': 'educacao',

  // Pet Shop
  '75': 'pet',
  '47.63': 'pet',

  // Bar / Balada
  '5611': 'bar',
  '5612': 'bar',

  // Hotel / Hospedagem
  '55': 'hotel',

  // Varejo geral
  '45': 'varejo',
  '48': 'varejo',
  '49': 'varejo',

  // Serviços gerais
  '69': 'servicos',
  '70': 'servicos',
  '71': 'servicos',
  '72': 'servicos',
  '73': 'servicos',
  '74': 'servicos',
  '77': 'servicos',
  '78': 'servicos',
  '80': 'servicos',
  '81': 'servicos',
};

export function detectarCategoriaPorCNAE(cnaeCode: string): string | null {
  if (!cnaeCode) return null;
  const limpo = cnaeCode.replace(/\D/g, '');

  // Tenta match exato com 4 dígitos primeiro
  const prefixo4 = limpo.substring(0, 4);
  if (CNAE_PARA_CATEGORIA[prefixo4]) return CNAE_PARA_CATEGORIA[prefixo4];

  // Depois tenta 2 dígitos
  const prefixo2 = limpo.substring(0, 2);
  if (CNAE_PARA_CATEGORIA[prefixo2]) return CNAE_PARA_CATEGORIA[prefixo2];

  return null;
}

export async function buscarCNPJ(cnpj: string): Promise<ResultadoValidacaoCNPJ> {
  const n = cnpj.replace(/\D/g, '');
  if (!validarFormatoCNPJ(n)) return { valido: false, erro: 'CNPJ inválido. Verifique os números.' };
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${n}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404) return { valido: false, erro: 'CNPJ não encontrado na Receita Federal.' };
    if (!res.ok) { console.warn('BrasilAPI indisponivel, fallback matematico'); return { valido: true }; }
    const d = await res.json();

    // CNAE principal retornado pela BrasilAPI
    const cnaeCode = d.cnae_fiscal?.toString() ?? d.cnae_fiscal_descricao ?? '';
    const categoriaDetectada = detectarCategoriaPorCNAE(cnaeCode) ?? undefined;

    const dados: DadosCNPJ = {
      razaoSocial: d.razao_social ?? '',
      nomeFantasia: d.nome_fantasia ?? d.razao_social ?? '',
      situacao: d.descricao_situacao_cadastral ?? '',
      ativa: d.descricao_situacao_cadastral === 'ATIVA',
      cnaeCode,
      categoriaDetectada,
      endereco: {
        logradouro: d.logradouro ?? '',
        numero: d.numero ?? '',
        complemento: d.complemento ?? '',
        bairro: d.bairro ?? '',
        municipio: d.municipio ?? '',
        uf: d.uf ?? '',
        cep: (d.cep ?? '').replace(/\D/g, ''),
      },
      telefone: d.ddd_telefone_1 ? `(${d.ddd_telefone_1.substring(0,2)}) ${d.ddd_telefone_1.substring(2)}` : '',
      email: d.email ?? '',
    };

    if (!dados.ativa) return { valido: false, erro: `CNPJ com situação "${dados.situacao}". Apenas empresas ATIVAS podem se cadastrar.`, dados };
    return { valido: true, dados };
  } catch (e: any) {
    if (e?.name === 'TimeoutError') { console.warn('BrasilAPI timeout, fallback matematico'); return { valido: true }; }
    console.error('Erro BrasilAPI:', e);
    return { valido: true };
  }
}

export function formatarCNPJ(cnpj: string): string {
  const n = cnpj.replace(/\D/g, '').substring(0, 14);
  return n.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2');
}

// ============================================================
// FIM: src/utils/validators.ts
// ============================================================
