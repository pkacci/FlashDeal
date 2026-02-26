// ============================================================
// INÍCIO: src/pages/OnboardingIA.tsx
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, react-router-dom, firebase/functions,
//       firebase/firestore, hooks/useAuth, hooks/useImageUpload
// Descrição: Onboarding conversacional da PME
//            — Modo Chat: IA Gemini extrai dados via conversa
//            — Modo Fallback: slot-filling guiado (se IA falha)
//            — Transição Chat → Fallback silenciosa (sem erro visível)
//            — 5 passos com barra de progresso
//            — BrasilAPI valida CNPJ (Cloud Function validarCNPJ)
//            — Upload de foto da fachada (.webp via useImageUpload)
//            — Ao concluir: salva PME no Firestore + redireciona /dashboard
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import useAuth from '../hooks/useAuth';
import useImageUpload from '../hooks/useImageUpload';
import LoadingSpinner from '../components/common/LoadingSpinner';

// #region Types
interface Mensagem {
  role: 'assistant' | 'user';
  content: string;
}

interface DadosExtraidos {
  nomeFantasia?: string;
  cnpj?: string;
  categoria?: string;
  endereco?: Record<string, string>;
  telefone?: string;
}

type Passo = 1 | 2 | 3 | 4 | 5;
type Modo = 'chat' | 'fallback';

// Categorias disponíveis para seleção no fallback
const CATEGORIAS = [
  { valor: 'restaurante', label: '🍕 Restaurante' },
  { valor: 'beleza',      label: '💇 Beleza' },
  { valor: 'fitness',     label: '💪 Fitness' },
  { valor: 'servicos',    label: '🛠️ Serviços' },
  { valor: 'varejo',      label: '🛍️ Varejo' },
];
// #endregion

// #region Helpers
const MENSAGENS_INICIAIS: Mensagem[] = [
  {
    role: 'assistant',
    content: 'Olá! Vou te ajudar a cadastrar seu negócio em 3 minutos. Qual o nome do seu negócio?',
  },
];

const PERGUNTAS_FALLBACK: Record<Passo, string> = {
  1: 'Qual o nome do seu negócio?',
  2: 'Qual o CNPJ do seu negócio?',
  3: 'Qual a categoria do seu negócio?',
  4: 'Tire uma foto da fachada do seu negócio.',
  5: 'Confirme os dados abaixo.',
};
// #endregion

// #region Component
const OnboardingIA: React.FC = () => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { upload, previewUrl, status: uploadStatus } = useImageUpload();

  const [modo, setModo] = useState<Modo>('chat');
  const [passo, setPasso] = useState<Passo>(1);
  const [mensagens, setMensagens] = useState<Mensagem[]>(MENSAGENS_INICIAIS);
  const [inputChat, setInputChat] = useState('');
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos>({});
  const [loadingIA, setLoadingIA] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroCNPJ, setErroCNPJ] = useState<string | null>(null);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);

  // Fallback: campos individuais
  const [fallbackNome, setFallbackNome] = useState('');
  const [fallbackCNPJ, setFallbackCNPJ] = useState('');
  const [fallbackCategoria, setFallbackCategoria] = useState('');
  const [validandoCNPJ, setValidandoCNPJ] = useState(false);
  const [alertaEndereco, setAlertaEndereco] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll automático para última mensagem
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // #region Ativa fallback silenciosamente
  const ativarFallback = useCallback((dadosAtuais: DadosExtraidos) => {
    setModo('fallback');
    // Preenche campos do fallback com o que já foi extraído
    if (dadosAtuais.nomeFantasia) setFallbackNome(dadosAtuais.nomeFantasia);
    if (dadosAtuais.cnpj) setFallbackCNPJ(dadosAtuais.cnpj);
    if (dadosAtuais.categoria) setFallbackCategoria(dadosAtuais.categoria);

    // Determina em qual passo retomar
    if (!dadosAtuais.nomeFantasia) setPasso(1);
    else if (!dadosAtuais.cnpj) setPasso(2);
    else if (!dadosAtuais.categoria) setPasso(3);
    else setPasso(4);
  }, []);
  // #endregion

  // #region Enviar mensagem no chat
  const handleEnviarMensagem = useCallback(async () => {
    if (!inputChat.trim() || loadingIA || !usuario?.uid) return;

    const novaMensagem: Mensagem = { role: 'user', content: inputChat.trim() };
    const historico = [...mensagens, novaMensagem];
    setMensagens(historico);
    setInputChat('');
    setLoadingIA(true);

    try {
      const functions = getFunctions();
      const fn = httpsCallable<
        { mensagens: Mensagem[]; dadosAtuais: DadosExtraidos },
        { resposta: string; dadosExtraidos: DadosExtraidos; concluido: boolean; fallback?: boolean }
      >(functions, 'chatIA');

      const result = await fn({ mensagens: historico, dadosAtuais: dadosExtraidos });
      const { resposta, dadosExtraidos: novos, concluido, fallback } = result.data;

      // Se IA sinaliza fallback (rate limit ou erro), ativa modo silencioso
      if (fallback) {
        ativarFallback({ ...dadosExtraidos, ...novos });
        return;
      }

      // Atualiza dados extraídos acumulados
      const dadosAtualizados = { ...dadosExtraidos, ...novos };
      setDadosExtraidos(dadosAtualizados);

      // Adiciona resposta da IA ao chat
      setMensagens([...historico, { role: 'assistant', content: resposta }]);

      // Atualiza barra de progresso conforme dados extraídos
      const campos = ['nomeFantasia', 'cnpj', 'categoria'] as const;
      const preenchidos = campos.filter((c) => dadosAtualizados[c]).length;
      setPasso((Math.min(preenchidos + 1, 4)) as Passo);

      // IA sinalizou que todos os dados foram coletados
      if (concluido) setPasso(4); // Vai para passo de foto

    } catch {
      // Qualquer erro → fallback silencioso
      ativarFallback(dadosExtraidos);
    } finally {
      setLoadingIA(false);
    }
  }, [inputChat, mensagens, dadosExtraidos, loadingIA, usuario?.uid, ativarFallback]);
  // #endregion

  // #region Validar CNPJ (fallback e chat)
  const handleValidarCNPJ = useCallback(async (cnpj: string) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setErroCNPJ('CNPJ deve ter 14 dígitos.');
      return false;
    }

    setValidandoCNPJ(true);
    setErroCNPJ(null);

    try {
      const functions = getFunctions();
      const fn = httpsCallable<{ cnpj: string }, { valido: boolean; dados?: Record<string, string> }>(
        functions, 'validarCNPJ'
      );
      const result = await fn({ cnpj: cnpjLimpo });

      if (!result.data.valido) {
        setErroCNPJ('CNPJ não encontrado ou inativo.');
        return false;
      }

      // Preenche endereço automaticamente se disponível
      if (result.data.dados) {
        setDadosExtraidos((prev) => ({
          ...prev,
          cnpj: cnpjLimpo,
          endereco: result.data.dados,
        }));

        // Antifraude: cruzamento endereço Receita Federal vs endereço digitado
        const dadosReceita = result.data.dados as Record<string, string>;
        const cidadeReceita = (dadosReceita.cidade ?? '').toLowerCase().trim();
        const cidadeDigitada = (dadosExtraidos.endereco?.cidade ?? '').toLowerCase().trim();
        if (cidadeDigitada && cidadeReceita && cidadeDigitada !== cidadeReceita) {
          setAlertaEndereco(
            `⚠️ O CNPJ está registrado em ${dadosReceita.cidade}/${dadosReceita.estado} na Receita Federal, mas você informou ${dadosExtraidos.endereco?.cidade}. Confirme se o endereço está correto.`
          );
        } else {
          setAlertaEndereco(null);
        }
      }

      return true;
    } catch {
      setErroCNPJ('Não foi possível validar o CNPJ. Prossiga mesmo assim.');
      return true; // Permite continuar mesmo sem validação
    } finally {
      setValidandoCNPJ(false);
    }
  }, []);
  // #endregion

  // #region Upload de foto
  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario?.uid) return;
    const path = `pmes/${usuario.uid}/fachada.webp`;
    const url = await upload(file, path);
    if (url) setImagemUrl(url);
  };
  // #endregion

  // #region Avançar no fallback
  const handleAvancarFallback = useCallback(async () => {
    if (passo === 1) {
      if (!fallbackNome.trim()) return;
      setDadosExtraidos((p) => ({ ...p, nomeFantasia: fallbackNome.trim() }));
      setPasso(2);
    } else if (passo === 2) {
      const ok = await handleValidarCNPJ(fallbackCNPJ);
      if (!ok) return;
      setDadosExtraidos((p) => ({ ...p, cnpj: fallbackCNPJ.replace(/\D/g, '') }));
      setPasso(3);
    } else if (passo === 3) {
      if (!fallbackCategoria) return;
      setDadosExtraidos((p) => ({ ...p, categoria: fallbackCategoria }));
      setPasso(4);
    } else if (passo === 4) {
      setPasso(5);
    }
  }, [passo, fallbackNome, fallbackCNPJ, fallbackCategoria, handleValidarCNPJ]);
  // #endregion

  // #region Salvar PME no Firestore
  const handleConcluir = useCallback(async () => {
    if (!usuario?.uid) return;
    setSalvando(true);

    try {
      await updateDoc(doc(db, 'pmes', usuario.uid), {
        nomeFantasia: dadosExtraidos.nomeFantasia ?? fallbackNome,
        cnpj: dadosExtraidos.cnpj ?? fallbackCNPJ.replace(/\D/g, ''),
        categoria: dadosExtraidos.categoria ?? fallbackCategoria,
        endereco: dadosExtraidos.endereco ?? {},
        telefone: dadosExtraidos.telefone ?? null,
        imagemUrl: imagemUrl ?? null,
        status: 'ativo',
        updatedAt: Timestamp.now(),
      });
      navigate('/dashboard', { replace: true });
    } catch {
      setSalvando(false);
    }
  }, [usuario?.uid, dadosExtraidos, fallbackNome, fallbackCNPJ, fallbackCategoria, imagemUrl, navigate]);
  // #endregion

  const progresso = Math.round(((passo - 1) / 4) * 100);

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Header com progresso */}
      <header className="px-4 pt-4 pb-3 border-b border-neutral-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-neutral-600">
            Passo {passo} de 5
          </span>
          <span className="text-xs text-neutral-400">
            {modo === 'chat' ? '🤖 Assistente IA' : '📋 Cadastro guiado'}
          </span>
        </div>
        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </header>

      {/* MODO CHAT */}
      {modo === 'chat' && (
        <>
          {/* Área de mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {mensagens.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary-500 text-white rounded-br-sm'
                    : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Indicador de digitação */}
            {loadingIA && (
              <div className="flex justify-start">
                <div className="bg-neutral-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input do chat */}
          <div className="px-4 py-3 border-t border-neutral-100 flex gap-2">
            <input
              type="text"
              value={inputChat}
              onChange={(e) => setInputChat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEnviarMensagem()}
              placeholder="Digite sua mensagem..."
              className="flex-1 border border-neutral-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary-500"
              disabled={loadingIA}
            />
            <button
              onClick={handleEnviarMensagem}
              disabled={loadingIA || !inputChat.trim()}
              className="w-10 h-10 bg-primary-500 text-white rounded-xl flex items-center justify-center disabled:opacity-50 shrink-0"
            >
              ➤
            </button>
          </div>

          {/* Link para fallback manual */}
          <p className="text-center text-xs text-neutral-400 pb-4">
            <button onClick={() => ativarFallback(dadosExtraidos)} className="underline">
              Prefiro preencher manualmente
            </button>
          </p>
        </>
      )}

      {/* MODO FALLBACK */}
      {modo === 'fallback' && (
        <div className="flex-1 px-6 py-6 flex flex-col">
          <p className="text-lg font-semibold text-neutral-800 mb-6">
            {PERGUNTAS_FALLBACK[passo]}
          </p>

          {/* Passo 1: Nome */}
          {passo === 1 && (
            <div className="space-y-3">
              <input
                type="text"
                value={fallbackNome}
                onChange={(e) => setFallbackNome(e.target.value)}
                placeholder="Ex: Pizzaria Bella"
                className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500"
                autoFocus
              />
              <button
                onClick={handleAvancarFallback}
                disabled={!fallbackNome.trim()}
                className="btn-primary w-full disabled:opacity-50"
              >
                Continuar →
              </button>
            </div>
          )}

          {/* Passo 2: CNPJ */}
          {passo === 2 && (
            <div className="space-y-3">
              <input
                type="text"
                value={fallbackCNPJ}
                onChange={(e) => setFallbackCNPJ(e.target.value)}
                placeholder="XX.XXX.XXX/XXXX-XX"
                maxLength={18}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500
                  ${erroCNPJ ? 'border-red-400' : 'border-neutral-300'}`}
              />
              {erroCNPJ && <p className="text-xs text-red-500">{erroCNPJ}</p>}
              {alertaEndereco && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-xs text-yellow-800">
                  {alertaEndereco}
                </div>
              )}
              <button
                onClick={handleAvancarFallback}
                disabled={validandoCNPJ || fallbackCNPJ.replace(/\D/g, '').length < 14}
                className="btn-primary w-full disabled:opacity-50"
              >
                {validandoCNPJ ? '🔍 Validando CNPJ...' : 'Validar e continuar →'}
              </button>
              <button
                onClick={() => { setErroCNPJ(null); setPasso(3); }}
                className="w-full text-sm text-neutral-400 underline"
              >
                Não tenho CNPJ — pular
              </button>
            </div>
          )}

          {/* Passo 3: Categoria */}
          {passo === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIAS.map((cat) => (
                  <button
                    key={cat.valor}
                    onClick={() => setFallbackCategoria(cat.valor)}
                    className={`py-3 rounded-xl text-sm font-medium border-2 transition-colors ${
                      fallbackCategoria === cat.valor
                        ? 'border-primary-500 bg-primary-50 text-primary-600'
                        : 'border-neutral-200 text-neutral-600'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleAvancarFallback}
                disabled={!fallbackCategoria}
                className="btn-primary w-full disabled:opacity-50 mt-2"
              >
                Continuar →
              </button>
            </div>
          )}

          {/* Passo 4: Foto */}
          {passo === 4 && (
            <div className="space-y-4">
              <label className="block">
                <div className={`w-full h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors
                  ${previewUrl ? 'border-primary-300' : 'border-neutral-200 hover:border-neutral-300'}`}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Fachada" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <>
                      <p className="text-3xl mb-2">📷</p>
                      <p className="text-sm text-neutral-500">
                        {uploadStatus === 'comprimindo' ? 'Comprimindo...'
                          : uploadStatus === 'enviando' ? `Enviando... ${uploadStatus}`
                          : 'Tirar foto ou escolher da galeria'}
                      </p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFoto}
                />
              </label>

              <button
                onClick={handleAvancarFallback}
                disabled={uploadStatus === 'enviando' || uploadStatus === 'comprimindo'}
                className="btn-primary w-full disabled:opacity-50"
              >
                {previewUrl ? 'Continuar com essa foto →' : 'Pular foto →'}
              </button>
            </div>
          )}

          {/* Passo 5: Confirmação */}
          {passo === 5 && (
            <div className="space-y-4">
              <div className="card p-4 space-y-3">
                {[
                  { label: '🏪 Nome', valor: dadosExtraidos.nomeFantasia ?? fallbackNome },
                  { label: '📋 CNPJ', valor: dadosExtraidos.cnpj ?? fallbackCNPJ },
                  { label: '🏷️ Categoria', valor: dadosExtraidos.categoria ?? fallbackCategoria },
                  { label: '📍 Endereço', valor: dadosExtraidos.endereco?.rua
                    ? `${dadosExtraidos.endereco.rua}, ${dadosExtraidos.endereco.numero}`
                    : 'Não informado' },
                ].map(({ label, valor }) => (
                  <div key={label}>
                    <p className="text-xs text-neutral-400">{label}</p>
                    <p className="text-sm font-medium text-neutral-800">{valor || '—'}</p>
                  </div>
                ))}
                {previewUrl && (
                  <img src={previewUrl} alt="Fachada" className="w-full h-24 object-cover rounded-lg" />
                )}
              </div>

              <button
                onClick={handleConcluir}
                disabled={salvando}
                className="btn-primary w-full py-4 text-base font-bold disabled:opacity-50"
              >
                {salvando ? <LoadingSpinner size="sm" /> : '🎉 Concluir cadastro'}
              </button>

              <button
                onClick={() => setPasso(1)}
                className="w-full text-sm text-neutral-400 underline"
              >
                Corrigir dados
              </button>
            </div>
          )}

          {/* Botão voltar */}
          {passo > 1 && passo < 5 && (
            <button
              onClick={() => setPasso((p) => (p - 1) as Passo)}
              className="mt-auto pt-4 text-sm text-neutral-400"
            >
              ← Voltar
            </button>
          )}
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
