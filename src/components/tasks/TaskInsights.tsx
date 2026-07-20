import React, { useState, useEffect } from 'react'
import { Sparkles, Loader2, AlertTriangle, Lightbulb, Check, Plus, RefreshCw, Key, ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { Task } from '../../types'

interface TaskInsightsProps {
  task: Task
}

interface InsightsData {
  riskLevel: string
  riskExplanation: string
  bottlenecks: string[]
  suggestedSubtasks: string[]
}

export function TaskInsights({ task }: TaskInsightsProps) {
  const { quickAddTask, getSubtasks } = useAppStore()
  const subtasks = getSubtasks(task.id)

  const cacheKey = `tf_insights_cache_${task.id}`
  
  const [insights, setInsights] = useState<InsightsData | null>(() => {
    try {
      const saved = localStorage.getItem(cacheKey)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addedSubtasks, setAddedSubtasks] = useState<Record<string, boolean>>({})

  // Reset added tracker when task changes
  useEffect(() => {
    setAddedSubtasks({})
    setError(null)
    try {
      const saved = localStorage.getItem(cacheKey)
      setInsights(saved ? JSON.parse(saved) : null)
    } catch {
      setInsights(null)
    }
  }, [task.id])

  const generateInsights = async () => {
    setLoading(true)
    setError(null)
    
    // Extract description text from blocks and task.description
    const descText = [
      task.description,
      ...task.blocks.filter(b => b.type === 'text' && b.text).map(b => b.text)
    ].filter(Boolean).join('\n').trim()

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: task.title,
          description: descText,
          dueDate: task.dueDate,
          priority: task.priority,
          status: task.status,
          checklists: task.checklists.map(cl => ({
            title: cl.title,
            items: cl.items.map(i => i.text)
          })),
          subtasks: subtasks.map(s => s.title)
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Erro do servidor (${res.status})`)
      }

      const data = await res.json()
      setInsights(data)
      localStorage.setItem(cacheKey, JSON.stringify(data))
    } catch (err: any) {
      console.error("Erro ao obter insights:", err)
      setError(err.message || "Não foi possível conectar ao servidor de IA.")
    } finally {
      setLoading(false)
    }
  }

  const handleAddSubtask = (title: string) => {
    if (!task.projectId) return
    // Add subtask with status 'todo' and parentId as task.id
    quickAddTask(title, task.projectId, 'todo', task.id)
    setAddedSubtasks(prev => ({ ...prev, [title]: true }))
  }

  const isSubtaskAlreadyAdded = (title: string) => {
    if (addedSubtasks[title]) return true
    return subtasks.some(s => s.title.toLowerCase().trim() === title.toLowerCase().trim())
  }

  const getRiskStyles = (level: string) => {
    const norm = level?.toLowerCase() || ''
    if (norm.includes('alto') || norm.includes('high')) {
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-700',
        badge: 'bg-rose-600 text-white',
        icon: AlertTriangle
      }
    }
    if (norm.includes('médio') || norm.includes('medio') || norm.includes('medium')) {
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-700',
        badge: 'bg-amber-500 text-white',
        icon: AlertCircle
      }
    }
    return {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      badge: 'bg-emerald-600 text-white',
      icon: CheckCircle2
    }
  }

  const riskStyles = insights ? getRiskStyles(insights.riskLevel) : null
  const RiskIcon = riskStyles ? riskStyles.icon : null

  return (
    <div className="border border-gray-100 rounded-2xl bg-slate-50/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-brand-600 animate-pulse" />
          <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Insights de IA</span>
        </div>
        {insights && !loading && (
          <button 
            onClick={generateInsights}
            className="text-gray-400 hover:text-brand-600 transition-colors p-1 rounded-lg hover:bg-white border border-transparent hover:border-gray-100 shadow-xs"
            title="Atualizar insights"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3 text-xs text-rose-700 space-y-2">
          <div className="flex items-start gap-1.5">
            <ShieldAlert size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="font-semibold leading-snug">{error}</p>
          </div>
          {error.includes("GEMINI_API_KEY") && (
            <div className="bg-white/80 rounded-lg p-2.5 border border-rose-200/50 text-gray-600 space-y-1.5">
              <p className="text-[10px] flex items-center gap-1 text-gray-700 font-bold">
                <Key size={10} className="text-amber-500" /> Como configurar:
              </p>
              <ol className="list-decimal list-inside text-[10px] space-y-1 pl-0.5 font-medium">
                <li>Abra o menu de <b>Configurações (Settings)</b> no canto esquerdo.</li>
                <li>Vá até a aba de <b>Secrets / API Keys</b>.</li>
                <li>Defina a chave <code className="bg-gray-100 px-1 py-0.5 rounded text-rose-600">GEMINI_API_KEY</code>.</li>
              </ol>
            </div>
          )}
          <button 
            onClick={generateInsights}
            className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 bg-white border border-gray-100 rounded-xl shadow-xs">
          <Loader2 size={24} className="text-brand-600 animate-spin" />
          <div className="space-y-1 px-4">
            <p className="text-xs font-bold text-gray-700">Analisando com a IA...</p>
            <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
              Verificando descrições, prazos e sugerindo sub-tarefas para evitar gargalos.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!insights && !loading && !error && (
        <div className="text-center py-6 px-4 bg-white border border-gray-100 rounded-xl shadow-xs space-y-3">
          <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center mx-auto">
            <Sparkles size={16} className="text-brand-600" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-gray-700">Insights Inteligentes</p>
            <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
              Obtenha sugestões de sub-tarefas e identifique gargalos de execução com base no escopo e no prazo desta tarefa.
            </p>
          </div>
          <button
            onClick={generateInsights}
            className="w-full py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={13} />
            <span>Gerar Insights de IA</span>
          </button>
        </div>
      )}

      {/* Insights Content */}
      {insights && !loading && !error && (
        <div className="space-y-4">
          {/* Delay Risk Indicator */}
          <div className={`border rounded-xl p-3 space-y-1.5 ${riskStyles?.bg}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Risco de Gargalo</span>
              <div className="flex items-center gap-1">
                {RiskIcon && <RiskIcon size={12} />}
                <span className="text-[10px] font-bold uppercase tracking-widest">{insights.riskLevel}</span>
              </div>
            </div>
            <p className="text-xs font-medium leading-relaxed opacity-95">
              {insights.riskExplanation}
            </p>
          </div>

          {/* Bottlenecks Identified */}
          {insights.bottlenecks && insights.bottlenecks.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={11} className="text-amber-500" /> Gargalos Potenciais
              </span>
              <div className="space-y-1">
                {insights.bottlenecks.map((b, i) => (
                  <div key={i} className="flex gap-2 items-start text-xs bg-white border border-gray-100 p-2 rounded-xl text-gray-600 shadow-2xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Subtasks */}
          {insights.suggestedSubtasks && insights.suggestedSubtasks.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Lightbulb size={11} className="text-yellow-500" /> Sub-tarefas Recomendadas
              </span>
              <div className="space-y-1.5">
                {insights.suggestedSubtasks.map((st, i) => {
                  const added = isSubtaskAlreadyAdded(st)
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 bg-white border border-gray-100 rounded-xl shadow-2xs transition-all hover:border-gray-200">
                      <span className="text-xs text-gray-700 font-medium flex-1 leading-snug">{st}</span>
                      <button
                        onClick={() => !added && handleAddSubtask(st)}
                        disabled={added}
                        className={`flex-shrink-0 p-1.5 rounded-lg transition-all border flex items-center justify-center cursor-pointer ${
                          added
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
                        }`}
                        title={added ? "Sub-tarefa adicionada" : "Adicionar sub-tarefa"}
                      >
                        {added ? <Check size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={2.5} />}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
