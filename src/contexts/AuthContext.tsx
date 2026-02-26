// ============================================================
// INÍCIO: src/contexts/AuthContext.tsx
// Versão: 1.1.0 | Correção: export AuthContext + AuthContextType
// ============================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

// Exportado para uso no useAuth
export interface AuthContextType {
  usuario: User | null;
  role: 'pme' | 'consumidor' | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

// Exportado para uso no useAuth
export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [role, setRole] = useState<'pme' | 'consumidor' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario(user);
        // Tenta obter role do custom claim primeiro
        const idTokenResult = await user.getIdTokenResult();
        const claimRole = idTokenResult.claims.role as 'pme' | 'consumidor' | undefined;

        if (claimRole) {
          setRole(claimRole);
        } else {
          // Fallback: verifica no Firestore qual collection o usuário pertence
          const pmeSnap = await getDoc(doc(db, 'pmes', user.uid));
          setRole(pmeSnap.exists() ? 'pme' : 'consumidor');
        }
      } else {
        setUsuario(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUsuario(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook de conveniência — pode ser usado diretamente
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};

export default AuthProvider;

// ============================================================
// FIM: src/contexts/AuthContext.tsx
// ============================================================
