import { create } from 'zustand'
import { mesclarSettingsRemotas } from '../lib/settingsMerge'

export interface Settings {
  quickCaptureHotkey: string
  openAIKey: string
  geminiApiKey: string
}

const DEFAULTS: Settings = {
  quickCaptureHotkey: 'ctrl+space',
  openAIKey: '',
  geminiApiKey: '',
}

function load(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('tf_settings') ?? '{}') } }
  catch { return DEFAULTS }
}
function save(s: Settings) {
  localStorage.setItem('tf_settings', JSON.stringify({
    quickCaptureHotkey: s.quickCaptureHotkey, openAIKey: s.openAIKey, geminiApiKey: s.geminiApiKey,
  }))
}

/**
 * Como avisar a nuvem que a configuração mudou.
 *
 * É injetado por `useAppStore` em vez de importado daqui: aquele arquivo já importa este,
 * e o caminho de volta fecharia um ciclo de módulos. Enquanto ninguém registrar (testes,
 * modo local sem Firebase), a configuração simplesmente não sincroniza.
 */
let aoMudar: (() => void) | null = null
export function registrarObservadorDeSettings(fn: () => void) { aoMudar = fn }

export function lerSettings(): Settings {
  const s = useSettingsStore.getState()
  return { quickCaptureHotkey: s.quickCaptureHotkey, openAIKey: s.openAIKey, geminiApiKey: s.geminiApiKey }
}

interface SettingsState extends Settings {
  settingsOpen: boolean
  openSettings:  () => void
  closeSettings: () => void
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  /** Aplica o que veio da nuvem. Não dispara push — senão dois aparelhos ficam se
   *  respondendo em eco. */
  aplicarSettingsRemotas: (remoto: Partial<Settings>) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...load(),
  settingsOpen: false,
  openSettings:  () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  updateSetting: (key, value) => {
    const next = { ...get(), [key]: value }
    save({ quickCaptureHotkey: next.quickCaptureHotkey, openAIKey: next.openAIKey, geminiApiKey: next.geminiApiKey })
    set({ [key]: value })
    aoMudar?.()
  },
  aplicarSettingsRemotas: (remoto) => {
    const atual = get()
    const proximo = mesclarSettingsRemotas(
      { quickCaptureHotkey: atual.quickCaptureHotkey, openAIKey: atual.openAIKey, geminiApiKey: atual.geminiApiKey },
      remoto,
    )
    save(proximo)
    set(proximo)
  },
}))

// Converte string como 'ctrl+space' para verificação de evento
export function matchHotkey(hotkey: string, e: KeyboardEvent): boolean {
  const parts  = hotkey.toLowerCase().split('+')
  const key    = parts[parts.length - 1]
  const ctrl   = parts.includes('ctrl')
  const shift  = parts.includes('shift')
  const alt    = parts.includes('alt')
  const evKey  = e.key === ' ' ? 'space' : e.key.toLowerCase()
  return evKey === key && e.ctrlKey === ctrl && e.shiftKey === shift && e.altKey === alt
}
