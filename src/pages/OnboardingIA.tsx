// ============================================================
// INÍCIO: src/pages/OnboardingIA.tsx
// Versão: 2.1.0 | Data: 2026-02-26
// Adições v2.1: 11 categorias, detecção automática por CNAE,
//               categoria pré-selecionada com confirmação visual
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarCNPJ, formatarCNPJ } from '../utils/validators';
import { getFunctions, httpsCallable } from 'firebase/functions';


import useAuth from '../hooks/useAuth';
import useImageUpload from '../hooks/useImageUpload';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region Types
interface DadosExtraidos {
  nomeFantasia?: string;
  cnpj?: string;
  categoria?: string;
  endereco?: Record<string, string>;
  telefone?: string;
}

type Passo = 1 | 2 | 3 | 4 | 5;

const CATEGORIAS = [
  { valor: 'restaurante',  label: '🍕 Restaurante'   },
  { valor: 'supermercado', label: '🛒 Supermercado'   },
  { valor: 'beleza',       label: '💇 Beleza'         },
  { valor: 'fitness',      label: '💪 Fitness'        },
  { valor: 'saude',        label: '🏥 Saúde'          },
  { valor: 'educacao',     label: '🎓 Educação'       },
  { valor: 'pet',          label: '🐾 Pet Shop'       },
  { valor: 'bar',          label: '🍺 Bar/Balada'     },
  { valor: 'hotel',        label: '🏨 Hotel'          },
  { valor: 'servicos',     label: '🛠️ Serviços'       },
  { valor: 'varejo',       label: '🛍️ Varejo'         },
];
// #endregion

// #region Helpers
const STEPS = [
  { numero: 1, label: 'CNPJ'      },
  { numero: 2, label: 'Negócio'   },
  { numero: 3, label: 'Categoria' },
  { numero: 4, label: 'Foto'      },
  { numero: 5, label: 'Confirmar' },
];

const PERGUNTAS_FALLBACK: Record<Passo, { titulo: string; sub: string }> = {
  1: { titulo: 'Qual o CNPJ do seu negócio?',   sub: 'Vamos buscar seus dados automaticamente na Receita Federal.' },
  2: { titulo: 'Como seu negócio se chama?',     sub: 'Confirme ou edite o nome que aparecerá para os clientes.' },
  3: { titulo: 'Qual é o seu segmento?',         sub: 'Identificamos automaticamente. Confirme ou escolha outra.' },
  4: { titulo: 'Adicione uma foto da fachada',   sub: 'Negócios com foto recebem 3x mais cliques.' },
  5: { titulo: 'Tudo certo! Revise seus dados.', sub: 'Confirme as informações antes de ativar seu painel.' },
};
// #endregion

// #region Component
const OnboardingIA: React.FC = () => {
  const navigate = useNavigate();
  const { usuario, refreshRole } = useAuth();
  const { upload, previewUrl, status: uploadStatus } = useImageUpload();

  const [passo, setPasso] = useState<Passo>(1);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos>({});
  const [salvando, setSalvando] = useState(false);
  const [erroCNPJ, setErroCNPJ] = useState<string | null>(null);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [categoriaAutoDetectada, setCategoriaAutoDetectada] = useState<string | null>(null);

  const [fallbackNome, setFallbackNome] = useState('');
  const [fallbackCNPJ, setFallbackCNPJ] = useState('');
  const [fallbackCategoria, setFallbackCategoria] = useState('');
  const [validandoCNPJ, setValidandoCNPJ] = useState(false);
  const [cnpjValidado, setCnpjValidado] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // #region Validar CNPJ
  const handleValidarCNPJ = useCallback(async (cnpj: string) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setErroCNPJ('Digite os 14 dígitos do CNPJ.');
      return false;
    }
    setValidandoCNPJ(true);
    setErroCNPJ(null);
    try {
      const result = await buscarCNPJ(cnpjLimpo);
      if (!result.valido) {
        setErroCNPJ(result.erro ?? 'CNPJ não encontrado ou inativo.');
        return false;
      }
      if (result.dados) {
        const enderecoReceita = {
          rua: result.dados.endereco.logradouro,
          numero: result.dados.endereco.numero,
          bairro: result.dados.endereco.bairro,
          cidade: result.dados.endereco.municipio,
          estado: result.dados.endereco.uf,
          cep: result.dados.endereco.cep,
        };
        const nomeRecuperado = result.dados.nomeFantasia || result.dados.razaoSocial || '';

        // Detecção automática de categoria via CNAE
        if (result.dados.categoriaDetectada) {
          setCategoriaAutoDetectada(result.dados.categoriaDetectada);
          setFallbackCategoria(result.dados.categoriaDetectada);
          setDadosExtraidos((prev) => ({
            ...prev,
            cnpj: cnpjLimpo,
            nomeFantasia: prev.nomeFantasia || nomeRecuperado,
            categoria: result.dados!.categoriaDetectada,
            endereco: enderecoReceita,
          }));
        } else {
          setDadosExtraidos((prev) => ({
            ...prev,
            cnpj: cnpjLimpo,
            nomeFantasia: prev.nomeFantasia || nomeRecuperado,
            endereco: enderecoReceita,
          }));
        }

        if (nomeRecuperado) setFallbackNome(nomeRecuperado);
      }
      setCnpjValidado(true);
      return true;
    } catch {
      setErroCNPJ('Erro ao validar. Tente novamente.');
      return false;
    } finally {
      setValidandoCNPJ(false);
    }
  }, []);
  // #endregion

  // #region Foto
  const handleFoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario?.uid) return;
    try {
      const url = await upload(file, `pmes/${usuario.uid}/fachada`);
      if (url) setImagemUrl(url);
    } catch {
      // Upload falhou silenciosamente — foto é opcional
    }
  }, [upload, usuario?.uid]);
  // #endregion

  // #region Avançar
  const handleAvancarFallback = useCallback(async () => {
    if (passo === 1) {
      const ok = await handleValidarCNPJ(fallbackCNPJ);
      if (ok) setPasso(2);
    } else if (passo === 2) {
      if (!fallbackNome.trim()) return;
      setDadosExtraidos((prev) => ({ ...prev, nomeFantasia: fallbackNome.trim() }));
      setPasso(3);
    } else if (passo === 3) {
      if (!fallbackCategoria) return;
      setDadosExtraidos((prev) => ({ ...prev, categoria: fallbackCategoria }));
      setPasso(4);
    } else if (passo === 4) {
      setPasso(5);
    }
  }, [passo, fallbackCNPJ, fallbackNome, fallbackCategoria, handleValidarCNPJ]);
  // #endregion

  // #region Concluir
  const handleConcluir = useCallback(async () => {
    if (!usuario?.uid) return;
    setSalvando(true);
    try {
      const functions = getFunctions();
      const promover = httpsCallable(functions, 'promoverParaPME');
      await promover({
        nomeFantasia: dadosExtraidos.nomeFantasia || fallbackNome,
        cnpj: dadosExtraidos.cnpj || fallbackCNPJ.replace(/\D/g, ''),
        categoria: dadosExtraidos.categoria || fallbackCategoria,
        endereco: dadosExtraidos.endereco ?? null,
        imagemUrl: imagemUrl ?? null,
      });
      // Força refresh do token para pegar o novo claim role=pme
      await refreshRole();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      alert('Erro: ' + (err?.message || JSON.stringify(err)));
      setSalvando(false);
    }
  }, [usuario, dadosExtraidos, fallbackNome, fallbackCNPJ, fallbackCategoria, imagemUrl, navigate]);
  // #endregion

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">

      {/* ── HEADER PREMIUM ── */}
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-primary-900 px-6 pt-12 pb-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">F</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">FlashDeal</span>
        </div>

        <h1 className="text-2xl font-black text-white leading-tight mb-1">
          {PERGUNTAS_FALLBACK[passo].titulo}
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          {PERGUNTAS_FALLBACK[passo].sub}
        </p>

        {/* Steps numerados */}
        <div className="flex items-center gap-1 mt-6">
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.numero}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step.numero < passo
                  ? 'bg-primary-500 text-white'
                  : step.numero === passo
                  ? 'bg-white text-neutral-900 shadow-lg'
                  : 'bg-neutral-700 text-neutral-500'
              }`}>
                {step.numero < passo ? '✓' : step.numero}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 transition-all ${
                  step.numero < passo ? 'bg-primary-500' : 'bg-neutral-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="flex-1 px-6 py-8 flex flex-col gap-6">

        {/* PASSO 1: CNPJ */}
        {passo === 1 && (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={formatarCNPJ(fallbackCNPJ)}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 14);
                  setFallbackCNPJ(val);
                  setErroCNPJ(null);
                  setCnpjValidado(false);
                }}
                placeholder="00.000.000/0000-00"
                className={`w-full border-2 rounded-2xl px-5 py-4 text-lg font-mono tracking-widest focus:outline-none transition-all ${
                  erroCNPJ ? 'border-red-400 bg-red-50'
                  : cnpjValidado ? 'border-success-500 bg-success-50'
                  : 'border-neutral-200 bg-white focus:border-primary-500'
                }`}
              />
              {cnpjValidado && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 bg-success-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
              {validandoCNPJ && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>

            {erroCNPJ && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <span className="text-red-500 mt-0.5">⚠️</span>
                <p className="text-sm text-red-600">{erroCNPJ}</p>
              </div>
            )}

            {cnpjValidado && dadosExtraidos.nomeFantasia && (
              <div className="flex items-start gap-3 p-4 bg-success-50 border border-success-300 rounded-2xl">
                <div className="w-8 h-8 bg-success-500 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <p className="text-xs text-success-700 font-semibold uppercase tracking-wide">Empresa encontrada</p>
                  <p className="text-sm font-bold text-neutral-800 mt-0.5">{dadosExtraidos.nomeFantasia}</p>
                  {dadosExtraidos.endereco?.cidade && (
                    <p className="text-xs text-neutral-500 mt-0.5">
                      📍 {dadosExtraidos.endereco.cidade}, {dadosExtraidos.endereco.estado}
                    </p>
                  )}
                  {categoriaAutoDetectada && (
                    <p className="text-xs text-primary-600 font-semibold mt-1">
                      🏷️ Segmento detectado: {CATEGORIAS.find(c => c.valor === categoriaAutoDetectada)?.label}
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleAvancarFallback}
              disabled={validandoCNPJ || fallbackCNPJ.replace(/\D/g, '').length < 14}
              className="btn-primary w-full py-4 text-base font-bold rounded-2xl disabled:opacity-40"
            >
              {validandoCNPJ ? '🔍 Buscando na Receita Federal...' : 'Validar CNPJ →'}
            </button>

            <button
              onClick={() => { setErroCNPJ(null); setPasso(2); }}
              className="w-full text-sm text-neutral-400 py-2"
            >
              Não tenho CNPJ — pular esta etapa
            </button>
          </div>
        )}

        {/* PASSO 2: Nome */}
        {passo === 2 && (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-white border-2 border-neutral-100 rounded-2xl shadow-card">
              <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wide mb-1">Nome do negócio</p>
              <input
                type="text"
                value={fallbackNome}
                onChange={(e) => setFallbackNome(e.target.value)}
                placeholder="Ex: Pizzaria Bella"
                className="w-full text-lg font-bold text-neutral-800 focus:outline-none placeholder:text-neutral-300"
                autoFocus
              />
            </div>

            {dadosExtraidos.endereco?.cidade && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-neutral-400 text-sm">📍</span>
                <p className="text-sm text-neutral-500">
                  {dadosExtraidos.endereco.rua}, {dadosExtraidos.endereco.numero} — {dadosExtraidos.endereco.cidade}/{dadosExtraidos.endereco.estado}
                </p>
              </div>
            )}

            <button
              onClick={handleAvancarFallback}
              disabled={!fallbackNome.trim()}
              className="btn-primary w-full py-4 text-base font-bold rounded-2xl disabled:opacity-40"
            >
              Confirmar nome →
            </button>
          </div>
        )}

        {/* PASSO 3: Categoria */}
        {passo === 3 && (
          <div className="flex flex-col gap-4">

            {/* Banner de detecção automática */}
            {categoriaAutoDetectada && (
              <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-200 rounded-xl">
                <span className="text-primary-500 text-lg">🤖</span>
                <div>
                  <p className="text-xs text-primary-700 font-semibold">Detectado automaticamente</p>
                  <p className="text-xs text-primary-600">Confirme ou escolha outra categoria</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat.valor}
                  onClick={() => setFallbackCategoria(cat.valor)}
                  className={`py-4 rounded-2xl text-sm font-bold border-2 transition-all active:scale-95 relative ${
                    fallbackCategoria === cat.valor
                      ? 'border-primary-500 bg-primary-50 text-primary-600 shadow-md'
                      : 'border-neutral-200 bg-white text-neutral-600'
                  }`}
                >
                  {/* Badge "automático" na categoria detectada */}
                  {cat.valor === categoriaAutoDetectada && (
                    <span className="absolute -top-2 -right-2 bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                      IA
                    </span>
                  )}
                  <span className="text-2xl block mb-1">{cat.label.split(' ')[0]}</span>
                  <span>{cat.label.split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleAvancarFallback}
              disabled={!fallbackCategoria}
              className="btn-primary w-full py-4 text-base font-bold rounded-2xl disabled:opacity-40"
            >
              Confirmar categoria →
            </button>
          </div>
        )}

        {/* PASSO 4: Foto */}
        {passo === 4 && (
          <div className="flex flex-col gap-4">
            <label className="block cursor-pointer">
              <div className={`w-full h-52 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all overflow-hidden ${
                previewUrl ? 'border-primary-300'
                : 'border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50'
              }`}>
                {previewUrl ? (
                  <img src={previewUrl} alt="Fachada" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center px-6">
                    <p className="text-5xl mb-3">📷</p>
                    <p className="text-sm font-semibold text-neutral-600">
                      {uploadStatus === 'comprimindo' ? '⚙️ Otimizando imagem...'
                        : uploadStatus === 'enviando' ? '☁️ Enviando...'
                        : 'Toque para tirar foto ou escolher da galeria'}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">Recomendado: foto da fachada do negócio</p>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
            </label>

            {previewUrl && (
              <div className="flex items-center gap-2 p-3 bg-success-50 border border-success-200 rounded-xl">
                <span className="text-success-500">✓</span>
                <p className="text-sm text-success-700 font-semibold">Foto adicionada com sucesso</p>
              </div>
            )}

            <button
              onClick={handleAvancarFallback}
              disabled={uploadStatus === 'enviando' || uploadStatus === 'comprimindo'}
              className="btn-primary w-full py-4 text-base font-bold rounded-2xl disabled:opacity-40"
            >
              {previewUrl ? 'Continuar com essa foto →' : 'Pular — adicionar depois →'}
            </button>
          </div>
        )}

        {/* PASSO 5: Confirmação */}
        {passo === 5 && (
          <div className="flex flex-col gap-4">
            <div className="bg-white border-2 border-neutral-100 rounded-2xl shadow-card overflow-hidden">
              {previewUrl && <img src={previewUrl} alt="Fachada" className="w-full h-32 object-cover" />}
              <div className="p-5 space-y-4">
                {[
                  { icon: '🏪', label: 'Nome',      valor: dadosExtraidos.nomeFantasia || fallbackNome },
                  { icon: '📋', label: 'CNPJ',      valor: dadosExtraidos.cnpj ? formatarCNPJ(dadosExtraidos.cnpj) : fallbackCNPJ },
                  { icon: '🏷️', label: 'Categoria', valor: CATEGORIAS.find(c => c.valor === (dadosExtraidos.categoria || fallbackCategoria))?.label || '—' },
                  { icon: '📍', label: 'Endereço',  valor: dadosExtraidos.endereco?.rua ? `${dadosExtraidos.endereco.rua}, ${dadosExtraidos.endereco.numero} — ${dadosExtraidos.endereco.cidade}` : 'Não informado' },
                ].map(({ icon, label, valor }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{icon}</span>
                    <div>
                      <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wide">{label}</p>
                      <p className="text-sm font-bold text-neutral-800 mt-0.5">{valor || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary-50 to-orange-50 border border-primary-200 rounded-2xl">
              <span className="text-2xl">🎁</span>
              <div>
                <p className="text-sm font-bold text-primary-700">Plano Gratuito ativado</p>
                <p className="text-xs text-primary-600">10 ofertas por mês, sem cartão de crédito</p>
              </div>
            </div>

            <button
              onClick={handleConcluir}
              disabled={salvando}
              className="btn-primary w-full py-5 text-base font-black rounded-2xl shadow-lg disabled:opacity-40"
            >
              {salvando ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" /> Ativando seu painel...
                </span>
              ) : '🚀 Ativar meu painel agora'}
            </button>

            <button onClick={() => setPasso(1)} className="w-full text-sm text-neutral-400 py-2">
              ← Corrigir algum dado
            </button>
          </div>
        )}
      </div>

      {/* ── BOTÃO VOLTAR (passos 2-4) ── */}
      {passo > 1 && passo < 5 && (
        <div className="px-6 pb-8">
          <button
            onClick={() => setPasso((p) => (p - 1) as Passo)}
            className="flex items-center gap-2 text-sm text-neutral-500 font-medium"
          >
            ← Voltar
          </button>
        </div>
      )}
    </div>
  );
};
// #endregion

export default OnboardingIA;

// ============================================================
// FIM: src/pages/OnboardingIA.tsx
// ============================================================
