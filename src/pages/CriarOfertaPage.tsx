// ============================================================
// INÍCIO: src/pages/CriarOfertaPage.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, hooks/useAuth,
//       hooks/useOfertaForm, hooks/useImageUpload,
//       components/pme/OfertaPreview,
//       components/common/Toast
// Descrição: Tela de criação de oferta para PME
//            — Etapa 1: seleção de Smart Template
//            — Etapa 2: formulário + preview em tempo real
//            — Validação inline em todos os campos
//            — Upload opcional de foto (.webp, comprimido)
//            — Submit via useOfertaForm → Firestore
// ============================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useOfertaForm from '../hooks/useOfertaForm';
import useImageUpload from '../hooks/useImageUpload';
import OfertaPreview from '../components/pme/OfertaPreview';
import { useToast } from '../contexts/ToastContext';

// #region Smart Templates por categoria
const TEMPLATES_POR_CATEGORIA: Record<string, Array<{
  label: string;
  badge: string;
  titulo: string;
  desconto: number;
  quantidadeTotal: number;
  horasValidade: number;
}>> = {
  restaurante: [
    { label: 'Mais popular', badge: '🔥', titulo: 'Happy Hour: Pizza Média 40% OFF', desconto: 40, quantidadeTotal: 20, horasValidade: 2 },
    { label: 'Urgência', badge: '⚡', titulo: 'Última Hora: Esfihas 50% OFF', desconto: 50, quantidadeTotal: 10, horasValidade: 1 },
  ],
  beleza: [
    { label: 'Mais popular', badge: '🔥', titulo: 'Corte + Escova 30% OFF', desconto: 30, quantidadeTotal: 5, horasValidade: 4 },
    { label: 'Promoção', badge: '✨', titulo: 'Manicure + Pedicure com 25% OFF', desconto: 25, quantidadeTotal: 8, horasValidade: 6 },
  ],
  fitness: [
    { label: 'Mais popular', badge: '🔥', titulo: 'Aula Experimental 50% OFF', desconto: 50, quantidadeTotal: 10, horasValidade: 24 },
    { label: 'Novidade', badge: '🆕', titulo: 'Mensalidade com 20% de Desconto', desconto: 20, quantidadeTotal: 5, horasValidade: 48 },
  ],
  default: [
    { label: 'Mais popular', badge: '🔥', titulo: 'Oferta Especial 30% OFF', desconto: 30, quantidadeTotal: 15, horasValidade: 4 },
    { label: 'Urgência', badge: '⚡', titulo: 'Oferta Relâmpago 40% OFF', desconto: 40, quantidadeTotal: 10, horasValidade: 2 },
  ],
};

const getTemplates = (categoria: string) =>
  TEMPLATES_POR_CATEGORIA[categoria] ?? TEMPLATES_POR_CATEGORIA.default;
// #endregion

// #region Opções de validade rápidas
const VALIDADES = [
  { label: '1h',       horas: 1 },
  { label: '2h',       horas: 2 },
  { label: '4h',       horas: 4 },
  { label: 'Até fechar', horas: 8 },
  { label: 'Amanhã',   horas: 24 },
];
// #endregion

// #region Component
const CriarOfertaPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { usuario, pmeData } = useAuth();

  const [etapa, setEtapa] = useState<'template' | 'formulario'>('template');

  const {
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
  } = useOfertaForm({
    pmeId: usuario?.uid ?? '',
    pmeNome: pmeData?.nomeFantasia ?? '',
    pmeCategoria: pmeData?.categoria ?? '',
    pmeLat: pmeData?.endereco?.geo?.latitude ?? -23.5505,
    pmeLng: pmeData?.endereco?.geo?.longitude ?? -46.6333,
    pmeGeohash: pmeData?.geohash ?? '',
    pmeEndereco: pmeData?.endereco ?? {},
    limiteOfertas: pmeData?.limiteOfertas ?? 10,
    ofertasCriadas: pmeData?.ofertasCriadas ?? 0,
  });

  const { upload, previewUrl, status: uploadStatus, progresso } = useImageUpload();

  // #region Handlers
  const handleSelecionarTemplate = (template: typeof TEMPLATES_POR_CATEGORIA.default[0]) => {
    const dataFim = new Date(Date.now() + template.horasValidade * 3600 * 1000);
    aplicarTemplate({
      titulo: template.titulo,
      desconto: template.desconto,
      quantidadeTotal: template.quantidadeTotal,
      dataFim,
    });
    setEtapa('formulario');
  };

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario?.uid) return;
    const path = `ofertas/${usuario.uid}/${Date.now()}.webp`;
    const url = await upload(file, path);
    if (url) setField('imagemUrl', url);
  };

  const handleValidade = (horas: number) => {
    setField('dataFim', new Date(Date.now() + horas * 3600 * 1000));
  };

  const handlePublicar = async () => {
    const ok = await submit();
    if (ok) {
      addToast('✅ Oferta publicada com sucesso!', 'success');
      navigate('/dashboard');
    }
  };
  // #endregion

  // Bloqueia acesso se limite atingido
  if (limiteAtingido) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-lg font-bold text-neutral-800 mb-2">Limite mensal atingido</p>
        <p className="text-sm text-neutral-500 mb-6">
          Faça upgrade para o plano PRO e crie ofertas ilimitadas.
        </p>
        <button onClick={() => navigate('/perfil')} className="btn-primary">
          ⬆️ Ver plano PRO
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">

      {/* Header */}
      <header className="bg-white px-4 py-4 border-b border-neutral-100 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => etapa === 'formulario' ? setEtapa('template') : navigate('/dashboard')}
          className="text-neutral-500 text-sm">←</button>
        <p className="font-semibold text-neutral-800">
          {etapa === 'template' ? 'Escolher template' : 'Nova oferta'}
        </p>
      </header>

      <main className="px-4 pt-4">

        {/* ETAPA 1: Seleção de template */}
        {etapa === 'template' && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-500 mb-4">
              💡 Sugestões para {pmeData?.nomeFantasia ?? 'seu negócio'}
            </p>

            {getTemplates(pmeData?.categoria ?? '').map((t) => (
              <div key={t.titulo} className="card p-4 cursor-pointer active:scale-95 transition-transform"
                onClick={() => handleSelecionarTemplate(t)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-neutral-400 uppercase">{t.badge} {t.label}</span>
                  <span className="text-xs text-neutral-400">{t.horasValidade}h de validade</span>
                </div>
                <p className="font-semibold text-neutral-800 mb-1">{t.titulo}</p>
                <p className="text-sm text-neutral-500">
                  {t.desconto}% de desconto · {t.quantidadeTotal} unidades
                </p>
                <p className="text-primary-500 text-sm font-semibold mt-2">Usar este →</p>
              </div>
            ))}

            {/* Criar do zero */}
            <div className="card p-4 cursor-pointer border-2 border-dashed border-neutral-200"
              onClick={() => setEtapa('formulario')}>
              <p className="font-semibold text-neutral-600 mb-1">🆕 Criar do zero</p>
              <p className="text-sm text-neutral-400">Preencha todos os campos manualmente.</p>
            </div>
          </div>
        )}

        {/* ETAPA 2: Formulário + Preview */}
        {etapa === 'formulario' && (
          <div className="space-y-4">

            {/* Título */}
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase mb-1 block">
                Título da oferta
              </label>
              <input
                type="text"
                value={values.titulo}
                onChange={(e) => setField('titulo', e.target.value)}
                placeholder="Ex: Happy Hour: Pizza Média 40% OFF"
                maxLength={80}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500
                  ${errors.titulo ? 'border-red-400' : 'border-neutral-300'}`}
              />
              {errors.titulo && <p className="text-xs text-red-500 mt-1">{errors.titulo}</p>}
            </div>

            {/* Preço + Desconto */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase mb-1 block">
                  Preço original (R$)
                </label>
                <input
                  type="number"
                  value={values.valorOriginal}
                  onChange={(e) => setField('valorOriginal', parseFloat(e.target.value) || '')}
                  placeholder="45,00"
                  min={0}
                  step={0.01}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500
                    ${errors.valorOriginal ? 'border-red-400' : 'border-neutral-300'}`}
                />
                {errors.valorOriginal && <p className="text-xs text-red-500 mt-1">{errors.valorOriginal}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase mb-1 block">
                  Desconto (%)
                </label>
                <input
                  type="number"
                  value={values.desconto}
                  onChange={(e) => setField('desconto', parseInt(e.target.value) || '')}
                  placeholder="40"
                  min={5}
                  max={80}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500
                    ${errors.desconto ? 'border-red-400' : 'border-neutral-300'}`}
                />
                {errors.desconto && <p className="text-xs text-red-500 mt-1">{errors.desconto}</p>}
              </div>
            </div>

            {/* Preço calculado automaticamente */}
            {typeof values.valorOriginal === 'number' && typeof values.desconto === 'number' &&
              values.valorOriginal > 0 && values.desconto > 0 && (
              <p className="text-sm text-neutral-600">
                Preço final:{' '}
                <span className="font-bold text-neutral-800">
                  R$ {(values.valorOriginal * (1 - values.desconto / 100)).toFixed(2)}
                </span>
              </p>
            )}

            {/* Quantidade */}
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase mb-1 block">
                Quantidade disponível
              </label>
              <input
                type="number"
                value={values.quantidadeTotal}
                onChange={(e) => setField('quantidadeTotal', parseInt(e.target.value) || '')}
                placeholder="20"
                min={1}
                max={999}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500
                  ${errors.quantidadeTotal ? 'border-red-400' : 'border-neutral-300'}`}
              />
              {errors.quantidadeTotal && <p className="text-xs text-red-500 mt-1">{errors.quantidadeTotal}</p>}
            </div>

            {/* Validade — chips rápidos */}
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase mb-2 block">
                Válida por
              </label>
              <div className="flex gap-2 flex-wrap">
                {VALIDADES.map((v) => {
                  const dataAlvo = new Date(Date.now() + v.horas * 3600 * 1000);
                  const ativo = values.dataFim?.getTime() === dataAlvo.getTime();
                  return (
                    <button
                      key={v.label}
                      onClick={() => handleValidade(v.horas)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                        ${ativo
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-neutral-600 border-neutral-200'}`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
              {errors.dataFim && <p className="text-xs text-red-500 mt-1">{errors.dataFim}</p>}
            </div>

            {/* Foto (opcional) */}
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase mb-2 block">
                Foto (opcional)
              </label>
              <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl cursor-pointer hover:border-primary-300 transition-colors">
                <span className="text-sm text-neutral-500">
                  {uploadStatus === 'comprimindo' ? '⏳ Comprimindo...'
                    : uploadStatus === 'enviando' ? `📤 ${progresso}%`
                    : uploadStatus === 'concluido' ? '✅ Foto enviada'
                    : '📷 Tirar ou escolher foto'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFoto}
                />
              </label>

            </div>

            {/* Preview em tempo real */}
            <OfertaPreview data={previewData} />

            {/* Erro de submit */}
            {erroSubmit && (
              <p className="text-sm text-red-500 text-center">{erroSubmit}</p>
            )}

            {/* Limite do plano */}
            <p className="text-xs text-neutral-400 text-center">
              Ofertas este mês: {pmeData?.ofertasCriadas ?? 0}/{pmeData?.limiteOfertas ?? 10}
              {pmeData?.plano === 'free' ? ' (plano gratuito)' : ''}
            </p>

            {/* Botão publicar */}
            <button
              onClick={handlePublicar}
              disabled={!isValid || isSubmitting || uploadStatus === 'enviando'}
              className="btn-primary w-full py-4 text-base font-bold disabled:opacity-50"
            >
              {isSubmitting ? 'Publicando...' : '🟢 Publicar agora'}
            </button>

          </div>
        )}
      </main>
    </div>
  );
};
// #endregion

export default CriarOfertaPage;

// ============================================================
// FIM: src/pages/CriarOfertaPage.tsx
// ============================================================
