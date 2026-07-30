import React, { useEffect, useState } from 'react'
import { CloudOff, RefreshCw, Check } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { useSettingsStore } from '../stores/useSettingsStore'

/**
 * Aviso de falha de sincronização.
 *
 * O estado `cloudSyncStatus` existia desde o início, mas só era exibido **dentro do modal
 * de Configurações** — ou seja, se a nuvem parasse de responder, nada na tela dizia isso e
 * a pessoa seguia trabalhando achando que estava salvo em todo lugar.
 *
 * A regra aqui é não incomodar quando está tudo bem: em `synced` o indicador aparece por
 * poucos segundos e desaparece; em `error` fica, porque é informação que muda decisão.
 */
export function SyncIndicator() {
  const status = useAppStore(s => s.cloudSyncStatus)
  const push   = useAppStore(s => s.pushToCloud)
  const openSettings = useSettingsStore(s => s.openSettings)
  const [mostrarOk, setMostrarOk] = useState(false)

  useEffect(() => {
    if (status !== 'synced') return
    setMostrarOk(true)
    const t = setTimeout(() => setMostrarOk(false), 2500)
    return () => clearTimeout(t)
  }, [status])

  if (status === 'idle') return null
  if (status === 'synced' && !mostrarOk) return null

  const base = 'fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-40 flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg text-[11.5px] font-semibold animate-slide-in'

  if (status === 'error') {
    return (
      <div className={`${base} bg-danger-50 border-danger-100 text-danger-700`} role="status">
        <CloudOff size={14} className="flex-shrink-0" />
        <span>Sem sincronizar com a nuvem</span>
        <button onClick={() => push()} className="underline hover:no-underline">Tentar de novo</button>
        <span className="text-danger-600/50">·</span>
        <button onClick={openSettings} className="underline hover:no-underline">Detalhes</button>
      </div>
    )
  }

  if (status === 'syncing') {
    return (
      <div className={`${base} bg-white border-gray-200 text-gray-600`} role="status">
        <RefreshCw size={14} className="animate-spin flex-shrink-0 text-brand-500" />
        <span>Sincronizando…</span>
      </div>
    )
  }

  return (
    <div className={`${base} bg-white border-gray-200 text-gray-600`} role="status">
      <Check size={14} className="flex-shrink-0 text-success-600" />
      <span>Salvo na nuvem</span>
    </div>
  )
}
