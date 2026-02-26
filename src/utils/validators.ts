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
  endereco: { logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string; cep: string; };
  telefone: string;
  email: string;
}

export interface ResultadoValidacaoCNPJ {
  valido: boolean;
  dados?: DadosCNPJ;
  erro?: string;
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
    const dados: DadosCNPJ = {
      razaoSocial: d.razao_social ?? '',
      nomeFantasia: d.nome_fantasia ?? d.razao_social ?? '',
      situacao: d.descricao_situacao_cadastral ?? '',
      ativa: d.descricao_situacao_cadastral === 'ATIVA',
      endereco: { logradouro: d.logradouro ?? '', numero: d.numero ?? '', complemento: d.complemento ?? '', bairro: d.bairro ?? '', municipio: d.municipio ?? '', uf: d.uf ?? '', cep: (d.cep ?? '').replace(/\D/g, '') },
      telefone: d.ddd_telefone_1 ? `(${d.ddd_telefone_1.substring(0,2)}) ${d.ddd_telefone_1.substring(2)}` : '',
      email: d.email ?? '',
    };
    if (!dados.ativa) return { valido: false, erro: `CNPJ com situacao "${dados.situacao}". Apenas empresas ATIVAS podem se cadastrar.`, dados };
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
