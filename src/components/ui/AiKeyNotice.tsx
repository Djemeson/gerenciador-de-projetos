import React from 'react'
import { KeyRound, Sparkles } from 'lucide-react'
import { useSettingsStore } from '../../stores/useSettingsStore'

/**
 * Aviso de que nenhuma chave de IA está configurada.
 *
 * Antes as chaves ficavam só no navegador, e este aviso existia para explicar por que o
 * celular caía no modo simplificado mesmo com tudo configurado no computador. **Isso mudou
 * em 30/07/2026**: as chaves passaram a sincronizar junto com a conta (DIRETRIZES, 13.8),
 * então o aviso só aparece quando não há chave em lugar nenhum — e a instrução agora é
 * "configure uma vez", não "configure de novo neste aparelho".
 */
export function AiKeyNotice({ compact = false }: { compact?: boolean }) {
  const { openAIKey, geminiApiKey, openSettings } = useSettingsStore()
  if (openAIKey || geminiApiKey) return null

  if (compact) {
    return (
      <button onClick={openSettings}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-50 border border-warning-100 text-left hover:border-warning-500/40 transition-colors">
        <KeyRound size={14} className="text-warning-700 flex-shrink-0"/>
        <span className="text-[11px] text-warning-700 leading-snug flex-1">
          Sem chave de IA configurada — usando o <strong className="font-bold">modo simplificado</strong>.
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-xl bg-warning-50 border border-warning-100 p-3.5">
      <div className="flex items-start gap-2.5">
        <Sparkles size={16} className="text-warning-700 flex-shrink-0 mt-0.5"/>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-warning-700">Nenhuma chave de IA configurada</p>
          <p className="text-[11px] text-gray-700 mt-1 leading-relaxed">
            Sem ela, os recursos de IA usam um modo local simplificado, sem chamada externa.
            Basta configurar uma vez: a chave passa a valer em todos os seus dispositivos.
          </p>
          <button onClick={openSettings}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-warning-100 rounded-lg text-[11px] font-bold text-warning-700 hover:border-warning-500/40 transition-colors">
            <KeyRound size={12}/> Configurar a chave
          </button>
        </div>
      </div>
    </div>
  )
}
