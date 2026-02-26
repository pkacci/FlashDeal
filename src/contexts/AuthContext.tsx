/* --- PATH: src/contexts/AuthContext.tsx --- */
// Versão: 1.5.0 | Alteração: Implementação de Resiliência de Claims e Refresh Automático
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
  user: User | null;         // Alias para compatibilidade
  role: 'pme' | 'consumidor' | null;
  loading: boolean;
  pmeData: PMEData | null;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>; // Expõe para forçar atualização após onboarding
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [role, setRole] = useState<'pme' | 'consumidor' | null>(null);
  const [loading, setLoading] = useState(true);
  const [pmeData, setPmeData] = useState<PMEData | null>(null);

  // Função para forçar o refresh do token e buscar claims atualizadas
  const refreshRole = async () => {
    try {
      if (!auth.currentUser) return;
      
      // Força refresh do token (true) para garantir claims da Cloud Function
      const idTokenResult = await getIdTokenResult(auth.currentUser, true);
      const claimRole = idTokenResult.claims.role as 'pme' | 'consumidor' | undefined;
      
      if (claimRole) {
        setRole(claimRole);
        if (claimRole === 'pme') {
          const snap = await getDoc(doc(db, 'pmes', auth.currentUser.uid));
          if (snap.exists()) setPmeData(snap.data() as PMEData);
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar role:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setUsuario(user);
          
          // 1ª Tentativa: Busca claims existentes
          const idTokenResult = await getIdTokenResult(user);
          const claimRole = idTokenResult.claims.role as 'pme' | 'consumidor' | undefined;

          if (claimRole) {
            setRole(claimRole);
            if (claimRole === 'pme') {
              const snap = await getDoc(doc(db, 'pmes', user.uid));
              if (snap.exists()) setPmeData(snap.data() as PMEData);
            }
          } else {
            // Caso não tenha claim (novo usuário), tenta fallback por documento
            // Mas não trava o loading, permite que ele entre no Onboarding
            const pmeSnap = await getDoc(doc(db, 'pmes', user.uid));
            if (pmeSnap.exists()) {
              setRole('pme');
              setPmeData(pmeSnap.data() as PMEData);
            } else {
              // Aguarda um pequeno delay e tenta um refresh silencioso (Cloud Function latency)
              setTimeout(() => refreshRole(), 2500);
            }
          }
        } else {
          setUsuario(null);
          setRole(null);
          setPmeData(null);
        }
      } catch (error) {
        console.error("Erro no observador de Auth:", error);
        setRole('consumidor'); // Fallback seguro
      } finally {
        // Timeout de segurança: nunca deixa o app travado no spinner mais de 4s
        setTimeout(() => setLoading(false), 1500);
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
      console.error("Erro ao deslogar:", error);
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
// FUNÇÕES PRESENTES: AuthProvider, useAuth, refreshRole, signOut
