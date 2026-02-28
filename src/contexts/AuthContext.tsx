// ============================================================
// INÍCIO: src/contexts/AuthContext.tsx
// Versão: 1.7.0 | Data: 2026-02-27
// Fix v1.7: carregarPME com try/catch próprio — nunca trava o loading
//           Timeout de segurança global de 6s
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
  geo?: { latitude: number; longitude: number };
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

  const carregarPME = async (uid: string): Promise<boolean> => {
    try {
      const snap = await getDoc(doc(db, 'pmes', uid));
      if (snap.exists()) {
        const raw = snap.data() as PMEData;
        // Normaliza GeoPoint do Firestore para { latitude, longitude }
        const geo = raw.geo as any;
        if (geo) {
          raw.geo = {
            latitude: geo.latitude ?? geo._lat ?? geo.lat ?? -23.5505,
            longitude: geo.longitude ?? geo._long ?? geo.lng ?? -46.6333,
          } as any;
        }
        setPmeData(raw);
        setRole('pme');
        return true;
      }
      return false;
    } catch (err) {
      console.warn('carregarPME falhou silenciosamente:', err);
      return false;
    }
  };

  const refreshRole = async () => {
    try {
      if (!auth.currentUser) return;
      const idTokenResult = await getIdTokenResult(auth.currentUser, true);
      const claimRole = idTokenResult.claims.role as 'pme' | 'consumidor' | undefined;
      if (claimRole === 'pme') {
        await carregarPME(auth.currentUser.uid);
        setRole('pme');
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
      const seguranca = setTimeout(() => {
        console.warn('AuthContext: timeout de segurança atingido');
        setLoading(false);
      }, 6000);

      try {
        if (user) {
          setUsuario(user);
          const idTokenResult = await getIdTokenResult(user, true);
          const claimRole = idTokenResult.claims.role as 'pme' | 'consumidor' | undefined;

          if (claimRole === 'pme') {
            await carregarPME(user.uid);
            setRole('pme');
            clearTimeout(seguranca);
            setLoading(false);
          } else if (claimRole === 'consumidor') {
            setRole('consumidor');
            setPmeData(null);
            clearTimeout(seguranca);
            setLoading(false);
          } else {
            const temPME = await carregarPME(user.uid);
            if (temPME) {
              clearTimeout(seguranca);
              setLoading(false);
            } else {
              setTimeout(async () => {
                try {
                  const result = await getIdTokenResult(user, true);
                  const r = result.claims.role as 'pme' | 'consumidor' | undefined;
                  if (r === 'pme') {
                    await carregarPME(user.uid);
                    setRole('pme');
                  } else {
                    setRole(r ?? 'consumidor');
                  }
                } catch {
                  setRole('consumidor');
                } finally {
                  clearTimeout(seguranca);
                  setLoading(false);
                }
              }, 2500);
            }
          }
        } else {
          setUsuario(null);
          setRole(null);
          setPmeData(null);
          clearTimeout(seguranca);
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro no observador de Auth:', error);
        setRole('consumidor');
        clearTimeout(seguranca);
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
    <AuthContext.Provider value={{ usuario, user: usuario, role, loading, pmeData, signOut, refreshRole }}>
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
