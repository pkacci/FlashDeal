// ============================================================
// INÍCIO: src/contexts/AuthContext.tsx
// Versão: 1.2.0 | Correção: user alias + pmeData adicionados
// ============================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
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
  user: User | null;         // ← alias para compatibilidade
  role: 'pme' | 'consumidor' | null;
  loading: boolean;
  pmeData: PMEData | null;   // ← adicionado
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [role, setRole] = useState<'pme' | 'consumidor' | null>(null);
  const [loading, setLoading] = useState(true);
  const [pmeData, setPmeData] = useState<PMEData | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setUsuario(user);
          try {
            const idTokenResult = await user.getIdTokenResult();
            const claimRole = idTokenResult.claims.role as 'pme' | 'consumidor' | undefined;
            if (claimRole) {
              setRole(claimRole);
              if (claimRole === 'pme') {
                try {
                  const snap = await getDoc(doc(db, 'pmes', user.uid));
                  if (snap.exists()) setPmeData(snap.data() as PMEData);
                } catch { /* ignora erro de permissão */ }
              }
            } else {
              try {
                const pmeSnap = await getDoc(doc(db, 'pmes', user.uid));
                if (pmeSnap.exists()) {
                  setRole('pme');
                  setPmeData(pmeSnap.data() as PMEData);
                } else {
                  setRole('consumidor');
                }
              } catch {
                setRole('consumidor');
              }
            }
          } catch {
            setRole('consumidor');
          }
        } else {
          setUsuario(null);
          setRole(null);
          setPmeData(null);
        }
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUsuario(null);
    setRole(null);
    setPmeData(null);
  };

  return (
    <AuthContext.Provider value={{
      usuario,
      user: usuario,   // alias
      role,
      loading,
      pmeData,
      signOut,
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
