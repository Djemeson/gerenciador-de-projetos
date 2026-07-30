import React from 'react'
import { KeyRound, Smartphone } from 'lucide-react'
import { useSettingsStore } from '../../stores/useSettingsStore'

/**
 * Aviso de que este dispositivo não tem chave de IA.
 *
 * As chaves de API ficam **só no navegador** — de propósito: elas não entram no documento
 * de sincronização, porque guardar credencial na nuvem é risco desnecessário para um app
 * pessoal. O efeito colateral é que, ao abrir no celular, os recursos de IA caíam no modo
 * simplificado **em silêncio**, e parecia defeito. Este aviso explica o que está
 * acontecendo e o que fazer, e é o único lugar do app que dá essa explicação.
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
          Sem chave de IA <strong className="font-bold">neste dispositivo</strong> — usando o modo simplificado.
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-xl bg-warning-50 border border-warning-100 p-3.5">
      <div className="flex items-start gap-2.5">
        <Smartphone size={16} className="text-warning-700 flex-shrink-0 mt-0.5"/>
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-warning-700">Este dispositivo não tem chave de IA</p>
          <p className="text-[11px] text-gray-700 mt-1 leading-relaxed">
            As chaves ficam guardadas só no navegador e não sincronizam entre dispositivos —
            é o que evita mandar credencial para a nuvem. Sem ela, os recursos de IA usam um
            modo local simplificado, sem chamada externa.
          </p>
          <button onClick={openSettings}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-warning-100 rounded-lg text-[11px] font-bold text-warning-700 hover:border-warning-500/40 transition-colors">
            <KeyRound size={12}/> Configurar a chave aqui
          </button>
        </div>
      </div>
    </div>
  )
}
