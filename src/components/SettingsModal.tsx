import React, { useState } from 'react'
import { Modal } from './ui/Modal'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { RefreshCw, Check, AlertCircle, Wifi, LogOut, Sparkles, Eye, EyeOff, User as UserIcon, Smartphone, Settings } from 'lucide-react'
import { InstallAppCard } from './InstallAppCard'

export function SettingsModal() {
  const { settingsOpen, closeSettings, quickCaptureHotkey, updateSetting, openAIKey, geminiApiKey } = useSettingsStore()
  const { cloudSyncStatus, lastSyncedAt, pushToCloud } = useAppStore()
  const { user, signOut } = useAuthStore()

  const [capturing, setCapturing] = useState(false)
  const [hotkey, setHotkey] = useState(quickCaptureHotkey)

  // IA keys UI
  const [openAIDraft, setOpenAIDraft] = useState(openAIKey)
  const [geminiDraft, setGeminiDraft] = useState(geminiApiKey)
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)

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
    <Modal open={settingsOpen} onClose={closeSettings} title="Configurações"
      icon={Settings}
      subtitle="Aplicativo, atalhos, IA e a conta que sincroniza tudo.">
      <div className="space-y-6">

        {/* Aplicativo */}
        <div className="border-b border-gray-100 pb-5">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Smartphone size={12} className="text-brand-500"/> Aplicativo
          </label>
          <p className="text-[11px] text-gray-400 mb-3">
            Instalado, o app abre direto do ícone e continua funcionando sem internet — com os
            dados já baixados neste dispositivo.
          </p>
          <InstallAppCard />
        </div>

        {/* Hotkey Config */}
        <div className="border-b border-gray-100 pb-5">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Atalho — Captura rápida</label>
          <p className="text-[11px] text-gray-400 mb-3">Pressione a combinação de teclas desejada para abrir a captura rápida de qualquer lugar do app.</p>

          {capturing ? (
            <input
              autoFocus
              onKeyDown={captureKey}
              onBlur={() => setCapturing(false)}
              placeholder="Pressione a combinação..."
              className="w-full text-sm px-3 py-2.5 border-2 border-brand-400 rounded-lg outline-none text-center text-gray-700 bg-brand-50/50"
              readOnly
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-mono">
                {hotkey}
              </span>
              <button onClick={() => setCapturing(true)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors font-medium">
                Alterar
              </button>
              <button onClick={() => { setHotkey('ctrl+space'); updateSetting('quickCaptureHotkey','ctrl+space') }}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors font-medium">
                Padrão
              </button>
            </div>
          )}
          
          <div className="text-[10px] text-gray-400 mt-2 font-mono">
            Exemplos: ctrl+space, ctrl+k, ctrl+shift+n
          </div>
        </div>

        {/* IA — chaves de API */}
        <div className="border-b border-gray-100 pb-5">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles size={12} className="text-brand-500"/> Inteligência Artificial
          </label>
          <p className="text-[11px] text-gray-400 mb-3">
            Chaves usadas por "Pergunte à IA" e pela criação de projetos por IA. Salvas aqui,
            valem também no celular — elas sincronizam junto com o resto da sua conta.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1">OpenAI API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showOpenAIKey ? 'text' : 'password'}
                    value={openAIDraft} onChange={e => setOpenAIDraft(e.target.value)}
                    onBlur={() => updateSetting('openAIKey', openAIDraft.trim())}
                    onKeyDown={e => e.key==='Enter' && (e.target as HTMLInputElement).blur()}
                    placeholder="sk-..."
                    className="w-full text-xs px-3 py-2 pr-8 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 font-mono"
                  />
                  <button type="button" onClick={() => setShowOpenAIKey(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showOpenAIKey ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
                {openAIKey && <span className="text-[10px] font-bold text-success-600 bg-success-50 border border-success-100 px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0"><Check size={12}/> Ativa</span>}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1">Google Gemini API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiDraft} onChange={e => setGeminiDraft(e.target.value)}
                    onBlur={() => updateSetting('geminiApiKey', geminiDraft.trim())}
                    onKeyDown={e => e.key==='Enter' && (e.target as HTMLInputElement).blur()}
                    placeholder="AIza..."
                    className="w-full text-xs px-3 py-2 pr-8 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 font-mono"
                  />
                  <button type="button" onClick={() => setShowGeminiKey(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showGeminiKey ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
                {geminiApiKey && <span className="text-[10px] font-bold text-success-600 bg-success-50 border border-success-100 px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0"><Check size={12}/> Ativa</span>}
              </div>
            </div>
          </div>

          {!openAIKey && !geminiApiKey && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100 mt-3">
              <AlertCircle size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Sem chave configurada, os recursos de IA usam um modo local simplificado (sem chamada externa) em vez de um modelo real.
              </p>
            </div>
          )}
        </div>

        {/* Conta e sincronização */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            Conta e sincronização
          </label>
          <p className="text-[11px] text-gray-400 mb-4">
            Seus dados ficam vinculados à conta Google abaixo. Entrando com ela em outro
            dispositivo — celular, tablet ou outro navegador — tudo aparece sincronizado em tempo real.
          </p>

          {/* Conta Google */}
          <div className="border border-gray-200/60 bg-white rounded-xl p-3.5 flex items-center gap-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full flex-shrink-0 object-cover border border-gray-200" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-200 to-brand-400 text-brand-800 flex items-center justify-center flex-shrink-0">
                <UserIcon size={16} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-gray-800 truncate">{user?.displayName || 'Conta Google'}</div>
              <div className="text-[11px] text-gray-400 truncate">{user?.email || '—'}</div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <LogOut size={12} /> Sair
            </button>
          </div>

          {/* Status da nuvem */}
          <div className="bg-success-50/40 border border-success-100 rounded-xl p-4 mt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Wifi className="text-success-600" size={18} />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-success-500 rounded-full animate-ping"></span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-success-700">Sincronização ativa</h4>
                  <p className="text-[10px] text-success-600">Este dispositivo está conectado à nuvem</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-success-100/60 text-success-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {cloudSyncStatus === 'syncing' ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Sincronizando...</span>
                  </>
                ) : cloudSyncStatus === 'error' ? (
                  <span className="text-danger-600">Erro ao sincronizar</span>
                ) : (
                  <span>Conectado</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-3 mt-3 border-t border-success-100/70">
              <span>Última sincronização: <strong className="text-gray-700 font-semibold">{lastSyncedAt || 'agora mesmo'}</strong></span>
              <button
                onClick={() => pushToCloud()}
                disabled={cloudSyncStatus === 'syncing'}
                className="flex items-center gap-1 text-brand-600 hover:text-brand-700 disabled:text-gray-400 font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw size={12} className={cloudSyncStatus === 'syncing' ? 'animate-spin' : ''} />
                <span>Sincronizar agora</span>
              </button>
            </div>
          </div>
        </div>


      </div>
    </Modal>
  )
}
