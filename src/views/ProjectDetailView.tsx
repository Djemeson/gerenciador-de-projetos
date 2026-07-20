import React, { useState } from 'react'
import {
  Target, ChevronLeft, Archive, Trash2, AlertTriangle,
  LayoutGrid, Table2, Calendar, List, SlidersHorizontal, Sparkles, Columns,
  LayoutDashboard, PenTool, Activity, Eye, Plus, X, Check, Circle, ChevronDown, Wand2,
} from 'lucide-react'
import { useAppStore, scopeKeyForProject } from '../stores/useAppStore'
import { Select, STATUS_OPTIONS, PRIORITY_OPTIONS } from '../components/ui/Select'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetail } from '../components/tasks/TaskDetail'
import { WhiteboardView } from '../components/tasks/WhiteboardView'
import { FilterPanel } from '../components/FilterPanel'
import { AIPanel } from '../components/AIPanel'
import { AssigneePicker } from '../components/ui/AssigneePicker'
import { DueDatePicker } from '../components/ui/DueDatePicker'
import { applyCustomViewFilter } from '../lib/customViews'
import { gutTier } from '../types'
import type { ViewType, TaskOpenMode, Priority } from '../types'

type SortBy = 'status' | 'priority' | 'dueDate'

export function ProjectDetailView() {
  const {
    activeProjectId, projects, tasks, selectedTaskId, openGUT, setView,
    archiveProject, deleteProject, setProjectView, setTaskOpenMode,
    openColumnsModal, openNewViewModal, openEnrichProject,
    filterPanelOpen, toggleFilterPanel, aiPanelOpen, toggleAIPanel,
    getCustomViews, deleteCustomView, setSelectedTask,
  } = useAppStore()

  const [sortBy,         setSortBy]         = useState<SortBy>('status')
  const [confirmDel,     setConfirmDel]     = useState(false)
  const [activeCustomId, setActiveCustomId] = useState<string|null>(null)
  const [subtasksCollapsed, setSubtasksCollapsed] = useState(false)
  const [expandVersion,     setExpandVersion]     = useState(0)
  const toggleAllSubtasks = () => { setSubtasksCollapsed(v => !v); setExpandVersion(v => v+1) }

  const project = projects.find(p => p.id === activeProjectId)
  if (!project) return null

  const scopeKey      = scopeKeyForProject(project.id)
  const projectTasks  = tasks.filter(t => t.projectId === project.id)
  const rootTasks     = projectTasks.filter(t => !t.parentId)
  const done  = rootTasks.filter(t => t.status === 'done').length
  const total = rootTasks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const tier  = gutTier(project.gut.score)
  const activeView   = project.activeView ?? 'list'
  const taskOpenMode = (project.taskOpenMode === 'side' ? 'center' : project.taskOpenMode) ?? 'center'
  const customViews  = getCustomViews(scopeKey)

  // Which view is active
  const currentCustomView = activeCustomId ? customViews.find(v => v.id===activeCustomId) : null

  const VIEW_TABS: { key: ViewType; label: string; Icon: React.ElementType }[] = [
    { key:'overview',  label:'Overview',    Icon: Eye         },
    { key:'list',      label:'Tarefas',     Icon: List        },
    { key:'board',     label:'Board',       Icon: LayoutGrid  },
    { key:'table',     label:'Tabela',      Icon: Table2      },
    { key:'calendar',  label:'Calendário',  Icon: Calendar    },
    { key:'whiteboard',label:'Quadro branco', Icon: PenTool   },
    { key:'activity',  label:'Atividade',   Icon: Activity    },
    { key:'dashboard', label:'Painéis',     Icon: LayoutDashboard },
  ]

  const selectView = (v: ViewType) => {
    setProjectView(project.id, v)
    setActiveCustomId(null)
  }

  const handleChangeMode = (mode: TaskOpenMode) => setTaskOpenMode(project.id, mode)

  // Render task detail based on mode
  const renderTaskDetail = () => {
    if (!selectedTaskId) return null
    if (taskOpenMode === 'full') {
      return <TaskDetail mode="full" onChangeMode={handleChangeMode}/>
    }
    // center is rendered as portal overlay inside TaskDetail
    return <TaskDetail mode="center" onChangeMode={handleChangeMode}/>
  }

  const mainContent = (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">

        {/* ── Breadcrumb + toolbar row ── */}
        <div className="px-4 pt-3 pb-0 flex items-center justify-between gap-2 flex-wrap">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-[13px] min-w-0">
            <button onClick={() => setView('projects')} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <ChevronLeft size={15}/>
            </button>
            <span className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">Projetos</span>
            <span className="text-gray-300 mx-0.5">/</span>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: project.color }}/>
            <h1 className="font-semibold text-gray-900 truncate min-w-0">{project.name}</h1>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={toggleFilterPanel} title="Filtros"
              className={`p-1.5 rounded-lg transition-colors ${filterPanelOpen ? 'bg-brand-100 text-brand-600' : 'text-gray-400 hover:bg-gray-100'}`}>
              <SlidersHorizontal size={14}/>
            </button>
            <button onClick={() => openColumnsModal(project.id, scopeKey)} title="Campos personalizados"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Columns size={14}/>
            </button>
            <button onClick={toggleAIPanel} title="Pergunte à IA"
              className={`p-1.5 rounded-lg transition-colors ${aiPanelOpen ? 'bg-brand-100 text-brand-600' : 'text-gray-400 hover:bg-gray-100'}`}>
              <Sparkles size={14}/>
            </button>
            <button onClick={() => openEnrichProject(project.id)} title="Enriquecer projeto com IA"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-600 transition-colors">
              <Wand2 size={14}/>
            </button>
            <button onClick={() => openGUT(project.id)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-colors hover:border-gray-300"
              style={{ background: tier.bg, color: tier.color, borderColor: tier.color+'33' }}>
              <Target size={11}/> GUT {project.gut.score}
            </button>
            <button onClick={() => { archiveProject(project.id); setView('projects') }}
              className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
              <Archive size={11}/> Arquivar
            </button>
            {confirmDel ? (
              <button onClick={() => { deleteProject(project.id); setView('projects') }}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-red-500 text-white rounded-lg animate-pulse">
                <AlertTriangle size={11}/> Confirmar
              </button>
            ) : (
              <button onClick={() => { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000) }}
                className="flex items-center gap-1 text-xs px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                <Trash2 size={11}/> Deletar
              </button>
            )}
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="flex items-center gap-3 px-4 mt-2">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: project.color }}/>
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">{done}/{total} · {pct}%</span>
        </div>

        {/* ── View tabs (ClickUp underline style) ── */}
        <div className="flex items-center overflow-x-auto scrollbar-none px-3 mt-1">
          {VIEW_TABS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => selectView(key)}
              className={`flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 border-b-2 -mb-px
                ${!activeCustomId && activeView===key
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'}`}>
              <Icon size={12}/>{label}
            </button>
          ))}

          {/* Custom views */}
          {customViews.map(cv => (
            <div key={cv.id} className="flex items-center group/cv flex-shrink-0 border-b-2 -mb-px
              ${activeCustomId===cv.id ? 'border-brand-500' : 'border-transparent'}">
              <button onClick={() => { setActiveCustomId(cv.id); setProjectView(project.id, cv.baseType) }}
                className={`flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors
                  ${activeCustomId===cv.id ? 'text-brand-600' : 'text-gray-500 hover:text-gray-800'}`}>
                <span>{cv.icon}</span>{cv.name}
              </button>
              <button onClick={() => { deleteCustomView(scopeKey, cv.id); if(activeCustomId===cv.id) setActiveCustomId(null) }}
                className="opacity-0 group-hover/cv:opacity-100 px-1 py-2.5 text-gray-300 hover:text-red-400 transition-all text-xs">
                <X size={10}/>
              </button>
            </div>
          ))}

          {/* Add view */}
          <button
            onClick={() => openNewViewModal(scopeKey)}
            className="group/newview flex items-center gap-1.5 px-3 py-1 my-1.5 text-[11px] font-semibold text-gray-500 hover:text-brand-600 bg-gray-50/50 hover:bg-brand-50/40 border border-dashed border-gray-200 hover:border-brand-300 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex-shrink-0 shadow-xs"
          >
            <Plus size={11} className="text-gray-400 group-hover/newview:text-brand-500 transition-colors" />
            <span>Nova visualização</span>
          </button>
        </div>

        {/* Sort (list/custom-list only) com botão atraente de recolher subtarefas */}
        {(activeView==='list' || currentCustomView?.baseType==='list') && !['overview','whiteboard','activity','dashboard'].includes(activeView) && (
          <div className="px-4 py-2 bg-slate-50/60 border-t border-b border-gray-100/80 flex items-center justify-between gap-3 flex-wrap mt-2 select-none">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Agrupar por</span>
              <div className="flex items-center gap-0.5 bg-gray-200/50 rounded-lg p-[3px]">
                {(['status','priority','dueDate'] as SortBy[]).map(s=>(
                  <button key={s} onClick={()=>setSortBy(s)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${sortBy===s?'bg-white text-gray-800 shadow-sm font-bold':'text-gray-500 hover:text-gray-800'}`}>
                    {{status:'Status',priority:'Prioridade',dueDate:'Prazo'}[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Botão de recolher/expandir subtarefas extremamente atraente */}
            <button
              onClick={toggleAllSubtasks}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all duration-300 shadow-sm cursor-pointer select-none
                ${subtasksCollapsed 
                  ? 'bg-gradient-to-r from-brand-50 to-indigo-50 border-brand-200 text-brand-700 hover:from-brand-100/60 hover:to-indigo-100/60' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              title={subtasksCollapsed ? 'Expandir todas as subtarefas do projeto' : 'Recolher todas as subtarefas do projeto'}
            >
              <span className={`transition-transform duration-300 ${subtasksCollapsed ? 'scale-110' : '-rotate-180'}`}>
                <ChevronDown size={14} className={subtasksCollapsed ? 'text-brand-600' : 'text-slate-400'} />
              </span>
              <span>{subtasksCollapsed ? 'Expandir Subtarefas' : 'Recolher Subtarefas'}</span>
            </button>
          </div>
        )}
      </div>

      {/* View content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Overview */}
        {activeView==='overview' && !activeCustomId && (
          <OverviewView tasks={projectTasks} project={project} pct={pct} tier={tier}/>
        )}
        {/* List */}
        {(activeView==='list' && !activeCustomId) && (
          <TaskList tasks={projectTasks} projectId={project.id} columns={project.columns} sortBy={sortBy} subtasksCollapsed={subtasksCollapsed} expandVersion={expandVersion}/>
        )}
        {/* Board */}
        {activeView==='board' && !activeCustomId && (
          <BoardView tasks={projectTasks} projectId={project.id} project={project}/>
        )}
        {/* Table */}
        {activeView==='table' && !activeCustomId && (
          <TableView tasks={projectTasks} project={project}/>
        )}
        {/* Calendar */}
        {activeView==='calendar' && !activeCustomId && (
          <CalendarInline tasks={projectTasks} projectId={project.id}/>
        )}
        {/* Quadro branco */}
        {activeView==='whiteboard' && !activeCustomId && (
          <WhiteboardView scopeKey={scopeKey}/>
        )}
        {/* Activity */}
        {activeView==='activity' && !activeCustomId && (
          <ActivityView tasks={projectTasks} project={project}/>
        )}
        {/* Dashboard */}
        {activeView==='dashboard' && !activeCustomId && (
          <DashboardView tasks={projectTasks} project={project}/>
        )}

        {/* Custom view */}
        {activeCustomId && currentCustomView && (() => {
          const filtered = applyCustomViewFilter(projectTasks, currentCustomView)
          if (currentCustomView.baseType==='board')    return <BoardView tasks={filtered} projectId={project.id} project={project}/>
          if (currentCustomView.baseType==='table')    return <TableView tasks={filtered} project={project}/>
          if (currentCustomView.baseType==='calendar') return <CalendarInline tasks={filtered} projectId={project.id}/>
          return <TaskList tasks={filtered} projectId={project.id} columns={project.columns} sortBy={sortBy} subtasksCollapsed={subtasksCollapsed} expandVersion={expandVersion}/>
        })()}

        {filterPanelOpen && <FilterPanel/>}
        {aiPanelOpen && <AIPanel/>}


      </div>
    </div>
  )

  // Full mode: only TaskDetail fills the screen
  if (taskOpenMode === 'full' && selectedTaskId) {
    return (
      <div className="flex flex-1 overflow-hidden">
        {mainContent}
        <TaskDetail mode="full" onChangeMode={handleChangeMode}/>
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {mainContent}

      {/* Center modal task detail */}
      {selectedTaskId && taskOpenMode==='center' && (
        <TaskDetail mode="center" onChangeMode={handleChangeMode}/>
      )}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────
function OverviewView({ tasks, project, pct, tier }: { tasks: any[]; project: any; pct: number; tier: any }) {
  const { setSelectedTask } = useAppStore()
  const root      = tasks.filter(t => !t.parentId)
  const todo      = root.filter(t => t.status==='todo').length
  const inProg    = root.filter(t => t.status==='in_progress').length
  const done      = root.filter(t => t.status==='done').length
  const overdue   = root.filter(t => t.dueDate && t.status!=='done' && new Date(t.dueDate)<new Date())
  const upcoming  = [...root].filter(t => t.dueDate && t.status!=='done')
    .sort((a,b) => new Date(a.dueDate).getTime()-new Date(b.dueDate).getTime()).slice(0,5)
  const recent    = [...tasks].sort((a,b) => new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()).slice(0,6)

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label:'Total', value: root.length, color: project.color },
          { label:'A fazer', value: todo, color: '#888780' },
          { label:'Em progresso', value: inProg, color: '#378ADD' },
          { label:'Concluído', value: done, color: '#1D9E75' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-bold" style={{color:s.color}}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress + GUT */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-600 mb-3">Progresso geral</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:project.color}}/>
            </div>
            <span className="text-sm font-bold text-gray-700">{pct}%</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">{done} de {root.length} tarefas concluídas</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-600 mb-2">GUT Score</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{color:tier.color}}>{project.gut.score}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{background:tier.bg,color:tier.color}}>{tier.label}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">G:{project.gut.g} · U:{project.gut.u} · T:{project.gut.t}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Upcoming */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-600 mb-3">Próximos prazos</p>
          {upcoming.length===0 ? (
            <p className="text-xs text-gray-400">Nenhuma tarefa com prazo</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(t=>(
                <button key={t.id} onClick={()=>setSelectedTask(t.id)}
                  className="w-full flex items-center gap-2 text-left hover:bg-gray-50 px-1 py-1 rounded-lg transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:project.color}}/>
                  <span className="flex-1 text-xs text-gray-700 truncate">{t.title}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(t.dueDate).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Overdue / Recent */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-600 mb-3">
            {overdue.length>0 ? `Atrasadas (${overdue.length})` : 'Atividade recente'}
          </p>
          {overdue.length>0 ? (
            <div className="space-y-2">
              {overdue.slice(0,5).map(t=>(
                <button key={t.id} onClick={()=>setSelectedTask(t.id)}
                  className="w-full flex items-center gap-2 text-left hover:bg-red-50 px-1 py-1 rounded-lg transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"/>
                  <span className="flex-1 text-xs text-gray-700 truncate">{t.title}</span>
                  <span className="text-[10px] text-red-400 flex-shrink-0">{new Date(t.dueDate).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(t=>(
                <button key={t.id} onClick={()=>setSelectedTask(t.id)}
                  className="w-full flex items-center gap-2 text-left hover:bg-gray-50 px-1 py-1 rounded-lg transition-colors">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.status==='done'?'bg-green-400':t.status==='in_progress'?'bg-blue-400':'bg-gray-300'}`}/>
                  <span className="flex-1 text-xs text-gray-700 truncate">{t.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Board (Kanban) ────────────────────────────────────────────────────────
function BoardView({ tasks, projectId, project }: { tasks: any[]; projectId: string; project: any }) {
  const { updateTask, setSelectedTask } = useAppStore()
  const cols: { status: 'todo'|'in_progress'|'done'; label: string; color: string }[] = [
    { status:'todo',        label:'A fazer',      color:'#888780' },
    { status:'in_progress', label:'Em progresso', color:'#378ADD' },
    { status:'done',        label:'Concluído',    color:'#1D9E75' },
  ]
  return (
    <div className="flex gap-4 p-4 overflow-x-auto flex-1">
      {cols.map(col => {
        const colTasks = tasks.filter(t=>t.status===col.status&&!t.parentId)
        return (
          <div key={col.status} className="flex flex-col gap-2 min-w-[240px] max-w-[280px] flex-shrink-0">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2 h-2 rounded-full" style={{background:col.color}}/>
              <span className="text-xs font-medium text-gray-600">{col.label}</span>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
            </div>
            <div className="flex flex-col gap-2 flex-1 bg-gray-50 rounded-xl p-2 min-h-[120px]"
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{const id=e.dataTransfer.getData('taskId');if(id)updateTask(id,{status:col.status})}}>
              {colTasks.length===0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-6 text-center border border-dashed border-gray-200 rounded-lg">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: col.color+'14' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }}/>
                  </span>
                  <p className="text-[10.5px] text-gray-400">Nenhuma tarefa aqui</p>
                </div>
              )}
              {colTasks.map(t=>(
                <div key={t.id} draggable
                  onDragStart={e=>e.dataTransfer.setData('taskId',t.id)}
                  onClick={()=>setSelectedTask(t.id)}
                  className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all group">
                  <p className="text-sm text-gray-800 mb-2 leading-5">{t.title}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-medium ${
                      t.priority==='urgent'?'text-red-500':t.priority==='high'?'text-orange-500':t.priority==='medium'?'text-blue-500':'text-gray-400'
                    }`}>{t.priority}</span>
                    {t.dueDate&&<span className="text-[10px] text-gray-400">{new Date(t.dueDate).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>}
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[9px] font-medium flex items-center justify-center">{t.assignee.slice(0,2)}</span>
                  </div>
                  {t.tags.length>0&&<div className="flex gap-1 mt-1.5">{t.tags.slice(0,2).map((tag:string)=><span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{tag}</span>)}</div>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Table view ────────────────────────────────────────────────────────────
function TableView({ tasks, project }: { tasks: any[]; project: any }) {
  const { setSelectedTask, updateTask } = useAppStore()
  const root = tasks.filter(t=>!t.parentId)
  if (root.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-16">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <Table2 size={17} className="text-gray-300"/>
        </div>
        <p className="text-sm font-medium text-gray-500">Nenhuma tarefa ainda</p>
        <p className="text-xs text-gray-400">As tarefas criadas neste projeto aparecerão aqui em formato de tabela.</p>
      </div>
    )
  }
  return (
    <div className="flex-1 overflow-auto p-4">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 text-gray-500 font-medium w-8">#</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium">Nome</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium w-28">Status</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium w-24">Prioridade</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium w-24">Responsável</th>
            <th className="text-left px-3 py-2 text-gray-500 font-medium w-24">Prazo</th>
            {project.columns.map((c:any)=><th key={c.id} className="text-left px-3 py-2 text-gray-500 font-medium" style={{width:c.width??100}}>{c.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {root.map((t,i)=>(
            <tr key={t.id} onClick={()=>setSelectedTask(t.id)}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
              <td className="px-3 py-2 text-gray-400">{i+1}</td>
              <td className="px-3 py-2 font-medium text-gray-800">{t.title}</td>
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
              {project.columns.map((c:any)=>(
                <td key={c.id} className="px-3 py-2 text-gray-500">{String(t.customFields?.[c.id]??'')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Calendar inline ────────────────────────────────────────────────────────
function CalendarInline({ tasks, projectId }: { tasks: any[]; projectId: string }) {
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

// ── Activity ──────────────────────────────────────────────────────────────
function ActivityView({ tasks, project }: { tasks: any[]; project: any }) {
  const { setSelectedTask } = useAppStore()
  const sorted = [...tasks].sort((a,b) => new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime())
  const statusColor: Record<string,string> = { todo:'#888780', in_progress:'#378ADD', done:'#1D9E75' }
  const statusLabel: Record<string,string> = { todo:'A fazer', in_progress:'Em progresso', done:'Concluído' }

  const formatRelative = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff/60000)
    const hrs  = Math.floor(diff/3600000)
    const days = Math.floor(diff/86400000)
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
          {/* Timeline line */}
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
            {sorted.length===0 && (
              <p className="text-sm text-gray-400 pl-10">Nenhuma atividade registrada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function DashboardView({ tasks, project }: { tasks: any[]; project: any }) {
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

        {/* Status distribution */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-4">Por status</h3>
          <div className="space-y-3">
            {[
              {label:'A fazer',      val:byStatus.todo,        color:'#888780'},
              {label:'Em progresso', val:byStatus.in_progress, color:'#378ADD'},
              {label:'Concluído',    val:byStatus.done,        color:'#1D9E75'},
            ].map(s=>(
              <div key={s.label}>
                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                  <span>{s.label}</span>
                  <span>{Math.round((s.val/total)*100)}%</span>
                </div>
                <Bar value={s.val} max={total} color={s.color}/>
              </div>
            ))}
          </div>
        </div>

        {/* Priority distribution */}
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
                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                  <span>{p.label}</span>
                  <span>{p.val}</span>
                </div>
                <Bar value={p.val} max={total} color={p.color}/>
              </div>
            ))}
          </div>
        </div>

        {/* Completion donut */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-5">
          <svg width={80} height={80} viewBox="0 0 80 80">
            <circle cx={40} cy={40} r={32} fill="none" stroke="#f1f1f0" strokeWidth={8}/>
            <circle cx={40} cy={40} r={32} fill="none"
              stroke={project.color} strokeWidth={8}
              strokeDasharray={`${2*Math.PI*32 * byStatus.done/total} ${2*Math.PI*32}`}
              strokeLinecap="round" transform="rotate(-90 40 40)"/>
            <text x={40} y={44} textAnchor="middle" fontSize={14} fontWeight={700} fill={project.color}>
              {Math.round(byStatus.done/total*100)}%
            </text>
          </svg>
          <div>
            <p className="text-xs font-semibold text-gray-700">Taxa de conclusão</p>
            <p className="text-[11px] text-gray-400 mt-1">{byStatus.done} de {root.length} tarefas concluídas</p>
          </div>
        </div>

        {/* Overdue */}
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

