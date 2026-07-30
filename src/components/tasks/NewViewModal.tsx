import React, { useEffect, useMemo, useState } from 'react'
import {
  X, List, LayoutGrid, Table2, Calendar,
  CheckCircle2, CalendarClock, Flag, Sparkles,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { DatePeriodPicker } from '../ui/DatePeriodPicker'
import { VIEW_ICON, VIEW_ICON_KEYS } from '../../lib/viewIcons'
import { applyCustomViewFilter } from '../../lib/customViews'
import { Select, STATUS_OPTIONS, PRIORITY_OPTIONS } from '../ui/Select'
import { INBOX_PROJECT_ID } from '../../types'
import type { CustomProjectView, DateFieldKey, DateFilterValue, Priority, TaskStatus } from '../../types'

type BaseType = 'list' | 'board' | 'table' | 'calendar'
type StatusFilter = TaskStatus | 'all' | 'open'
type PriorityFilter = Priority | 'all'

const BASE_TYPES: { key: BaseType; label: string; Icon: React.ElementType }[] = [
  { key:'list',     label:'Lista',      Icon: List },
  { key:'board',    label:'Board',      Icon: LayoutGrid },
  { key:'table',    label:'Tabela',     Icon: Table2 },
  { key:'calendar', label:'Calendário', Icon: Calendar },
]

// Modelos prontos — um clique configura nome, ícone e filtros de uma vez.
interface Preset {
  key:   string
  title: string
  desc:  string
  Icon:  React.ElementType
  tint:  string
  conf: {
    name: string; icon: string; status: StatusFilter; priority: PriorityFilter
    dateField: DateFieldKey; datePeriod?: DateFilterValue
  }
}
const PRESETS: Preset[] = [
  {
    key:'done_period', title:'Concluídas no período', desc:'Resultados prontos para a reunião semanal',
    Icon: CheckCircle2, tint:'bg-success-50 text-success-600',
    conf:{ name:'Concluídas no período', icon:'check', status:'done', priority:'all',
           dateField:'completedAt', datePeriod:{ period:'this_week' } },
  },
  {
    key:'due_week', title:'Entregas da semana', desc:'Em aberto com prazo nesta semana',
    Icon: CalendarClock, tint:'bg-info-50 text-info-600',
    conf:{ name:'Entregas da semana', icon:'calendar', status:'open', priority:'all',
           dateField:'dueDate', datePeriod:{ period:'this_week' } },
  },
  {
    key:'urgent_open', title:'Urgentes em aberto', desc:'Prioridade urgente, ainda não concluídas',
    Icon: Flag, tint:'bg-danger-50 text-danger-600',
    conf:{ name:'Urgentes em aberto', icon:'flag', status:'open', priority:'urgent',
           dateField:'completedAt', datePeriod: undefined },
  },
  {
    key:'new_month', title:'Novas do mês', desc:'Tudo que foi criado este mês',
    Icon: Sparkles, tint:'bg-brand-50 text-brand-600',
    conf:{ name:'Novas do mês', icon:'zap', status:'all', priority:'all',
           dateField:'createdAt', datePeriod:{ period:'this_month' } },
  },
]

const SECTION = 'block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2'

/**
 * Modal "Nova visualização" — genérico por escopo (funciona em Projeto, Espaço, Pasta,
 * Minhas tarefas e Todas as tarefas). O escopo ativo vem de `newViewModal` (scopeKey) no store.
 *
 * Além de nome/ícone/tipo base, oferece modelos prontos (presets), filtros de status
 * (incluindo "Em aberto"), prioridade, responsável, tags e período — com uma prévia ao
 * vivo de quantas tarefas do escopo correspondem à configuração atual.
 */
export function NewViewModal() {
  const {
    newViewModal, closeNewViewModal, addCustomView,
    tasks, projects, activeWorkspaceId, getAllTags, getAllAssignees,
  } = useAppStore()

  const [name,           setName]           = useState('')
  const [nameTouched,    setNameTouched]    = useState(false)
  const [icon,           setIcon]           = useState<string>('list')
  const [baseType,       setBaseType]       = useState<BaseType>('list')
  const [filterStatus,   setFilterStatus]   = useState<StatusFilter>('all')
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterTags,     setFilterTags]     = useState<string[]>([])
  const [dateField,      setDateField]      = useState<DateFieldKey>('completedAt')
  const [datePeriod,     setDatePeriod]     = useState<DateFilterValue | undefined>(undefined)
  const [activePreset,   setActivePreset]   = useState<string | null>(null)

  // Tarefas do escopo ativo — espelha o que cada tela passa ao TaskPanel, para a
  // prévia ao vivo bater com o que a visualização vai mostrar de fato.
  const scopeTasks = useMemo(() => {
    const key = newViewModal
    if (!key) return []
    if (key.startsWith('project:')) {
      const id = key.slice('project:'.length)
      return tasks.filter(t => t.projectId === id)
    }
    if (key.startsWith('space:')) {
      const id = key.slice('space:'.length)
      const ids = new Set(projects.filter(p => p.spaceId === id && !p.archived).map(p => p.id))
      return tasks.filter(t => ids.has(t.projectId))
    }
    if (key.startsWith('folder:')) {
      const id = key.slice('folder:'.length)
      const ids = new Set(projects.filter(p => p.folderId === id && !p.archived).map(p => p.id))
      return tasks.filter(t => ids.has(t.projectId))
    }
    const ws = tasks.filter(t => t.workspaceId === activeWorkspaceId && t.projectId !== INBOX_PROJECT_ID)
    if (key === 'mytasks') return ws.filter(t => t.assignee === 'DJ')
    return ws
  }, [newViewModal, tasks, projects, activeWorkspaceId])

  const allTags      = useMemo(() => getAllTags(), [tasks, activeWorkspaceId])          // eslint-disable-line react-hooks/exhaustive-deps
  const allAssignees = useMemo(() => getAllAssignees(), [tasks, activeWorkspaceId])     // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilter =
    filterStatus !== 'all' || filterPriority !== 'all' ||
    filterAssignee !== 'all' || filterTags.length > 0 || !!datePeriod

  const previewView = useMemo<CustomProjectView>(() => ({
    id:'__draft', name:'', icon, baseType,
    filterStatus, filterPriority,
    filterAssignee: filterAssignee !== 'all' ? filterAssignee : undefined,
    filterTags:     filterTags.length ? filterTags : undefined,
    dateField:      datePeriod ? dateField : undefined,
    datePeriod,
  }), [icon, baseType, filterStatus, filterPriority, filterAssignee, filterTags, dateField, datePeriod])

  const matches = useMemo(
    () => applyCustomViewFilter(scopeTasks, previewView),
    [scopeTasks, previewView],
  )
  const pct = scopeTasks.length ? Math.round((matches.length / scopeTasks.length) * 100) : 0

  const reset = () => {
    setName(''); setNameTouched(false); setIcon('list'); setBaseType('list')
    setFilterStatus('all'); setFilterPriority('all'); setFilterAssignee('all'); setFilterTags([])
    setDateField('completedAt'); setDatePeriod(undefined); setActivePreset(null)
  }
  const close = () => { reset(); closeNewViewModal() }

  // Esc fecha o modal (o clique fora já fechava).
  useEffect(() => {
    if (!newViewModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [newViewModal])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!newViewModal) return null
  const scopeKey = newViewModal

  const applyPreset = (p: Preset) => {
    setActivePreset(p.key)
    if (!nameTouched || !name.trim()) setName(p.conf.name)
    setIcon(p.conf.icon); setBaseType('list')
    setFilterStatus(p.conf.status); setFilterPriority(p.conf.priority)
    setFilterAssignee('all'); setFilterTags([])
    setDateField(p.conf.dateField); setDatePeriod(p.conf.datePeriod)
  }
  // Qualquer ajuste manual "solta" o preset destacado (a configuração passou a ser própria).
  const manual = () => setActivePreset(null)

  const toggleTag = (tag: string) => {
    manual()
    setFilterTags(ts => ts.includes(tag) ? ts.filter(t => t !== tag) : [...ts, tag])
  }

  const save = () => {
    if (!name.trim()) return
    addCustomView(scopeKey, {
      name: name.trim(), icon, baseType,
      filterStatus:   filterStatus !== 'all' ? filterStatus : undefined,
      filterPriority: filterPriority !== 'all' ? filterPriority : undefined,
      filterAssignee: filterAssignee !== 'all' ? filterAssignee : undefined,
      filterTags:     filterTags.length ? filterTags : undefined,
      dateField:      datePeriod ? dateField : undefined,
      datePeriod,
    })
    close()
  }

  const HeaderIcon = VIEW_ICON[icon] ?? List

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-[3px] animate-overlay-in" onClick={close}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/80 w-[560px] max-w-[94vw] max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={e=>e.stopPropagation()}>

        {/* Cabeçalho */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-brand-600/30">
            <HeaderIcon size={18}/>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Nova visualização</h2>
            <p className="text-xs text-gray-400 mt-0.5">Uma visão filtrada e salva do seu trabalho — pronta em um clique.</p>
          </div>
          <button onClick={close} aria-label="Fechar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0">
            <X size={16}/>
          </button>
        </div>

        <div className="px-6">
          {/* Modelos prontos */}
          <label className={SECTION}>Comece com um modelo</label>
          <div className="grid grid-cols-2 gap-2 mb-1">
            {PRESETS.map(p => {
              const active = activePreset === p.key
              return (
                <button key={p.key} onClick={()=>applyPreset(p)}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    active ? 'border-brand-400 bg-brand-50/50 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:shadow-xs'}`}>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${p.tint}`}>
                    <p.Icon size={14}/>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-gray-800 truncate">{p.title}</span>
                    <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug">{p.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-gray-200/80"/>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">ou personalize do zero</span>
            <div className="h-px flex-1 bg-gray-200/80"/>
          </div>

          {/* Nome */}
          <input autoFocus value={name}
            onChange={e=>{ setName(e.target.value); setNameTouched(true) }}
            onKeyDown={e=>e.key==='Enter' && save()}
            placeholder="Nome da visualização (ex: Entrega semanal)"
            className="w-full text-sm px-3 py-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-brand-400 transition-all mb-4"/>

          {/* Ícone */}
          <div className="mb-4">
            <label className={SECTION}>Ícone</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {VIEW_ICON_KEYS.map(k => {
                const Icon = VIEW_ICON[k]
                const active = icon === k
                return (
                  <button key={k} onClick={()=>{ manual(); setIcon(k) }} title={k}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${
                      active ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
                    <Icon size={16} strokeWidth={2}/>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tipo base */}
          <div className="mb-4">
            <label className={SECTION}>Tipo base</label>
            <div className="grid grid-cols-4 gap-1.5">
              {BASE_TYPES.map(b=>(
                <button key={b.key} onClick={()=>{ manual(); setBaseType(b.key) }}
                  className={`flex flex-col items-center gap-1 py-2.5 text-xs rounded-xl border-2 transition-all ${
                    baseType===b.key ? 'border-brand-400 bg-brand-50 text-brand-700 font-semibold' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  <b.Icon size={16}/>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-4">
            <label className={SECTION}>Filtros</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] font-medium text-gray-500 mb-1">Status</span>
                <Select value={filterStatus} onChange={v=>{ manual(); setFilterStatus(v as StatusFilter) }} ariaLabel="Filtrar por status"
                  options={[{ value:'all', label:'Todos' }, { value:'open', label:'Em aberto' }, ...STATUS_OPTIONS]}/>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-gray-500 mb-1">Prioridade</span>
                <Select value={filterPriority} onChange={v=>{ manual(); setFilterPriority(v as PriorityFilter) }} ariaLabel="Filtrar por prioridade"
                  options={[{ value:'all', label:'Todas' }, ...PRIORITY_OPTIONS]}/>
              </div>
              {allAssignees.length > 0 && (
                <div className="col-span-2">
                  <span className="block text-[11px] font-medium text-gray-500 mb-1">Responsável</span>
                  <Select value={filterAssignee} onChange={v=>{ manual(); setFilterAssignee(v) }} ariaLabel="Filtrar por responsável"
                    searchable={allAssignees.length > 6}
                    options={[{ value:'all', label:'Todos' }, ...allAssignees.map(a => ({ value:a, label:a }))]}/>
                </div>
              )}
              {allTags.length > 0 && (
                <div className="col-span-2">
                  <span className="block text-[11px] font-medium text-gray-500 mb-1.5">Tags <span className="text-gray-300 font-normal">— qualquer uma delas</span></span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {allTags.map(tag => {
                      const active = filterTags.includes(tag)
                      return (
                        <button key={tag} onClick={()=>toggleTag(tag)}
                          className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${
                            active ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Período */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Período</label>
              {datePeriod && (
                <button onClick={()=>{ manual(); setDatePeriod(undefined) }}
                  className="text-[11px] text-gray-400 hover:text-danger-500 transition-colors">Limpar</button>
              )}
            </div>
            <DatePeriodPicker
              field={dateField}
              fieldOptions={['dueDate','completedAt','createdAt']}
              onFieldChange={f=>{ manual(); setDateField(f) }}
              value={datePeriod}
              onChange={v=>{ manual(); setDatePeriod(v) }}
            />
          </div>

          {/* Prévia ao vivo */}
          <div className="rounded-xl border border-gray-200/80 bg-gray-50/80 px-4 py-3 mb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Prévia ao vivo</span>
              {hasFilter && <span className="text-[11px] text-gray-400 tabnum">{pct}% do escopo</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-extrabold text-gray-900 tabnum leading-none">{matches.length}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-gray-500 mb-1">
                  {hasFilter
                    ? <>de {scopeTasks.length} tarefas correspondem hoje</>
                    : <>tarefas no escopo — adicione filtros para refinar</>}
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: (hasFilter ? pct : 100) + '%' }}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex gap-2">
          <button onClick={close} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={!name.trim()}
            className="flex-1 py-2.5 text-sm bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors font-semibold shadow-sm shadow-brand-600/30">
            Criar visualização
          </button>
        </div>
      </div>
    </div>
  )
}
