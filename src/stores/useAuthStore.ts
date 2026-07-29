import { create } from 'zustand'
import {
  watchAuthState, signInWithGoogle, signOutUser, consumeRedirectResult,
  USE_FIREBASE, type User,
} from '../lib/firebase'

interface AuthState {
  user: User | null
  /** true enquanto ainda não sabemos se há sessão salva — evita piscar a tela de login. */
  authLoading: boolean
  /** true entre clicar em "Entrar com Google" e o popup/redirect resolver. */
  signingIn: boolean
  authError: string | null
  init: () => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  authLoading: USE_FIREBASE,   // sem Firebase configurado o app roda local, sem login
  signingIn: false,
  authError: null,

  init: () => {
    if (!USE_FIREBASE) { set({ authLoading: false }); return }
    watchAuthState((user) => set({ user, authLoading: false, signingIn: false }))
    // Retorno do login por redirecionamento (celular/navegador que bloqueia popup).
    consumeRedirectResult().catch((e: any) => set({ authError: e?.message ?? 'Falha ao concluir o login.' }))
  },

  signIn: async () => {
    set({ signingIn: true, authError: null })
    try {
      await signInWithGoogle()
      // Se foi por redirecionamento, a página recarrega; o onAuthStateChanged fecha o resto.
    } catch (e: any) {
      set({ signingIn: false, authError: e?.message ?? 'Não foi possível entrar com o Google.' })
    }
  },

  signOut: async () => {
    await signOutUser()
    set({ user: null, authError: null })
  },

  clearError: () => set({ authError: null }),
}))
