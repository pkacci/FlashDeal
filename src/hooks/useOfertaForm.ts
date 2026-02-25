// ============================================================
// INÍCIO: src/hooks/useOfertaForm.ts
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, firebase/functions, useImageUpload
// Descrição: Hook de lógica do formulário de criação de oferta
//            — Validação inline de todos os campos
//            — Cálculo automático do preço final
//            — Integração com Smart Templates (seleção de template)
//            — Submit para Cloud Function ou Firestore direto
//            — Usado por CriarOfertaPage e OfertaPreview
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { collection, addDoc, serverTimestamp, GeoPoint } from 'firebase/firestore';
import { db } from '../services/firebase';
import { OfertaPreviewData } from '../components/pme/OfertaPreview';

// #region Types
export interface OfertaFormValues {
  titulo: string;
  valorOriginal: number | '';
  desconto: number | '';     // 5-80 (validação protetora da PME)
  quantidadeTotal: number | '';
  dataFim: Date | null;
  imagemUrl?: string;        // Preenchido após upload
}

export interface OfertaFormErrors {
  titulo?: string;
  valorOriginal?: string;
  desconto?: string;
  quantidadeTotal?: string;
  dataFim?: string;
}

interface UseOfertaFormProps {
  pmeId: string;
  pmeNome: string;
  pmeCategoria: string;
  pmeLat: number;
  pmeLng: number;
  pmeGeohash: string;
  pmeEndereco: Record<string, string>;
  limiteOfertas: number;    // 10 no plano free
  ofertasCriadas: number;   // Contador do mês atual
}

interface UseOfertaFormReturn {
  values: OfertaFormValues;
  errors: OfertaFormErrors;
  previewData: OfertaPreviewData;
  isValid: boolean;
  isSubmitting: boolean;
  erroSubmit: string | null;
  limiteAtingido: boolean;
  setField: <K extends keyof OfertaFormValues>(key: K, value: OfertaFormValues[K]) => void;
  aplicarTemplate: (template: Partial<OfertaFormValues>) => void;
  submit: () => Promise<boolean>; // true = sucesso
  reset: () => void;
}
// #endregion

// #region Valores iniciais
const INITIAL_VALUES: OfertaFormValues = {
  titulo: '',
  valorOriginal: '',
  desconto: '',
  quantidadeTotal: '',
  dataFim: null,
  imagemUrl: undefined,
};
// #endregion

// #region Validação
const validar = (values: OfertaFormValues): OfertaFormErrors => {
  const errors: OfertaFormErrors = {};

  if (!values.titulo.trim()) {
    errors.titulo = 'Título obrigatório.';
  } else if (values.titulo.trim().length < 10) {
    errors.titulo = 'Título deve ter pelo menos 10 caracteres.';
  } else if (values.titulo.trim().length > 80) {
    errors.titulo = 'Título deve ter no máximo 80 caracteres.';
  }

  if (values.valorOriginal === '' || values.valorOriginal <= 0) {
    errors.valorOriginal = 'Informe o preço original.';
  }

  if (values.desconto === '') {
    errors.desconto = 'Informe o desconto.';
  } else if (values.desconto < 5) {
    errors.desconto = 'Desconto mínimo: 5%.';
  } else if (values.desconto > 80) {
    // Protege PME de colocar desconto inviável por acidente
    errors.desconto = 'Desconto máximo: 80%. Verifique se está correto.';
  }

  if (values.quantidadeTotal === '' || values.quantidadeTotal <= 0) {
    errors.quantidadeTotal = 'Informe a quantidade disponível.';
  } else if (values.quantidadeTotal > 999) {
    errors.quantidadeTotal = 'Quantidade máxima: 999.';
  }

  if (!values.dataFim) {
    errors.dataFim = 'Defina a validade da oferta.';
  } else {
    const diffMs = values.dataFim.getTime() - Date.now();
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < 1) {
      errors.dataFim = 'Validade mínima: 1 hora.';
    } else if (diffH > 72) {
      errors.dataFim = 'Validade máxima: 72 horas.';
    }
  }

  return errors;
};
// #endregion

// #region Hook
const useOfertaForm = ({
  pmeId,
  pmeNome,
  pmeCategoria,
  pmeLat,
  pmeLng,
  pmeGeohash,
  pmeEndereco,
  limiteOfertas,
  ofertasCriadas,
}: UseOfertaFormProps): UseOfertaFormReturn => {

  const [values, setValues] = useState<OfertaFormValues>(INITIAL_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroSubmit, setErroSubmit] = useState<string | null>(null);

  // Valida reativamente a cada mudança de campo
  const errors = useMemo(() => validar(values), [values]);
  const isValid = Object.keys(errors).length === 0;
  const limiteAtingido = ofertasCriadas >= limiteOfertas;

  // Dados formatados para o OfertaPreview (tempo real)
  const previewData: OfertaPreviewData = useMemo(() => ({
    titulo: values.titulo,
    valorOriginal: typeof values.valorOriginal === 'number' ? values.valorOriginal : 0,
    desconto: typeof values.desconto === 'number' ? values.desconto : 0,
    quantidadeTotal: typeof values.quantidadeTotal === 'number' ? values.quantidadeTotal : 0,
    quantidadeDisponivel: typeof values.quantidadeTotal === 'number' ? values.quantidadeTotal : 0,
    dataFim: values.dataFim,
    pmeNome,
    imagemUrl: values.imagemUrl,
  }), [values, pmeNome]);

  // Atualiza um campo individualmente
  const setField = useCallback(
    <K extends keyof OfertaFormValues>(key: K, value: OfertaFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Aplica um Smart Template — preenche múltiplos campos de uma vez
  const aplicarTemplate = useCallback((template: Partial<OfertaFormValues>) => {
    setValues((prev) => ({ ...prev, ...template }));
  }, []);

  // Submit: grava oferta no Firestore
  const submit = useCallback(async (): Promise<boolean> => {
    if (!isValid || limiteAtingido) return false;

    setIsSubmitting(true);
    setErroSubmit(null);

    try {
      const valorOriginal = values.valorOriginal as number;
      const desconto = values.desconto as number;
      const quantidadeTotal = values.quantidadeTotal as number;

      const valorOferta = parseFloat(
        (valorOriginal * (1 - desconto / 100)).toFixed(2)
      );

      // Grava diretamente no Firestore
      // OBS: Cloud Function não é necessária para criação de oferta
      // (operação não financeira, PME autenticada via custom claim)
      await addDoc(collection(db, 'ofertas'), {
        pmeId,
        pmeNome,
        pmeCategoria,
        titulo: values.titulo.trim(),
        valorOriginal,
        valorOferta,
        desconto,
        quantidadeTotal,
        quantidadeDisponivel: quantidadeTotal,
        dataInicio: serverTimestamp(),
        dataFim: values.dataFim,
        ativa: true,
        geo: new GeoPoint(pmeLat, pmeLng),
        geohash: pmeGeohash,
        endereco: pmeEndereco,
        imagemUrl: values.imagemUrl ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return true;
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : 'Erro ao publicar oferta.';
      setErroSubmit(mensagem);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValid,
    limiteAtingido,
    values,
    pmeId,
    pmeNome,
    pmeCategoria,
    pmeLat,
    pmeLng,
    pmeGeohash,
    pmeEndereco,
  ]);

  const reset = useCallback(() => {
    setValues(INITIAL_VALUES);
    setErroSubmit(null);
  }, []);

  return {
    values,
    errors,
    previewData,
    isValid,
    isSubmitting,
    erroSubmit,
    limiteAtingido,
    setField,
    aplicarTemplate,
    submit,
    reset,
  };
};
// #endregion

export default useOfertaForm;

// ============================================================
// FIM: src/hooks/useOfertaForm.ts
// ============================================================
