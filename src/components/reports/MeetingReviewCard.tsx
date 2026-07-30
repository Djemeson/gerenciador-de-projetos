import React, { useState } from 'react'
import { Sparkles, Copy, Check, RefreshCw, Loader2 } from 'lucide-react'
import type { Task, Project } from '../../types'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { AiKeyNotice } from '../ui/AiKeyNotice'
import { generateMeetingReview, type MeetingReviewInput } from '../../lib/aiMeetingReview'

// Card "Resumo para a reunião" do Relatório: transforma o recorte atual do painel
// no texto que abre a reunião de resultados — pronto para copiar e colar.
// Híbrido (lib/aiMeetingReview): Gemini com chave, narrativa local sem.

export function MeetingReviewCard({ periodLabel, doneNow, donePrevCount, createdCount, overdue, urgentOpen, dueSoon, projects }: {
  periodLabel:   string
  doneNow:       Task[]
  donePrevCount: number
  createdCount:  number
  overdue:       Task[]
  urgentOpen:    Task[]
  dueSoon:       Task[]
  projects:      Pick<Project, 'id' | 'name'>[]
}) {
  const { geminiApiKey } = useSettingsStore()
  const [text,    setText]    = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)

  const gerar = async () => {
    setLoading(true)
    const input: MeetingReviewInput = { periodLabel, doneNow, donePrevCount, createdCount, overdue, urgentOpen, dueSoon, projects }
    try { setText(await generateMeetingReview(input, geminiApiKey)) }
    finally { setLoading(false) }
  }

  const copiar = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard indisponível — sem feedback */ }
  }

  return (
    <div className="bg-white border border-gray-200/70 rounded-xl px-5 py-4 print:break-inside-avoid">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="w-7 h-7 rounded-lg ai-gradient-bg text-white flex items-center justify-center flex-shrink-0">
          <Sparkles size={14}/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-900">Resumo para a reunião</p>
          <p className="text-[11px] text-gray-400">O recorte atual do relatório vira o texto de abertura da reunião de resultados.</p>
        </div>
        {text === null ? (
          <button onClick={gerar} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 ai-gradient-bg text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity flex-shrink-0 print:hidden">
            {loading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
            {loading ? 'Gerando…' : 'Gerar resumo'}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 flex-shrink-0 print:hidden">
            <button onClick={copiar}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                copied ? 'border-success-100 bg-success-50 text-success-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {copied ? <Check size={14}/> : <Copy size={14}/>}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button onClick={gerar} disabled={loading} title="Gerar de novo"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-60 transition-colors">
              {loading ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}
            </button>
          </div>
        )}
      </div>

      {text !== null && (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
          <p className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
      )}

      {text === null && !geminiApiKey && (
        <div className="mt-3 print:hidden"><AiKeyNotice compact/></div>
      )}
    </div>
  )
}
