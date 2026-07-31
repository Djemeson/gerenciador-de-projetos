import React, { useMemo, useState } from 'react'
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, Sparkles, Search, Copy, Pencil,
  History, CheckCircle2, MinusCircle, AlertTriangle, Play, Filter,
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { Select } from '../components/ui/Select'
import { AutomationEditor, type EditorDraft } from '../components/automations/AutomationEditor'
import { buildAutomation } from '../lib/aiAutomationBuilder'
import { ANY } from '../types'
import type { Automation, AutomationRun } from '../types'
import {
  RECIPES, TRIGGER_LABEL, describeAutomation, describeTrigger, describeAction, MUTATING_ACTIONS,
} from '../lib/automationEngine'

const TABS = [
  { id: 'regras',    label: 'Regras',    icon: Zap },
  { id: 'historico', label: 'Histórico', icon: History },
] as const
type TabId = typeof TABS[number]['id']

const RESULT_META: Record<AutomationRun['result'], { icon: React.ElementType; color: string; label: string }> = {
  ok:      { icon: CheckCircle2, color: '#1D9E75', label: 'Executada' },
  skipped: { icon: MinusCircle,  color: '#888780', label: 'Ignorada' },
  error:   { icon: AlertTriangle,color: '#E24B4A', label: 'Erro' },
}

const fmtWhen = (iso: string) => {
  const d = new Date(iso)
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const dia = new Date(d); dia.setHours(0,0,0,0)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (dia.getTime() === hoje.getTime()) return `hoje ${hora}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ${hora}`
}

export function AutomationsView() {
  const {
    automations: allAutomations, automationRuns, projects: allProjects, activeWorkspaceId,
    toggleAutomation, deleteAutomation, duplicateAutomation, clearAutomationRuns,
  } = useAppStore()

  const automations = useMemo(() => allAutomations.filter(a => a.workspaceId === activeWorkspaceId), [allAutomations, activeWorkspaceId])
  const projects    = useMemo(() => allProjects.filter(p => p.workspaceId === activeWorkspaceId), [allProjects, activeWorkspaceId])

  const [tab, setTab]       = useState<TabId>('regras')
  const [busca, setBusca]   = useState('')
  const [draft, setDraft]   = useState<EditorDraft | null>(null)
  const [projeto, setProjeto] = useState(ANY)

  // "Criar com IA": frase em português → rascunho no editor (nunca salva direto).
  const geminiApiKey = useSettingsStore(s => s.geminiApiKey)
  const [frase, setFrase]         = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [iaErro, setIaErro]       = useState<string | null>(null)

  const criarComIA = async () => {
    if (!frase.trim()) return
    setIaLoading(true); setIaErro(null)
    try {
      const guess = await buildAutomation(frase, projects.filter(p => !p.archived), geminiApiKey)
      if (guess) {
        setDraft({ name: guess.name, projectId: guess.projectId, trigger: guess.trigger, action: guess.action })
        setFrase('')
      } else {
        setIaErro(geminiApiKey
          ? 'Não consegui montar a regra — tente no formato "quando X, então Y" (ex.: "quando faltar 2 dias para o prazo, me avise").'
          : 'Não entendi a frase. Tente "quando X, então Y" — ou configure a chave Gemini nas Configurações para frases mais livres.')
      }
    } finally { setIaLoading(false) }
  }

  const visiveis = useMemo(() => automations.filter(a => {
    if (projeto !== ANY && a.projectId !== projeto && a.projectId !== ANY) return false
    if (!busca.trim()) return true
    const alvo = `${a.name} ${describeAutomation(a, projects)}`.toLowerCase()
    return alvo.includes(busca.trim().toLowerCase())
  }), [automations, busca, projeto, projects])

  // Estatísticas por regra saem do histórico — não há contador guardado na automação.
  const statsPorAutomacao = useMemo(() => {
    const mapa = new Map<string, { total: number; ultima?: string }>()
    automationRuns.forEach(r => {
      const atual = mapa.get(r.automationId) ?? { total: 0 }
      mapa.set(r.automationId, { total: atual.total + 1, ultima: atual.ultima ?? r.at })
    })
    return mapa
  }, [automationRuns])

  const ativas = automations.filter(a => a.enabled).length
  const runsRecentes = automationRuns.slice(0, 60)

  const novaDoZero = () => setDraft({
    name: '', projectId: ANY,
    trigger: { type: 'status_changed', from: ANY, to: 'done' },
    action:  { type: 'notify', value: 'Tarefa concluída' },
  })

  const usarReceita = (id: string) => {
    const r = RECIPES.find(x => x.id === id); if (!r) return
    setDraft({ name: r.name, projectId: ANY, trigger: { ...r.trigger }, action: { ...r.action } })
  }

  /** Regras que mexem no mesmo campo que as dispara — candidatas a disparo em cadeia. */
  const arriscadas = useMemo(() => new Set(
    automations.filter(a =>
      a.enabled && MUTATING_ACTIONS.includes(a.action.type) &&
      ((a.trigger.type === 'status_changed'   && a.action.type === 'change_status') ||
       (a.trigger.type === 'priority_changed' && a.action.type === 'change_priority') ||
       (a.trigger.type === 'assignee_changed' && a.action.type === 'assign'))
    ).map(a => a.id)
  ), [automations])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Cabeçalho ── */}
      <div className="px-6 py-3.5 border-b border-gray-200 bg-white space-y-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Zap size={16} className="text-gray-400" />
          <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900 flex-1">Automações</h1>
          <span className="text-[11px] text-gray-400 tabnum hidden sm:inline">
            {ativas} {ativas === 1 ? 'ativa' : 'ativas'} de {automations.length}
          </span>
          <button onClick={novaDoZero}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition-colors">
            <Plus size={14} /> Nova
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-gray-200 -mb-3.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold border-b-2 transition-colors ${
                tab === id ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              <Icon size={14} /> {label}
              {id === 'historico' && automationRuns.length > 0 && (
                <span className="text-[10px] text-gray-400 tabnum">{automationRuns.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {tab === 'regras' ? (
          <>
            {/* ── Criar com IA: a regra escrita em português vira rascunho no editor ── */}
            <div className="hero-card px-4 py-3.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-7 h-7 rounded-lg ai-gradient-bg text-white flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14}/>
                </div>
                <input
                  value={frase}
                  onChange={e => { setFrase(e.target.value); setIaErro(null) }}
                  onKeyDown={e => e.key === 'Enter' && criarComIA()}
                  placeholder={'Descreva a regra: "quando faltar 2 dias para o prazo, me avise"'}
                  className="flex-1 min-w-[220px] text-[13px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 bg-white"
                />
                <button onClick={criarComIA} disabled={iaLoading || !frase.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-2 ai-gradient-bg text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0">
                  {iaLoading ? 'Montando…' : 'Criar com IA'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                {iaErro
                  ? <span className="text-warning-600 font-medium">{iaErro}</span>
                  : 'A regra abre no editor para você revisar antes de salvar. Entende prazo, conclusão, prioridade, etiquetas, mover de projeto e mais.'}
              </p>
            </div>

            {/* ── Receitas ── */}
            {automations.length < 6 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Comece por uma receita</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {RECIPES.map(r => (
                    <button key={r.id} onClick={() => usarReceita(r.id)}
                      className="flex items-start gap-2.5 px-3.5 py-3 bg-white border border-gray-200/70 rounded-xl hover:border-brand-300 hover:bg-brand-50/30 transition-colors text-left group">
                      <Sparkles size={14} className="text-brand-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-gray-800">{r.name}</p>
                        <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{r.purpose}</p>
                      </div>
                      <span className="text-[10px] font-bold text-brand-600 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">Usar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Busca e filtro ── */}
            {automations.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar automação..."
                    className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
                </div>
                <Filter size={12} className="text-gray-400" />
                <Select value={projeto} onChange={setProjeto} ariaLabel="Projeto" searchable
                  options={[{ value: ANY, label: 'Todos os projetos' }, ...projects.filter(p => !p.archived).map(p => ({ value: p.id, label: p.name, color: p.color }))]} />
              </div>
            )}

            {/* ── Lista ── */}
            {automations.length === 0 ? (
              <div className="bg-white border border-gray-200/70 rounded-xl px-6 py-12 text-center">
                <div className="w-11 h-11 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-3">
                  <Zap size={18} className="text-brand-500" />
                </div>
                <p className="text-[13px] font-bold text-gray-800">Nenhuma automação ainda</p>
                <p className="text-[11px] text-gray-500 mt-1 max-w-[380px] mx-auto leading-relaxed">
                  Automação faz o trabalho repetitivo sozinha: mudar status, avisar sobre prazo,
                  etiquetar o que acabou de chegar. Escolha uma receita acima para começar.
                </p>
              </div>
            ) : visiveis.length === 0 ? (
              <p className="text-[12px] text-gray-400 text-center py-8">Nenhuma automação corresponde à busca.</p>
            ) : (
              <div className="space-y-2">
                {visiveis.map(a => (
                  <AutomationCard
                    key={a.id} automation={a} projects={projects}
                    stats={statsPorAutomacao.get(a.id)}
                    risky={arriscadas.has(a.id)}
                    onToggle={() => toggleAutomation(a.id)}
                    onEdit={() => setDraft({ id: a.id, name: a.name, projectId: a.projectId, trigger: { ...a.trigger }, action: { ...a.action } })}
                    onDuplicate={() => duplicateAutomation(a.id)}
                    onDelete={() => deleteAutomation(a.id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── Histórico ── */
          <div className="bg-white border border-gray-200/70 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <History size={14} className="text-gray-400" />
              <span className="text-[13px] font-bold text-gray-800 tracking-tight flex-1">Execuções recentes</span>
              {automationRuns.length > 0 && (
                <button onClick={clearAutomationRuns} className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                  Limpar
                </button>
              )}
            </div>
            {runsRecentes.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[12px] text-gray-500 font-medium">Nenhuma execução registrada.</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Assim que uma automação rodar, ela aparece aqui com o que mudou em cada tarefa.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {runsRecentes.map(r => {
                  const meta = RESULT_META[r.result]
                  const Icon = meta.icon
                  return (
                    <div key={r.id} className="flex items-start gap-3 px-4 py-2.5">
                      <Icon size={14} className="flex-shrink-0 mt-0.5" style={{ color: meta.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-gray-800 truncate">
                          <span className="font-semibold">{r.automationName}</span>
                          <span className="text-gray-400"> em </span>
                          {r.taskTitle}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{r.detail}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 tabnum">{fmtWhen(r.at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <AutomationEditor draft={draft} onClose={() => setDraft(null)} />
    </div>
  )
}

function AutomationCard({ automation: a, projects, stats, risky, onToggle, onEdit, onDuplicate, onDelete }: {
  automation: Automation
  projects: { id: string; name: string; color: string }[]
  stats?: { total: number; ultima?: string }
  risky: boolean
  onToggle: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void
}) {
  const escopo = a.projectId === ANY ? 'Todos os projetos' : projects.find(p => p.id === a.projectId)?.name ?? 'Projeto removido'

  return (
    <div className={`group bg-white border rounded-xl px-4 py-3 transition-all ${a.enabled ? 'border-gray-200/70' : 'border-gray-100 bg-gray-50/40'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${a.enabled ? 'bg-brand-50 text-brand-500' : 'bg-gray-100 text-gray-400'}`}>
          <Zap size={14} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-[13px] font-bold truncate ${a.enabled ? 'text-gray-800' : 'text-gray-500'}`}>{a.name}</p>
            {!a.enabled && <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex-shrink-0">pausada</span>}
          </div>

          {/* A regra em português — antes o card mostrava "Status alterado → Mudar status para done" */}
          <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
            Quando <span className="text-gray-700">{describeTrigger(a.trigger)}</span>,{' '}
            <span className="text-gray-700">{describeAction(a.action, projects as any)}</span>.
          </p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400">{escopo}</span>
            <span className="text-gray-200">·</span>
            <span className="text-[10px] text-gray-400">{TRIGGER_LABEL[a.trigger.type]}</span>
            {stats && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-[10px] text-gray-400 tabnum">
                  {stats.total}× {stats.ultima && `· última ${fmtWhen(stats.ultima)}`}
                </span>
              </>
            )}
            {risky && (
              <span className="text-[10px] font-bold text-[#D89A18] bg-[#D89A181F] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                title="Esta regra altera o mesmo campo que a dispara — o app interrompe a cadeia após 5 níveis">
                <AlertTriangle size={12} /> pode disparar em cadeia
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={onEdit} title="Editar"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
            <Pencil size={12} />
          </button>
          <button onClick={onDuplicate} title="Duplicar"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
            <Copy size={12} />
          </button>
          <button onClick={onDelete} title="Excluir"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#E24B4A] hover:bg-danger-50 md:opacity-0 md:group-hover:opacity-100 transition-all">
            <Trash2 size={12} />
          </button>
          <button onClick={onToggle} title={a.enabled ? 'Pausar' : 'Ativar'}
            className={`ml-0.5 transition-colors ${a.enabled ? 'text-brand-600 hover:text-brand-700' : 'text-gray-300 hover:text-gray-400'}`}>
            {a.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
        </div>
      </div>
    </div>
  )
}
