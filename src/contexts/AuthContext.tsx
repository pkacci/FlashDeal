// ============================================================
// INÍCIO: src/contexts/AuthContext.tsx
// Versão: 1.6.0 | Data: 2026-02-26
// Fix v1.6: setLoading(false) só após ter role E pmeData prontos
//           Elimina race condition do setTimeout forçado
// ============================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  getIdTokenResult,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface PMEData {
  endereco?: Record<string, any>;
  geohash?: string;
  nomeFantasia?: string;
  plano?: 'free' | 'pro' | 'premium';
  limiteOfertas?: number;
  ofertasCriadas?: number;
  categoria?: string;
  imagemUrl?: string;
  ativa?: boolean;
}

export interface AuthContextType {
  usuario: User | null;
  user: User | null;
  role: 'pme' | 'consumidor' | null;
  loading: boolean;
  pmeData: PMEData | null;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [role, setRole] = useState<'pme' | 'consumidor' | null>(null);
  const [loading, setLoading] = useState(true);
  const [pmeData, setPmeData] = useState<PMEData | null>(null);

  // Busca pmeData e seta role=pme atomicamente
  const carregarPME = async (uid: string) => {
    const snap = await getDoc(doc(db, 'pmes', uid));
    if (snap.exists()) {
      setPmeData(snap.data() as PMEData);
      setRole('pme');
      return true;
    }
    return false;
  };

  // Força refresh do token e recarrega role + pmeData
  const refreshRole = async () => {
    try {
      if (!auth.currentUser) return;
      const idTokenResult = await getIdTokenResult(auth.currentUser, true);
      const claimRole = idTokenResult.claims.role as 'pme' | 'consumidor' | undefined;

      if (claimRole === 'pme') {
        await carregarPME(auth.currentUser.uid);
      } else if (claimRole === 'consumidor') {
        setRole('consumidor');
        setPmeData(null);
      }
    } catch (error) {
      console.error('Erro ao atualizar role:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setUsuario(user);

          // 1ª tentativa: claims existentes no token
          const idTokenResult = await getIdTokenResult(user);
          const claimRole = idTokenResult.claims.role as 'pme' | 'consumidor' | undefined;

          if (claimRole === 'pme') {
            // Carrega pmeData antes de liberar o loading
            await carregarPME(user.uid);
            setLoading(false);

          } else if (claimRole === 'consumidor') {
            setRole('consumidor');
            setPmeData(null);
            setLoading(false);

          } else {
            // Sem claim ainda (novo usuário ou claim não propagou)
            // Tenta fallback por documento Firestore
            const temPME = await carregarPME(user.uid);
            if (temPME) {
              // PME já existe no Firestore mas claim ainda não propagou
              setLoading(false);
            } else {
              // Consumidor novo — aguarda claim da Cloud Function onUserCreate
              // Timeout de segurança: máximo 4s esperando
              const timer = setTimeout(() => {
                setRole('consumidor');
                setLoading(false);
              }, 4000);

              // Tenta refresh após 2.5s (tempo médio de propagação do claim)
              setTimeout(async () => {
                try {
                  const result = await getIdTokenResult(user, true);
                  const r = result.claims.role as 'pme' | 'consumidor' | undefined;
                  if (r === 'pme') {
                    clearTimeout(timer);
                    await carregarPME(user.uid);
                    setLoading(false);
                  } else if (r === 'consumidor') {
                    clearTimeout(timer);
                    setRole('consumidor');
                    setLoading(false);
                  }
                } catch {
                  // Timer de segurança já vai resolver
                }
              }, 2500);
            }
          }
        } else {
          // Usuário deslogado
          setUsuario(null);
          setRole(null);
          setPmeData(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro no observador de Auth:', error);
        setRole('consumidor'); // Fallback seguro
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUsuario(null);
      setRole(null);
      setPmeData(null);
    } catch (error) {
      console.error('Erro ao deslogar:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      usuario,
      user: usuario,
      role,
      loading,
      pmeData,
      signOut,
      refreshRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};

export default AuthProvider;

// ============================================================
// FIM: src/contexts/AuthContext.tsx
// ============================================================
