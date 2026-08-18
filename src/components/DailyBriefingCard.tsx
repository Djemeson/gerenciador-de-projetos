import React, { useMemo, useState } from 'react'
import { Sunrise, Sparkles, X, Loader2, CalendarDays, AlertTriangle, Zap, Target } from 'lucide-react'
import type { Task } from '../types'
import { useAppStore } from '../stores/useAppStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { goalHealth } from '../lib/goalMetrics'
import { isoDate, parseISO } from '../lib/dateFilter'
import { generateDailyBriefing, type DailyBriefingInput } from '../lib/aiDailyBriefing'

// Card "Começar o dia" no topo de Minhas tarefas: radar do dia (vence hoje,
// atrasadas, urgentes, metas em risco) + plano do dia gerado sob demanda
// (híbrido, DIRETRIZES 13.3.2). Dispensável — some até o dia seguinte.

const HIDE_KEY = 'tf_briefing_hidden'

export function DailyBriefingCard({ tasks }: { tasks: Task[] }) {
  const { goals, tasks: allTasks, activeWorkspaceId } = useAppStore()
  const { geminiApiKey } = useSettingsStore()
  const hoje = isoDate(new Date())
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === hoje } catch { return false } })
  const [text,    setText]    = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const input = useMemo<DailyBriefingInput>(() => {
    const abertas = tasks.filter(t => t.status !== 'done' && !t.parentId)
    const now = new Date()
    const wsGoals = goals.filter(g => g.workspaceId === activeWorkspaceId)
    const wsTasks = allTasks.filter(t => t.workspaceId === activeWorkspaceId)
    return {
      dateLabel: now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }),
      dueToday:   abertas.filter(t => t.dueDate === hoje),
      overdue:    abertas.filter(t => t.dueDate && t.dueDate < hoje && parseISO(t.dueDate) < now),
      urgentOpen: abertas.filter(t => t.priority === 'urgent'),
      goalsAtRisk: wsGoals
        .map(g => ({ g, h: goalHealth(g, wsTasks, now) }))
        .filter(({ h }) => h.status === 'at_risk' || h.status === 'off_track')
        .map(({ g, h }) => ({ name: g.name, reason: h.reason })),
    }
  }, [tasks, goals, allTasks, activeWorkspaceId, hoje])

  if (hidden) return null

  const dispensar = () => {
    try { localStorage.setItem(HIDE_KEY, hoje) } catch { /* sem localStorage — só esconde na sessão */ }
    setHidden(true)
  }

  const gerar = async () => {
    setLoading(true)
    try { setText(await generateDailyBriefing(input, geminiApiKey)) }
    finally { setLoading(false) }
  }

  const chips: { icon: React.ElementType; label: string; tone: string }[] = []
  if (input.dueToday.length)    chips.push({ icon: CalendarDays,  label: `${input.dueToday.length} vence${input.dueToday.length > 1 ? 'm' : ''} hoje`, tone: 'bg-info-50 text-info-700 border-info-100' })
  if (input.overdue.length)     chips.push({ icon: AlertTriangle, label: `${input.overdue.length} em atraso`, tone: 'bg-danger-50 text-danger-700 border-danger-100' })
  if (input.urgentOpen.length)  chips.push({ icon: Zap,           label: `${input.urgentOpen.length} urgente${input.urgentOpen.length > 1 ? 's' : ''}`, tone: 'bg-warning-50 text-warning-700 border-warning-100' })
  if (input.goalsAtRisk.length) chips.push({ icon: Target,        label: `${input.goalsAtRisk.length} meta${input.goalsAtRisk.length > 1 ? 's' : ''} em risco`, tone: 'bg-warning-50 text-warning-700 border-warning-100' })

  return (
    <div className="mx-6 mt-2 hero-card px-5 py-2 flex-shrink-0">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-brand-600/30">
          <Sunrise size={14}/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-900 capitalize">{input.dateLabel}</p>
          {chips.length === 0 && <p className="text-[11px] text-gray-500">Dia limpo — nada vence hoje, nada em atraso, nada urgente.</p>}
        </div>
        {text === null && (
          <button onClick={gerar} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 ai-gradient-bg text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity flex-shrink-0">
            {loading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
            {loading ? 'Gerando…' : 'Gerar plano do dia'}
          </button>
        )}
        <button onClick={dispensar} title="Dispensar por hoje" aria-label="Dispensar por hoje"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0">
          <X size={14}/>
        </button>
      </div>

      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {chips.map((c, i) => (
            <span key={i} className={`inline-flex items-center gap-1 text-[11px] font-medium border px-2 py-0.5 rounded-full ${c.tone}`}>
              <c.icon size={12}/>{c.label}
            </span>
          ))}
        </div>
      )}

      {text !== null && (
        <div className="mt-3 rounded-xl border border-brand-100/70 bg-white/70 px-4 py-3">
          <p className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
      )}
    </div>
  )
}
