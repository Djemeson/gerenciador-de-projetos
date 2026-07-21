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
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
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
}

// Login anônimo e silencioso — só serve para satisfazer as regras de segurança do
// Firestore (request.auth != null). Não há tela nem conta visível: quem "identifica"
// o dono dos dados é o código de sincronização (ver cloudAttachments.ts/useAppStore.ts),
// não esse uid anônimo, que é só o "crachá" técnico exigido pelo Firestore.
export function ensureSignedIn() {
  if (!auth) return Promise.resolve(null)
  return signInAnonymously(auth)
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
