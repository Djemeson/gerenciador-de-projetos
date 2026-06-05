import { create } from 'zustand'

export interface Settings {
  quickCaptureHotkey: string
  openAIKey: string
}

const DEFAULTS: Settings = {
  quickCaptureHotkey: 'ctrl+space',
  openAIKey: '',
}

function load(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('tf_settings') ?? '{}') } }
  catch { return DEFAULTS }
}
function save(s: Settings) { localStorage.setItem('tf_settings', JSON.stringify(s)) }

interface SettingsState extends Settings {
  settingsOpen: boolean
  openSettings:  () => void
  closeSettings: () => void
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...load(),
  settingsOpen: false,
  openSettings:  () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  updateSetting: (key, value) => {
    const next = { ...get(), [key]: value }
    save({ quickCaptureHotkey: next.quickCaptureHotkey })
    set({ [key]: value })
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
