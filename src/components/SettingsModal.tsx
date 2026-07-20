import React, { useState } from 'react'
import { Modal } from './ui/Modal'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useAppStore } from '../stores/useAppStore'
import { RefreshCw, Copy, Check, Link, AlertCircle, Wifi, Smartphone, Sparkles, Eye, EyeOff } from 'lucide-react'

export function SettingsModal() {
  const { settingsOpen, closeSettings, quickCaptureHotkey, updateSetting, openAIKey, geminiApiKey } = useSettingsStore()
  const {
    syncCode, syncStatus, lastSyncedAt, isSyncActive,
    generateSyncCode, activateSync, disableSync, pullStateFromServer
  } = useAppStore()

  const [capturing, setCapturing] = useState(false)
  const [hotkey, setHotkey] = useState(quickCaptureHotkey)

  // IA keys UI
  const [openAIDraft, setOpenAIDraft] = useState(openAIKey)
  const [geminiDraft, setGeminiDraft] = useState(geminiApiKey)
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)

  // Sync state UI
  const [inputCode, setInputCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showConfirmLink, setShowConfirmLink] = useState(false)

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

  const handleGenerate = async () => {
    try {
      setErrorMessage('')
      await generateSyncCode()
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar código.')
    }
  }

  const handleLinkDevice = () => {
    if (!inputCode.trim()) {
      setErrorMessage('Digite um código válido.')
      return
    }
    setErrorMessage('')
    setShowConfirmLink(true)
  }

  const handleConfirmLink = async (forceUpload: boolean) => {
    try {
      setErrorMessage('')
      const success = await activateSync(inputCode, forceUpload)
      if (success) {
        setShowConfirmLink(false)
        setInputCode('')
      } else {
        setErrorMessage('Código inválido ou erro ao conectar.')
      }
    } catch (err: any) {
      setErrorMessage('Erro na sincronização.')
    }
  }

  const handleCopy = () => {
    if (syncCode) {
      navigator.clipboard.writeText(syncCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Modal open={settingsOpen} onClose={closeSettings} title="Configurações">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
        
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
            Chaves usadas por "Pergunte à IA", os Insights de tarefas e a criação de projetos por IA. Ficam salvas somente neste navegador.
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
                    {showOpenAIKey ? <EyeOff size={13}/> : <Eye size={13}/>}
                  </button>
                </div>
                {openAIKey && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0"><Check size={11}/> Ativa</span>}
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
                    {showGeminiKey ? <EyeOff size={13}/> : <Eye size={13}/>}
                  </button>
                </div>
                {geminiApiKey && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0"><Check size={11}/> Ativa</span>}
              </div>
            </div>
          </div>

          {!openAIKey && !geminiApiKey && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100 mt-3">
              <AlertCircle size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-[10.5px] text-gray-500 leading-relaxed">
                Sem chave configurada, os recursos de IA usam um modo local simplificado (sem chamada externa) em vez de um modelo real.
              </p>
            </div>
          )}
        </div>

        {/* Sync Settings */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            Sincronização entre Dispositivos
          </label>
          <p className="text-[11px] text-gray-400 mb-4">
            Mantenha suas tarefas, projetos, espaços e automações sincronizados em tempo real entre o computador, celular ou outros navegadores.
          </p>

          {isSyncActive && syncCode ? (
            /* Active Sync View */
            <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Wifi className="text-emerald-600" size={18} />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">Sincronização Ativa</h4>
                    <p className="text-[10px] text-emerald-600">Dispositivo vinculado com sucesso</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-100/60 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {syncStatus === 'syncing' ? (
                    <>
                      <RefreshCw size={10} className="animate-spin" />
                      <span>Sincronizando...</span>
                    </>
                  ) : (
                    <span>Conectado</span>
                  )}
                </div>
              </div>

              {/* Sync Code display */}
              <div className="bg-white border border-emerald-200/50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 block font-medium">Código de Sincronização</span>
                  <span className="text-lg font-mono font-bold text-gray-800 tracking-wider">{syncCode}</span>
                </div>
                <button 
                  onClick={handleCopy}
                  className="p-2 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors text-gray-500 hover:text-gray-700"
                  title="Copiar código"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>

              {/* Sync stats & controls */}
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                <span>Última sincronização: <strong className="text-gray-700 font-semibold">{lastSyncedAt || 'agora mesmo'}</strong></span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => pullStateFromServer()}
                    disabled={syncStatus === 'syncing'}
                    className="flex items-center gap-1 text-brand-600 hover:text-brand-700 disabled:text-gray-400 font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw size={11} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                    <span>Sincronizar</span>
                  </button>
                  <span className="text-gray-300">|</span>
                  <button 
                    onClick={disableSync}
                    className="text-red-500 hover:text-red-600 font-semibold transition-colors cursor-pointer"
                  >
                    Desconectar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Inactive Sync View */
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-1 gap-3">

                {/* Generate New Code */}
                <div className="border border-gray-200/60 bg-white rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Smartphone size={14} className="text-brand-500" />
                      Novo por aqui?
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Gere um código exclusivo para sincronizar este dispositivo atual para a nuvem.
                    </p>
                  </div>
                  <button 
                    onClick={handleGenerate}
                    disabled={syncStatus === 'syncing'}
                    className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] transition-all text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    {syncStatus === 'syncing' ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Wifi size={12} />
                    )}
                    <span>Gerar Novo Código</span>
                  </button>
                </div>

                {/* Link Existing Code */}
                <div className="border border-gray-200/60 bg-white rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Link size={14} className="text-indigo-500" />
                      Vincular dispositivo
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Insira o código de sincronização de outro dispositivo para conectar.
                    </p>
                  </div>
                  
                  <div className="flex gap-1.5">
                    <input 
                      type="text" 
                      placeholder="Ex: TF-A1B2C3" 
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      className="flex-1 min-w-0 px-2.5 py-1 text-xs border rounded-lg uppercase tracking-wider font-mono outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <button 
                      onClick={handleLinkDevice}
                      className="px-3 py-1 bg-gray-900 hover:bg-black text-white text-[11px] font-bold rounded-lg cursor-pointer active:scale-[0.98] transition-all shadow-xs"
                    >
                      Conectar
                    </button>
                  </div>
                </div>

              </div>

              {/* Confirmation screen for link */}
              {showConfirmLink && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex gap-2">
                    <AlertCircle size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-[11px] font-bold text-indigo-900">Como você deseja sincronizar os dados?</h5>
                      <p className="text-[10px] text-indigo-700 mt-0.5">
                        Você está vinculando o código <strong className="font-semibold font-mono">{inputCode}</strong>. Escolha como mesclar as informações deste navegador:
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button 
                      onClick={() => handleConfirmLink(false)}
                      className="py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 text-[10px] font-bold rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center p-2 text-center"
                    >
                      <span>Baixar da nuvem</span>
                      <span className="text-[8px] font-normal text-indigo-500 mt-0.5">Substitui dados locais</span>
                    </button>
                    <button 
                      onClick={() => handleConfirmLink(true)}
                      className="py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all flex flex-col items-center justify-center p-2 text-center shadow-xs"
                    >
                      <span>Enviar dados locais</span>
                      <span className="text-[8px] font-normal text-indigo-200 mt-0.5">Substitui dados da nuvem</span>
                    </button>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button 
                      onClick={() => setShowConfirmLink(false)}
                      className="text-[9px] font-bold text-gray-500 hover:text-gray-700 font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Error indicator */}
              {errorMessage && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 text-red-700 text-[10px] px-3 py-2 rounded-lg">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </Modal>
  )
}
