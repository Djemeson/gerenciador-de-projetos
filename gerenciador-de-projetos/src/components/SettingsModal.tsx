import React, { useState } from 'react'
import { Modal } from './ui/Modal'
import { useSettingsStore } from '../stores/useSettingsStore'

export function SettingsModal() {
  const { settingsOpen, closeSettings, quickCaptureHotkey, updateSetting } = useSettingsStore()
  const [capturing,  setCapturing]  = useState(false)
  const [hotkey,     setHotkey]     = useState(quickCaptureHotkey)

  const captureKey = (e: React.KeyboardEvent) => {
    e.preventDefault()
    const parts: string[] = []
    if (e.ctrlKey)  parts.push('ctrl')
    if (e.shiftKey) parts.push('shift')
    if (e.altKey)   parts.push('alt')
    const k = e.key === ' ' ? 'space' : e.key.toLowerCase()
    if (!['control','shift','alt','meta'].includes(k)) parts.push(k)
    if (parts.length > 1 || (parts.length === 1 && !['ctrl','shift','alt'].includes(parts[0]))) {
      const hk = parts.join('+')
      setHotkey(hk)
      updateSetting('quickCaptureHotkey', hk)
      setCapturing(false)
    }
  }

  return (
    <Modal open={settingsOpen} onClose={closeSettings} title="Configurações">
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Atalho — Captura rápida</label>
          <p className="text-[11px] text-gray-400 mb-2">Pressione a combinação de teclas desejada.</p>

          {capturing ? (
            <input
              autoFocus
              onKeyDown={captureKey}
              onBlur={() => setCapturing(false)}
              placeholder="Pressione a combinação..."
              className="w-full text-sm px-3 py-2 border-2 border-brand-400 rounded-lg outline-none text-center text-gray-700 bg-brand-50"
              readOnly
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-mono">
                {hotkey}
              </span>
              <button onClick={() => setCapturing(true)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                Alterar
              </button>
              <button onClick={() => { setHotkey('ctrl+space'); updateSetting('quickCaptureHotkey','ctrl+space') }}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
                Padrão
              </button>
            </div>
          )}
        </div>

        <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg p-3">
          Formatos válidos: <code className="font-mono">ctrl+space</code>, <code className="font-mono">ctrl+k</code>, <code className="font-mono">ctrl+shift+n</code>
        </div>
      </div>
    </Modal>
  )
}
