// ==========================================
// [ARQUIVO] firebase.ts v1.0
// [DATA] 2026-02-25
// [REQUER] .env secrets, package.json (firebase)
// ==========================================

// #region IMPORTS
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'
// #endregion IMPORTS

// #region CONFIG
// Valores injetados pelos GitHub Secrets no build
// NUNCA hardcodar aqui — sempre via VITE_ env vars
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}
// #endregion CONFIG

// #region INIT
// Evita inicializar múltiplas instâncias (React StrictMode chama 2x)
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0]
// #endregion INIT

// #region SERVICES — Exporta instâncias globais
export const auth      = getAuth(app)       // Autenticação
export const db        = getFirestore(app)  // Banco de dados
export const storage   = getStorage(app)    // Imagens
export const functions = getFunctions(app, 'us-central1') // Cloud Functions
export default app
// #endregion SERVICES
