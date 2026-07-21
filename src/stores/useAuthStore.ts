import { create } from 'zustand'
import { watchAuthState, ensureSignedIn, type User } from '../lib/firebase'

interface AuthState {
  user: User | null
  authLoading: boolean
  init: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  authLoading: true,

  init: () => {
    watchAuthState((user) => set({ user, authLoading: false }))
    ensureSignedIn().catch((e) => {
      console.error('Erro no login anônimo (sincronização na nuvem indisponível):', e)
      set({ authLoading: false })
    })
  },
}))
