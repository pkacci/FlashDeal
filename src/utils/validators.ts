export function validarFormatoCNPJ(cnpj: string): boolean {
  const numeros = cnpj.replace(/\D/g, '');
  if (numeros.length !== 14) return false;
  const inv = ['00000000000000','11111111111111','22222222222222','33333333333333','44444444444444','55555555555555','66666666666666','77777777777777','88888888888888','99999999999999'];
  if (inv.includes(numeros)) return false;
  let soma = 0, peso = 5;
  for (let i = 0; i < 12; i++) { soma += parseInt(numeros[i]) * peso; peso = peso === 2 ? 9 : peso - 1; }
  const d1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (parseInt(numeros[12]) !== d1) return false;
  soma = 0; peso = 6;
  for (let i = 0; i < 13; i++) { soma += parseInt(numeros[i]) * peso; peso = peso === 2 ? 9 : peso - 1; }
  const d2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return parseInt(numeros[13]) === d2;
}

export interface DadosCNPJ {
  razaoSocial: string; nomeFantasia: string; situacao: string; ativa: boolean;
  endereco: { logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string; cep: string; };
  telefone: string; email: string;
}

export interface ResultadoValidacaoCNPJ { valido: boolean; dados?: DadosCNPJ; erro?: string; }

export async function buscarCNPJ(cnpj: string): Promise<ResultadoValidacaoCNPJ> {
  const numeros = cnpj.replace(/\D/g, '');
  if (!validarFormatoCNPJ(numeros)) return { valido: false, erro: 'CNPJ inválido. Verifique os números.' };
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${numeros}`, { method: 'GET', headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (response.status === 404) return { valido: false, erro: 'CNPJ não encontrado na Receita Federal.' };
    if (!response.ok) return { valido: true };
    const data = await response.json();
    const dados: DadosCNPJ = {
      razaoSocial: data.razao_social ?? '', nomeFantasia: data.nome_fantasia ?? data.razao_social ?? '',
      situacao: data.descricao_situacao_cadastral ?? '', ativa: data.descricao_situacao_cadastral === 'ATIVA',
      endereco: { logradouro: data.logradouro ?? '', numero: data.numero ?? '', complemento: data.complemento ?? '', bairro: data.bairro ?? '', municipio: data.municipio ?? '', uf: data.uf ?? '', cep: (data.cep ?? '').replace(/\D/g, '') },
      telefone: data.ddd_telefone_1 ? data.ddd_telefone_1 : '', email: data.email ?? '',
    };
    if (!dados.ativa) return { valido: false, erro: `CNPJ com situação "${dados.situacao}". Apenas empresas ATIVAS podem se cadastrar.`, dados };
    return { valido: true, dados };
  } catch {
    return { valido: true };
  }
}

export function formatarCNPJ(cnpj: string): string {
  const n = cnpj.replace(/\D/g, '').substring(0, 14);
  return n.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}
