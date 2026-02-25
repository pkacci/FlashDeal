// ============================================================
// INÍCIO: src/hooks/useImageUpload.ts
// Versão: 1.0.0 | Data: 2026-02-25
// Deps: React, firebase/storage, browser-image-compression
// Instalação: npm install browser-image-compression
// Descrição: Hook de upload de imagem com compressão client-side
//            — Comprime para .webp, max 1080px, qualidade 0.8
//            — Respeita Regra de Mídia (seção 11.2 do doc mestre)
//            — Upload para Firebase Storage com path por uid/role
//            — Retorna URL pública após upload
//            — Preview local via URL.createObjectURL (zero latência)
// ============================================================

import { useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { storage } from '../services/firebase';

// #region Types
export type UploadStatus = 'idle' | 'comprimindo' | 'enviando' | 'concluido' | 'erro';

interface UseImageUploadReturn {
  status: UploadStatus;
  progresso: number;        // 0-100 durante upload
  previewUrl: string | null; // URL local para preview imediato
  downloadUrl: string | null; // URL pública do Firebase Storage
  erro: string | null;
  upload: (file: File, storagePath: string) => Promise<string | null>;
  reset: () => void;
}
// #endregion

// #region Constantes — Regra de Mídia (doc mestre seção 11.2)
const COMPRESSION_OPTIONS: Parameters<typeof imageCompression>[1] = {
  maxSizeMB: 1,            // Máximo 1MB após compressão
  maxWidthOrHeight: 1080,  // Max 1080px (largura ou altura)
  useWebWorker: true,      // Não bloqueia a UI no mobile
  fileType: 'image/webp',  // Formato obrigatório: .webp
  initialQuality: 0.8,     // Qualidade 80%
};
// #endregion

// #region Hook
const useImageUpload = (): UseImageUploadReturn => {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progresso, setProgresso] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, storagePath: string): Promise<string | null> => {
      // Reset de estado anterior
      setErro(null);
      setProgresso(0);
      setDownloadUrl(null);

      // Preview local imediato — não espera upload
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);

      try {
        // ETAPA 1: Compressão client-side
        setStatus('comprimindo');
        const fileComprimido = await imageCompression(file, COMPRESSION_OPTIONS);

        // ETAPA 2: Upload para Firebase Storage
        setStatus('enviando');
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, fileComprimido, {
          contentType: 'image/webp',
        });

        // Aguarda conclusão com progresso reativo
        const url = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              // Atualiza progresso para feedback visual
              const perc = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              setProgresso(perc);
            },
            // Erro no upload
            (error) => reject(error),
            // Concluído — obtém URL pública
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });

        setDownloadUrl(url);
        setStatus('concluido');
        setProgresso(100);

        // Libera memória do objeto URL local
        URL.revokeObjectURL(localUrl);

        return url;
      } catch (error) {
        const mensagem =
          error instanceof Error ? error.message : 'Erro desconhecido no upload.';
        setErro(mensagem);
        setStatus('erro');
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    // Libera preview URL se ainda existir
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStatus('idle');
    setProgresso(0);
    setPreviewUrl(null);
    setDownloadUrl(null);
    setErro(null);
  }, [previewUrl]);

  return { status, progresso, previewUrl, downloadUrl, erro, upload, reset };
};
// #endregion

export default useImageUpload;

// ============================================================
// FIM: src/hooks/useImageUpload.ts
// ============================================================
