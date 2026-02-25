// ==========================================
// [ARQUIVO] AuthContext.tsx v1.0
// [DATA] 2026-02-25
// [REQUER] firebase.ts, consumidor.ts
// ==========================================

// #region IMPORTS
import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type User
} from 'firebase/auth'
import { auth } from '@/services/firebase'
import type { AuthUser, UserRole } from '@/types/consumidor'
// #endregion IMPORTS

// #region TYPES
interface AuthContextType {
  user: AuthUser | null        // Usuário logado ou null
  loading: boolean             // Aguardando resposta do Firebase
  role: UserRole               // 'pme' | 'consumidor' | null
  signInWithGoogle: () => Promise<void>
  signInWithPhone: (phone: string, recaptcha: RecaptchaVerifier) => Promise<any>
  logout: () => Promise<void>
  pendingOfertaId: string | null        // Late Auth — preserva oferta
  setPendingOfertaId: (id: string | null) => void
}
// #endregion TYPES

// #region CONTEXT
const AuthContext = createContext<AuthContextType | null>(null)
// #endregion CONTEXT

// #region PROVIDER
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]                     = useState<AuthUser | null>(null)
  const [loading, setLoading]               = useState(true)
  const [pendingOfertaId, setPendingOfertaId] = useState<string | null>(null)

  // #region LISTENER — Escuta mudanças de auth em tempo real
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        // Busca custom claims (role) do token
        const token = await firebaseUser.getIdTokenResult()
        const role = (token.claims.role as UserRole) || null

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || undefined,
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
          phoneNumber: firebaseUser.phoneNumber || undefined,
          role,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return unsubscribe // Limpa listener ao desmontar
  }, [])
  // #endregion LISTENER

  // #region GOOGLE AUTH
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error('[AuthContext] Google sign-in error:', error)
      throw error
    }
  }
  // #endregion GOOGLE AUTH

  // #region PHONE AUTH
  const signInWithPhone = async (phone: string, recaptcha: RecaptchaVerifier) => {
    try {
      return await signInWithPhoneNumber(auth, phone, recaptcha)
    } catch (error) {
      console.error('[AuthContext] Phone sign-in error:', error)
      throw error
    }
  }
  // #endregion PHONE AUTH

  // #region LOGOUT
  const logout = async () => {
    try {
      await signOut(auth)
      setPendingOfertaId(null)
    } catch (error) {
      console.error('[AuthContext] Logout error:', error)
      throw error
    }
  }
  // #endregion LOGOUT

  const value: AuthContextType = {
    user,
    loading,
    role: user?.role || null,
    signInWithGoogle,
    signInWithPhone,
    logout,
    pendingOfertaId,
    setPendingOfertaId,
  }

  // Não renderiza nada até saber se há usuário logado
  if (loading) return null

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
// #endregion PROVIDER

// #region HOOK
// useAuth() — use em qualquer componente para acessar auth
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
// #endregion HOOK
