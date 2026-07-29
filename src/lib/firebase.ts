import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  type User,
} from 'firebase/auth'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  // O handler de OAuth do Google vive em https://{authDomain}/__/auth/handler — se a
  // variável não estiver definida, cai no domínio padrão do projeto (que o Firebase
  // provisiona sozinho). Sem isso o login com Google falha com um erro obscuro.
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : undefined),
  projectId,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export const USE_FIREBASE = !!import.meta.env.VITE_FIREBASE_API_KEY

let db: ReturnType<typeof initializeFirestore> | null = null
let auth: ReturnType<typeof getAuth> | null = null

if (USE_FIREBASE) {
  const app = initializeApp(firebaseConfig)
  // ignoreUndefinedProperties: vários campos opcionais das tarefas (Task/TaskComment)
  // ficam `undefined` em vez de `null` — o Firestore rejeita `undefined` por padrão.
  db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  auth = getAuth(app)
  // Mantém a sessão entre recarregamentos/abas (no celular o app é reaberto o tempo todo).
  setPersistence(auth, browserLocalPersistence).catch(() => {})
}

/** Erro de login já traduzido — a mensagem vai direto pra tela, sem console. */
export class AuthError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}

function friendlyAuthError(e: any): AuthError {
  const code: string = e?.code ?? 'auth/unknown'
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  switch (code) {
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return new AuthError(code, 'O login com Google não está habilitado neste projeto do Firebase. Ative em Authentication → Sign-in method → Google.')
    case 'auth/unauthorized-domain':
      return new AuthError(code, `O domínio "${host}" não está autorizado no Firebase. Adicione em Authentication → Settings → Authorized domains.`)
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return new AuthError(code, 'Login cancelado.')
    case 'auth/network-request-failed':
      return new AuthError(code, 'Falha de rede ao falar com o Google. Verifique a conexão e tente de novo.')
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return new AuthError(code, 'A chave do Firebase (VITE_FIREBASE_API_KEY) está inválida ou faltando nesta build.')
    default:
      return new AuthError(code, e?.message ? `Não foi possível entrar (${code}).` : 'Não foi possível entrar com o Google.')
  }
}

/**
 * Login com Google. Tenta popup primeiro (funciona no desktop e na maioria dos
 * navegadores de celular); se o navegador bloquear ou não suportar popup, cai para
 * redirecionamento — cujo retorno é lido por `consumeRedirectResult` no carregamento.
 */
export async function signInWithGoogle() {
  if (!auth) throw new AuthError('auth/no-firebase', 'Firebase não configurado nesta build (veja .env.example).')
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    return await signInWithPopup(auth, provider)
  } catch (e: any) {
    const code = e?.code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider)
      return null
    }
    throw friendlyAuthError(e)
  }
}

/** Lê o resultado de um login por redirecionamento (nada acontece se não houve um). */
export async function consumeRedirectResult() {
  if (!auth) return null
  try {
    return await getRedirectResult(auth)
  } catch (e) {
    throw friendlyAuthError(e)
  }
}

export function signOutUser() {
  if (!auth) return Promise.resolve()
  return signOut(auth)
}

export function watchAuthState(cb: (user: User | null) => void) {
  if (!auth) { cb(null); return () => {} }
  return onAuthStateChanged(auth, cb)
}

export {
  db, auth,
  collection, doc, getDoc, setDoc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, Timestamp,
}
export type { DocumentData, User }
