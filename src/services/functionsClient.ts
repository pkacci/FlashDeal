import { getFunctions, httpsCallable } from 'firebase/functions';

export interface GerarPixResponse {
  reservaId: string;
  pixQrCode: string | null; 
  pixCopiaCola: string;
  expiraEm: number;
  sandbox?: boolean;
}

export const gerarPixTeste = async (valor: number, descricao: string) => {
  const functions = getFunctions();
  const gerarPix = httpsCallable<{ valor: number; descricao: string }, GerarPixResponse>(
    functions, 
    'gerarPix'
  );

  console.log('🧪 LIQUI-BAIRRO: Chamando gerarPix...');
  
  try {
    const result = await gerarPix({ valor, descricao });
    return result.data;
  } catch (error: any) {
    console.error('❌ Erro na extração de Liquidez:', error.code, error.message);
    throw error;
  }
};
