import React, { useState, useMemo } from 'react'
import {
  Search, Eye, List, LayoutGrid, Table2, Calendar, PenTool, Activity, LayoutDashboard, Trash2, Check, Plus, X, Circle,
  ChevronDown,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { TaskList } from './TaskList'
import { TaskDetail } from './TaskDetail'
import { WhiteboardView } from './WhiteboardView'
import { FilterPanel } from '../FilterPanel'
import { AIPanel } from '../AIPanel'
import { applyCustomViewFilter } from '../../lib/customViews'
import { VIEW_ICON } from '../../lib/viewIcons'
import { Select, PRIORITY_OPTIONS, STATUS_OPTIONS } from '../ui/Select'
import { AssigneePicker } from '../ui/AssigneePicker'
import { DueDatePicker } from '../ui/DueDatePicker'
import type { Task, ColumnDef, ViewType, Priority, TaskStatus } from '../../types'
import { PRIORITY_LABEL, STATUS_LABEL, migrateViewType } from '../../types'

export type GroupBy = 'status' | 'priority' | 'dueDate' | 'assignee' | 'project'

const GROUP_LABEL: Record<GroupBy, string> = {
  status: 'Status', priority: 'Prioridade', dueDate: 'Prazo', assignee: 'Responsável', project: 'Projeto',
}

const ALL_VIEWS: { key: ViewType; label: string; Icon: React.ElementType }[] = [
  { key:'overview',   label:'Overview',      Icon: Eye },
  { key:'list',       label:'Tarefas',       Icon: List },
  { key:'board',      label:'Board',         Icon: LayoutGrid },
  { key:'table',      label:'Tabela',        Icon: Table2 },
  { key:'calendar',   label:'Calendário',    Icon: Calendar },
  { key:'whiteboard', label:'Quadro branco', Icon: PenTool },
  { key:'activity',   label:'Atividade',     Icon: Activity },
  { key:'dashboard',  label:'Painéis',       Icon: LayoutDashboard },
]

const vGet = (k: string, d: string) => { try { return localStorage.getItem('tf_v_'+k) || d } catch { return d } }
const vSet = (k: string, v: string) => { try { localStorage.setItem('tf_v_'+k, v) } catch {} }

export interface TaskPanelProps {
  scopeKey:          string
  tasks:             Task[]
  title:             string
  accent?:           string
  icon?:             React.ReactNode
  breadcrumb?:       React.ReactNode
  headerRight?:      React.ReactNode
  toolbarExtra?:     React.ReactNode
  columns?:          ColumnDef[]
  defaultProjectId?: string
  showProject?:      boolean
  groupOptions?:     GroupBy[]
  defaultGroup?:     GroupBy
  views?:            ViewType[]
  defaultView?:      ViewType
  gut?:              { score: number; g: number; u: number; t: number }
}

export function TaskPanel({
  scopeKey, tasks, title, accent = '#6366F1', icon, breadcrumb, headerRight, toolbarExtra,
  columns = [], defaultProjectId, showProject = false,
  groupOptions = ['status','priority','dueDate','assignee'],
  defaultGroup = 'status', views, defaultView = 'list', gut,
}: TaskPanelProps) {
  const { selectedTaskId, getCustomViews, deleteCustomView, openNewViewModal } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const tabs = (views ? ALL_VIEWS.filter(v => views.includes(v.key)) : ALL_VIEWS)

  const [view,  setView]  = useState<ViewType>(() => migrateViewType(vGet(scopeKey+'_view', defaultView)))
  const [group, setGroup] = useState<GroupBy>(() => vGet(scopeKey+'_group', defaultGroup) as GroupBy)
  const [activeCustomId, setActiveCustomId] = useState<string | null>(null)
  const [subtasksCollapsed, setSubtasksCollapsed] = useState(false)
  const [expandVersion,     setExpandVersion]     = useState(0)
  const toggleAllSubtasks = () => { setSubtasksCollapsed(v => !v); setExpandVersion(v => v+1) }

  const selectView  = (v: ViewType) => { setView(v); vSet(scopeKey+'_view', v); setActiveCustomId(null) }
  const selectGroup = (g: GroupBy)  => { setGroup(g); vSet(scopeKey+'_group', g) }

  const customViews       = getCustomViews(scopeKey)
  const currentCustomView = activeCustomId ? customViews.find(v => v.id===activeCustomId) : null

  const root  = tasks.filter(t => !t.parentId)
  const done  = root.filter(t => t.status === 'done').length
  const total = root.length
  
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [tasks, searchQuery])

  // Contagem do cabeçalho exclui concluídas — mesma convenção dos badges da sidebar
  // (espaço/pasta/projeto), que também só contam tarefas ativas.
  const activeCount = filteredTasks.filter(t => t.status !== 'done').length

  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          {/* Breadcrumb + title + toolbar */}
          <div className="px-4 md:px-6 pt-2.5 md:pt-5 pb-0 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-[13px] min-w-0">
              <span className="hidden sm:inline">{breadcrumb}</span>
              {icon}
              <h1 className="text-[16px] md:text-[20px] font-extrabold text-gray-900 tracking-[-0.02em] truncate min-w-0">{title}</h1>
              <span className="text-xs text-gray-400 font-medium flex-shrink-0">({activeCount})</span>
              <span className="md:hidden tabnum text-[10px] font-bold text-gray-500 bg-gray-100 px-1 py-0.5 rounded flex-shrink-0">{pct}%</span>
            </div>
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 transition-all w-40" />
                </div>
                {headerRight && <div className="flex items-center gap-1.5 flex-shrink-0 scale-95 origin-right">{headerRight}</div>}
            </div>
          </div>

          {/* Progress */}
          <div className="hidden md:flex items-center gap-3 px-4 md:px-6 mt-3 md:mt-4">
            <div className="flex-1 h-[7px] bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: accent }}/>
            </div>
            <span className="tabnum text-xs font-bold text-gray-600 flex-shrink-0">{done}/{total} · {pct}%</span>
          </div>

          {/* View tabs */}
          <div className="flex items-center overflow-x-auto scrollbar-none px-4 md:px-5 mt-1.5 md:mt-3 border-b border-transparent">
            {tabs.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => selectView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 md:py-2.5 text-[12px] md:text-[12.5px] font-semibold whitespace-nowrap transition-all flex-shrink-0 border-b-2 -mb-px
                  ${!activeCustomId && view===key ? 'text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'}`}
                style={!activeCustomId && view===key ? { borderColor: accent, color: accent } : undefined}>
                <Icon size={12}/>{label}
              </button>
            ))}

            {/* Custom views */}
            {customViews.map(cv => (
              <div key={cv.id} className={`flex items-center group/cv flex-shrink-0 border-b-2 -mb-px ${activeCustomId===cv.id ? 'border-brand-500' : 'border-transparent'}`}>
                <button onClick={() => setActiveCustomId(cv.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 md:py-2.5 text-[12px] md:text-[12.5px] font-semibold whitespace-nowrap transition-colors ${activeCustomId===cv.id ? 'text-brand-600' : 'text-gray-500 hover:text-gray-800'}`}>
                  {(() => { const Icon = VIEW_ICON[cv.icon]; return Icon ? <Icon size={12}/> : <span>{cv.icon}</span> })()}
                  {cv.name}
                </button>
                <button onClick={() => { deleteCustomView(scopeKey, cv.id); if (activeCustomId===cv.id) setActiveCustomId(null) }}
                  className="opacity-0 group-hover/cv:opacity-100 px-1 py-1.5 md:py-2.5 text-gray-300 hover:text-red-400 transition-all text-xs">
                  <X size={10}/>
                </button>
              </div>
            ))}

            {/* Add view */}
            <button
              onClick={() => openNewViewModal(scopeKey)}
              className="group/newview flex items-center gap-1.5 px-3 py-1 my-1 text-[11px] font-semibold text-gray-500 hover:text-brand-600 bg-gray-50/50 hover:bg-brand-50/40 border border-dashed border-gray-200 hover:border-brand-300 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex-shrink-0 shadow-xs"
            >
              <Plus size={11} className="text-gray-400 group-hover/newview:text-brand-500 transition-colors" />
              <span>Nova visualização</span>
            </button>
          </div>

          {/* Group control (list only) */}
          {view==='list' && !activeCustomId && (
            <div className="flex items-center gap-1.5 md:gap-2.5 px-4 md:px-6 py-1 md:py-3 flex-wrap">
              <span className="hidden md:inline text-[11px] font-semibold text-gray-400">Agrupar por</span>
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-[2px] md:p-[3px]">
                {groupOptions.map(g => (
                  <button key={g} onClick={() => selectGroup(g)}
                    className={`px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-semibold rounded-md transition-colors ${group===g?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                    {GROUP_LABEL[g]}
                  </button>
                ))}
              </div>
              <button onClick={toggleAllSubtasks}
                title={subtasksCollapsed ? 'Expandir subtarefas' : 'Recolher subtarefas'}
                className="ml-auto flex items-center gap-1 px-1.5 py-1 text-[10px] md:text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg bg-white hover:border-gray-300 hover:text-gray-900 transition-colors">
                <ChevronDown size={11} className={`text-gray-400 transition-transform ${subtasksCollapsed ? '' : 'rotate-180'}`}/>
                <span>{subtasksCollapsed ? 'Expandir' : 'Recolher'}</span>
              </button>
              {toolbarExtra}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {!activeCustomId && view==='overview'  && <OverviewView  tasks={filteredTasks} accent={accent} pct={pct} gut={gut}/>}
          {!activeCustomId && view==='list'      && <TaskList tasks={filteredTasks} projectId={defaultProjectId} scopeKey={scopeKey} columns={columns} showProject={showProject} sortBy={group} subtasksCollapsed={subtasksCollapsed} expandVersion={expandVersion}/>}
          {!activeCustomId && view==='board'     && <BoardView     tasks={filteredTasks}/>}
          {!activeCustomId && view==='table'     && <TableView     tasks={filteredTasks} columns={columns} showProject={showProject}/>}
          {!activeCustomId && view==='calendar'  && <CalendarInline tasks={filteredTasks}/>}
          {!activeCustomId && view==='whiteboard'&& <WhiteboardView scopeKey={scopeKey}/>}
          {!activeCustomId && view==='activity'  && <ActivityView  tasks={filteredTasks}/>}
          {!activeCustomId && view==='dashboard' && <DashboardView tasks={filteredTasks} accent={accent}/>}

          {/* Custom view */}
          {activeCustomId && currentCustomView && (() => {
            const filtered = applyCustomViewFilter(filteredTasks, currentCustomView)
            if (currentCustomView.baseType==='board')    return <BoardView tasks={filtered}/>
            if (currentCustomView.baseType==='table')    return <TableView tasks={filtered} columns={columns} showProject={showProject}/>
            if (currentCustomView.baseType==='calendar') return <CalendarInline tasks={filtered}/>
            return <TaskList tasks={filtered} projectId={defaultProjectId} scopeKey={scopeKey+':'+currentCustomView.id} columns={columns} showProject={showProject} sortBy={group} subtasksCollapsed={subtasksCollapsed} expandVersion={expandVersion}/>
          })()}

          <FilterPanelMaybe/>
          <AIPanelMaybe/>

          {selectedTaskId && <TaskDetail/>}
        </div>
      </div>
    </div>
  )
}

// Render filter/AI panels only when toggled (kept here so every scope gets them)
function FilterPanelMaybe() {
  const open = useAppStore(s => s.filterPanelOpen)
  return open ? <FilterPanel/> : null
}
function AIPanelMaybe() {
  const open = useAppStore(s => s.aiPanelOpen)
  return open ? <AIPanel/> : null
}

// ── Overview ────────────────────────────────────────────────────────────────
function OverviewView({ tasks, accent, pct, gut }: { tasks: Task[]; accent: string; pct: number; gut?: { score:number;g:number;u:number;t:number } }) {
  const { setSelectedTask } = useAppStore()
  const root     = tasks.filter(t => !t.parentId)
  const todo     = root.filter(t => t.status==='todo').length
  const inProg   = root.filter(t => t.status==='in_progress').length
  const done     = root.filter(t => t.status==='done').length
  const overdue  = root.filter(t => t.dueDate && t.status!=='done' && new Date(t.dueDate)<new Date())
  const upcoming = [...root].filter(t => t.dueDate && t.status!=='done')
    .sort((a,b) => new Date(a.dueDate as string).getTime()-new Date(b.dueDate as string).getTime()).slice(0,5)
  const recent   = [...tasks].sort((a,b) => new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()).slice(0,6)

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 bg-gray-50/30">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label:'Total', value: root.length, color: accent },
          { label:'A fazer', value: todo, color: '#888780' },
          { label:'Em progresso', value: inProg, color: '#378ADD' },
          { label:'Concluído', value: done, color: '#1D9E75' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100/95 rounded-2xl p-4 md:p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.06)] hover:-translate-y-0.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{color:s.color}}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-white border border-gray-100/95 rounded-2xl p-4 md:p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.06)]">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 md:mb-4">Progresso geral</p>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 bg-gray-100/80 rounded-full overflow-hidden p-[2px]">
              <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:accent}}/>
            </div>
            <span className="text-sm font-bold text-gray-800">{pct}%</span>
          </div>
          <p className="text-[11px] font-medium text-gray-400 mt-2">{done} de {root.length} tarefas concluídas</p>
        </div>
        {gut && (
          <div className="bg-white border border-gray-100/95 rounded-2xl p-4 md:p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 md:mb-3">GUT Score</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{color:accent}}>{gut.score}</span>
            </div>
            <p className="text-[11px] font-medium text-gray-400 mt-1">G:{gut.g} · U:{gut.u} · T:{gut.t}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-white border border-gray-100/95 rounded-2xl p-4 md:p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.06)]">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 md:mb-4">Próximos prazos</p>
          {upcoming.length===0 ? (
            <p className="text-xs text-gray-400 italic">Nenhuma tarefa com prazo</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(t=>(
                <button key={t.id} onClick={()=>setSelectedTask(t.id)}
                  className="w-full flex items-center gap-2 text-left hover:bg-gray-50/80 p-2 rounded-xl transition-all duration-150 border border-transparent hover:border-gray-100">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:accent}}/>
                  <span className="flex-1 text-xs font-medium text-gray-700 truncate">{t.title}</span>
                  <span className="text-[10px] text-gray-400 font-medium flex-shrink-0 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">{new Date(t.dueDate as string).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-100/95 rounded-2xl p-4 md:p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.06)]">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 md:mb-4">
            {overdue.length>0 ? `Atrasadas (${overdue.length})` : 'Atividade recente'}
          </p>
          {overdue.length>0 ? (
            <div className="space-y-2">
              {overdue.slice(0,5).map(t=>(
                <button key={t.id} onClick={()=>setSelectedTask(t.id)}
                  className="w-full flex items-center gap-2 text-left hover:bg-red-50/50 p-2 rounded-xl transition-all duration-150 border border-transparent hover:border-red-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"/>
                  <span className="flex-1 text-xs font-medium text-gray-700 truncate">{t.title}</span>
                  <span className="text-[10px] text-red-500 font-semibold flex-shrink-0 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">{new Date(t.dueDate as string).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(t=>(
                <button key={t.id} onClick={()=>setSelectedTask(t.id)}
                  className="w-full flex items-center gap-2 text-left hover:bg-gray-50/80 p-2 rounded-xl transition-all duration-150 border border-transparent hover:border-gray-100">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.status==='done'?'bg-green-400':t.status==='in_progress'?'bg-blue-400':'bg-gray-300'}`}/>
                  <span className="flex-1 text-xs font-medium text-gray-700 truncate">{t.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Board ───────────────────────────────────────────────────────────────────
function BoardView({ tasks }: { tasks: Task[] }) {
  const { updateTask, deleteTask, setSelectedTask } = useAppStore()
  const [sel, setSel] = useState<string[]>([])
  const cols: { status: 'todo'|'in_progress'|'done'; label: string; color: string }[] = [
    { status:'todo',        label:'A fazer',      color:'#888780' },
    { status:'in_progress', label:'Em progresso', color:'#378ADD' },
    { status:'done',        label:'Concluído',    color:'#1D9E75' },
  ]
  const toggle = (id: string) => setSel(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id])
  const clear  = () => setSel([])
  const bulkStatus   = (s: TaskStatus) => { sel.forEach(id=>updateTask(id,{status:s})); clear() }
  const bulkPriority = (p: Priority)   => { sel.forEach(id=>updateTask(id,{priority:p})); clear() }
  const bulkDelete   = () => { sel.forEach(id=>deleteTask(id)); clear() }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50/20">
      <div className="flex gap-5 p-5 overflow-x-auto flex-1">
        {cols.map(col => {
          const colTasks = tasks.filter(t=>t.status===col.status&&!t.parentId)
          return (
            <div key={col.status} className="flex flex-col gap-3 min-w-[260px] max-w-[300px] flex-1 flex-shrink-0">
              <div className="flex items-center justify-between px-1.5 py-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shadow-sm" style={{background:col.color}}/>
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{col.label}</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200/50">{colTasks.length}</span>
              </div>
              <div className="flex flex-col gap-2.5 flex-1 bg-gray-100/60 rounded-2xl p-2.5 min-h-[120px] border border-gray-200/40"
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{const id=e.dataTransfer.getData('taskId');if(id)updateTask(id,{status:col.status})}}>
                {colTasks.map(t=>{
                  const selected = sel.includes(t.id)
                  const priorityConfig = {
                    urgent: { label: 'Urgente', color: 'text-red-600 bg-red-50 border-red-100' },
                    high:   { label: 'Alta',    color: 'text-orange-600 bg-orange-50 border-orange-100' },
                    medium: { label: 'Média',   color: 'text-blue-600 bg-blue-50 border-blue-100' },
                    low:    { label: 'Baixa',   color: 'text-gray-500 bg-gray-50 border-gray-200/60' },
                  }[t.priority] || { label: t.priority, color: 'text-gray-400' }

                  return (
                    <div key={t.id} draggable
                      onDragStart={e=>e.dataTransfer.setData('taskId',t.id)}
                      onClick={()=> sel.length>0 ? toggle(t.id) : setSelectedTask(t.id)}
                      className={`relative bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all duration-200 group ${selected?'border-brand-500 ring-2 ring-brand-100 shadow-sm':'border-gray-200/80 hover:border-brand-400 hover:scale-[1.01]'}`}>
                      {/* Checkbox de seleção */}
                      <button onClick={e=>{e.stopPropagation();toggle(t.id)}}
                        className={`absolute top-3 right-3 w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${selected?'bg-brand-500 border-brand-500 opacity-100':'border-gray-300 bg-white opacity-0 group-hover:opacity-100 hover:border-brand-400'}`}>
                        {selected && <Check size={11} className="text-white" strokeWidth={3.5}/>}
                      </button>
                      <p className="text-[13px] font-semibold text-gray-800 mb-3 leading-snug pr-6">{t.title}</p>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityConfig.color}`}>
                          {priorityConfig.label}
                        </span>
                        {t.dueDate && (
                          <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
                            {new Date(t.dueDate).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}
                          </span>
                        )}
                        <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 text-[9px] font-semibold flex items-center justify-center border border-brand-100">{t.assignee.slice(0,2)}</span>
                      </div>
                      {t.tags.length>0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-gray-50">
                          {t.tags.slice(0,2).map((tag:string)=><span key={tag} className="text-[9.5px] font-medium px-2 py-0.5 bg-gray-100/80 text-gray-500 rounded border border-gray-200/40">{tag}</span>)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Barra de ações em massa */}
      {sel.length>0 && (
        <div className="border-t border-gray-200 bg-white shadow-lg px-4 py-2 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-700">{sel.length} selecionadas</span>
          <div className="flex-1"/>
          <Select value="" placeholder="Status..." options={STATUS_OPTIONS}
            onChange={v=>bulkStatus(v as TaskStatus)} ariaLabel="Definir status"/>
          <Select value="" placeholder="Prioridade..." options={PRIORITY_OPTIONS}
            onChange={v=>bulkPriority(v as Priority)} ariaLabel="Definir prioridade"/>
          <button onClick={bulkDelete} className="flex items-center gap-1 text-xs px-2 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 size={11}/> Excluir
          </button>
          <button onClick={clear} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
        </div>
      )}
    </div>
  )
}

// ── Table ───────────────────────────────────────────────────────────────────
function TableView({ tasks, columns, showProject }: { tasks: Task[]; columns: ColumnDef[]; showProject?: boolean }) {
  const { setSelectedTask, updateTask, projects } = useAppStore()
  const root = tasks.filter(t=>!t.parentId)
  return (
    <div className="flex-1 overflow-auto p-4">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 text-gray-500 font-medium w-8">#</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium">Nome</th>
            {showProject && <th className="text-left px-3 py-2 text-gray-500 font-medium w-32">Projeto</th>}
            <th className="text-left px-3 py-2 text-gray-500 font-medium w-28">Status</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium w-24">Prioridade</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium w-24">Responsável</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium w-24">Prazo</th>
            {columns.map(c=><th key={c.id} className="text-left px-3 py-2 text-gray-500 font-medium" style={{width:c.width??100}}>{c.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {root.map((t,i)=>{
            const pr = projects.find(p=>p.id===t.projectId)
            return (
              <tr key={t.id} onClick={()=>setSelectedTask(t.id)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-3 py-2 text-gray-400">{i+1}</td>
                <td className="px-3 py-2 font-medium text-gray-800">{t.title}</td>
                {showProject && (
                  <td className="px-3 py-2">
                    {pr && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{background:pr.color+'18',color:pr.color}}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{background:pr.color}}/>{pr.name}</span>}
                  </td>
                )}
                <td className="px-3 py-2">
                  <Select variant="inline" stop colorText value={t.status}
                    options={STATUS_OPTIONS} ariaLabel="Status"
                    onChange={v=>updateTask(t.id,{status:v as any})}/>
                </td>
                <td className="px-3 py-2" onClick={e=>e.stopPropagation()}>
                  <Select variant="inline" stop colorText pill value={t.priority}
                    options={PRIORITY_OPTIONS} ariaLabel="Prioridade"
                    onChange={v=>updateTask(t.id,{priority:v as Priority})}/>
                </td>
                <td className="px-3 py-2" onClick={e=>e.stopPropagation()}>
                  <AssigneePicker value={t.assignee} onChange={v=>updateTask(t.id,{assignee:v})} variant="row"/>
                </td>
                <td className="px-3 py-2" onClick={e=>e.stopPropagation()}>
                  <DueDatePicker value={t.dueDate} onChange={v=>updateTask(t.id,{dueDate:v})} overdue={!!t.dueDate && t.status!=='done' && new Date(t.dueDate)<new Date()} variant="row"/>
                </td>
                {columns.map(c=>(
                  <td key={c.id} className="px-3 py-2 text-gray-500">{String(t.customFields?.[c.id]??'')}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Calendar ────────────────────────────────────────────────────────────────
function CalendarInline({ tasks }: { tasks: Task[] }) {
  const { setSelectedTask } = useAppStore()
  const today = new Date()
  const [year,setYear]=useState(today.getFullYear())
  const [month,setMonth]=useState(today.getMonth())
  const firstDay=new Date(year,month,1).getDay()
  const daysInMonth=new Date(year,month+1,0).getDate()
  const cells=[...Array(firstDay).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)]
  while(cells.length%7!==0)cells.push(null)
  const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const tasksOnDay=(day:number)=>{
    const d=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return tasks.filter(t=>t.dueDate===d&&t.status!=='done')
  }
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={()=>{ if(month===0){setMonth(11);setYear(y=>y-1)}else{setMonth(m=>m-1)} }} className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">{'<'}</button>
        <span className="text-sm font-medium">{MONTHS[month]} {year}</span>
        <button onClick={()=>{ if(month===11){setMonth(0);setYear(y=>y+1)}else{setMonth(m=>m+1)} }} className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">{'>'}</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><div key={d} className="text-center text-[10px] text-gray-400 py-1">{d}</div>)}
        {cells.map((day,i)=>{
          if(!day)return<div key={i}/>
          const isToday=day===today.getDate()&&month===today.getMonth()&&year===today.getFullYear()
          const dt=tasksOnDay(day)
          return(
            <div key={i} className={`min-h-[60px] p-1 rounded-lg border text-[11px] ${isToday?'border-brand-300 bg-brand-50/40':'border-gray-100 hover:border-gray-200'}`}>
              <span className={`font-medium ${isToday?'text-brand-600':''}`}>{day}</span>
              {dt.map(t=><div key={t.id} onClick={()=>setSelectedTask(t.id)} className="mt-0.5 truncate cursor-pointer rounded px-1" style={{background:t.priority==='urgent'?'#FAECE7':t.priority==='high'?'#FAEEDA':'#E6F1FB',color:t.priority==='urgent'?'#993C1D':t.priority==='high'?'#854F0B':'#185FA5'}}>{t.title}</div>)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Activity ────────────────────────────────────────────────────────────────
function ActivityView({ tasks }: { tasks: Task[] }) {
  const { setSelectedTask } = useAppStore()
  const sorted = [...tasks].sort((a,b) => new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime())
  const statusColor: Record<string,string> = { todo:'#888780', in_progress:'#378ADD', done:'#1D9E75' }
  const statusLabel: Record<string,string> = { todo:'A fazer', in_progress:'Em progresso', done:'Concluído' }
  const formatRelative = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff/60000), hrs = Math.floor(diff/3600000), days = Math.floor(diff/86400000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}min atrás`
    if (hrs < 24) return `${hrs}h atrás`
    return `${days}d atrás`
  }
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="max-w-2xl">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Atividade recente</h2>
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200"/>
          <div className="space-y-3">
            {sorted.map(t => (
              <div key={t.id} className="flex items-start gap-3 pl-0">
                <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0 z-10"
                  style={{background: statusColor[t.status] + '20', borderColor: statusColor[t.status]}}>
                  {t.status==='done'
                    ? <Check size={11} strokeWidth={3} style={{color:statusColor[t.status]}}/>
                    : <Circle size={7} strokeWidth={0} fill={statusColor[t.status]} style={{color:statusColor[t.status]}}/>}
                </div>
                <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl px-3 py-2.5 hover:border-gray-200 transition-colors cursor-pointer shadow-sm"
                  onClick={() => setSelectedTask(t.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-800 truncate font-medium">{t.title}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelative(t.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{background:statusColor[t.status]+'15',color:statusColor[t.status]}}>
                      {statusLabel[t.status]}
                    </span>
                    {t.assignee && <span className="text-[10px] text-gray-400">{t.assignee}</span>}
                    {t.dueDate && <span className="inline-flex items-center gap-1 text-[10px] text-gray-400"><Calendar size={10}/>{new Date(t.dueDate).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>}
                  </div>
                </div>
              </div>
            ))}
            {sorted.length===0 && (<p className="text-sm text-gray-400 pl-10">Nenhuma atividade registrada.</p>)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function DashboardView({ tasks, accent }: { tasks: Task[]; accent: string }) {
  const root = tasks.filter(t => !t.parentId)
  const byStatus = {
    todo:        root.filter(t=>t.status==='todo').length,
    in_progress: root.filter(t=>t.status==='in_progress').length,
    done:        root.filter(t=>t.status==='done').length,
  }
  const byPriority = {
    urgent: root.filter(t=>t.priority==='urgent').length,
    high:   root.filter(t=>t.priority==='high').length,
    medium: root.filter(t=>t.priority==='medium').length,
    low:    root.filter(t=>t.priority==='low').length,
  }
  const total = root.length || 1
  const Bar = ({ value, max, color }: { value:number; max:number; color:string }) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{width:`${(value/max)*100}%`,background:color}}/>
      </div>
      <span className="text-xs text-gray-600 w-6 text-right">{value}</span>
    </div>
  )
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="grid grid-cols-2 gap-4 max-w-4xl">
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-4">Por status</h3>
          <div className="space-y-3">
            {[
              {label:'A fazer',      val:byStatus.todo,        color:'#888780'},
              {label:'Em progresso', val:byStatus.in_progress, color:'#378ADD'},
              {label:'Concluído',    val:byStatus.done,        color:'#1D9E75'},
            ].map(s=>(
              <div key={s.label}>
                <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{s.label}</span><span>{Math.round((s.val/total)*100)}%</span></div>
                <Bar value={s.val} max={total} color={s.color}/>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-4">Por prioridade</h3>
          <div className="space-y-3">
            {[
              {label:'Urgente', val:byPriority.urgent, color:'#E24B4A'},
              {label:'Alta',    val:byPriority.high,   color:'#D85A30'},
              {label:'Média',   val:byPriority.medium, color:'#378ADD'},
              {label:'Baixa',   val:byPriority.low,    color:'#888780'},
            ].map(p=>(
              <div key={p.label}>
                <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{p.label}</span><span>{p.val}</span></div>
                <Bar value={p.val} max={total} color={p.color}/>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-5">
          <svg width={80} height={80} viewBox="0 0 80 80">
            <circle cx={40} cy={40} r={32} fill="none" stroke="#f1f1f0" strokeWidth={8}/>
            <circle cx={40} cy={40} r={32} fill="none" stroke={accent} strokeWidth={8}
              strokeDasharray={`${2*Math.PI*32 * byStatus.done/total} ${2*Math.PI*32}`}
              strokeLinecap="round" transform="rotate(-90 40 40)"/>
            <text x={40} y={44} textAnchor="middle" fontSize={14} fontWeight={700} fill={accent}>{Math.round(byStatus.done/total*100)}%</text>
          </svg>
          <div>
            <p className="text-xs font-semibold text-gray-700">Taxa de conclusão</p>
            <p className="text-[11px] text-gray-400 mt-1">{byStatus.done} de {root.length} tarefas concluídas</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Visão geral</h3>
          {[
            { label:'Total de tarefas', val:root.length, color:'#6366F1' },
            { label:'Atrasadas', val:root.filter(t=>t.dueDate&&t.status!=='done'&&new Date(t.dueDate)<new Date()).length, color:'#E24B4A' },
            { label:'Sem prazo', val:root.filter(t=>!t.dueDate).length, color:'#888780' },
          ].map(s=>(
            <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-600">{s.label}</span>
              <span className="text-sm font-bold" style={{color:s.color}}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
