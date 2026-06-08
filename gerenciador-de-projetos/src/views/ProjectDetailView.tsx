import React, { useState } from 'react'
import {
  Target, ChevronLeft, Archive, Trash2, AlertTriangle,
  LayoutGrid, Table2, Calendar, List, SlidersHorizontal, Sparkles, Columns,
  LayoutDashboard, Network, Activity, Eye, Plus, X, Check, ChevronDown,
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetail } from '../components/tasks/TaskDetail'
import { FilterPanel } from '../components/FilterPanel'
import { AIPanel } from '../components/AIPanel'
import { gutTier } from '../types'
import type { ViewType, TaskOpenMode, CustomProjectView } from '../types'

type SortBy = 'status' | 'priority' | 'dueDate'

export function ProjectDetailView() {
  const {
    activeProjectId, projects, tasks, selectedTaskId, openGUT, setView,
    archiveProject, deleteProject, setProjectView, setTaskOpenMode,
    openColumnsModal, openNewViewModal,
    filterPanelOpen, toggleFilterPanel, aiPanelOpen, toggleAIPanel,
    addCustomView, deleteCustomView, setSelectedTask,
  } = useAppStore()

  const [sortBy,         setSortBy]         = useState<SortBy>('status')
  const [confirmDel,     setConfirmDel]     = useState(false)
  const [activeCustomId, setActiveCustomId] = useState<string|null>(null)

  const project = projects.find(p => p.id === activeProjectId)
  if (!project) return null

  const projectTasks  = tasks.filter(t => t.projectId === project.id)
  const rootTasks     = projectTasks.filter(t => !t.parentId)
  const done  = rootTasks.filter(t => t.status === 'done').length
  const total = rootTasks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const tier  = gutTier(project.gut.score)
  const activeView   = project.activeView ?? 'list'
  const taskOpenMode = project.taskOpenMode ?? 'side'
  const customViews  = project.customViews ?? []

  // Which view is active
  const currentCustomView = activeCustomId ? customViews.find(v => v.id===activeCustomId) : null

  const VIEW_TABS: { key: ViewType; label: string; Icon: React.ElementType }[] = [
    { key:'overview',  label:'Overview',    Icon: Eye         },
    { key:'list',      label:'Tarefas',     Icon: List        },
    { key:'board',     label:'Board',       Icon: LayoutGrid  },
    { key:'table',     label:'Tabela',      Icon: Table2      },
    { key:'calendar',  label:'Calendário',  Icon: Calendar    },
    { key:'mindmap',   label:'Mapa mental', Icon: Network     },
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
    if (taskOpenMode === 'side' || taskOpenMode === 'full') {
      return <TaskDetail mode={taskOpenMode} onChangeMode={handleChangeMode}/>
    }
    // center is rendered as portal overlay inside TaskDetail
    return <TaskDetail mode="center" onChangeMode={handleChangeMode}/>
  }

  const mainContent = (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <button onClick={() => setView('projects')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ChevronLeft size={15}/>
          </button>
          <span className="w-3 h-3 rounded-full" style={{ background: project.color }}/>
          <h1 className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">{project.name}</h1>

          {/* Toolbar */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={toggleFilterPanel} title="Filtros"
              className={`p-1.5 rounded-lg transition-colors ${filterPanelOpen?'bg-brand-100 text-brand-600':'text-gray-400 hover:bg-gray-100'}`}>
              <SlidersHorizontal size={14}/>
            </button>
            <button onClick={() => openColumnsModal(project.id)} title="Campos personalizados"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Columns size={14}/>
            </button>
            <button onClick={toggleAIPanel} title="Pergunte à IA"
              className={`p-1.5 rounded-lg transition-colors ${aiPanelOpen?'bg-brand-100 text-brand-600':'text-gray-400 hover:bg-gray-100'}`}>
              <Sparkles size={14}/>
            </button>
            <button onClick={() => openGUT(project.id)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-colors hover:border-gray-300"
              style={{ background:tier.bg, color:tier.color, borderColor:tier.color+'33' }}>
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
              <button onClick={() => { setConfirmDel(true); setTimeout(()=>setConfirmDel(false),3000) }}
                className="flex items-center gap-1 text-xs px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                <Trash2 size={11}/> Deletar
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background:project.color }}/>
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">{done}/{total} · {pct}%</span>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {VIEW_TABS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => selectView(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0
                ${!activeCustomId && activeView===key
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
              <Icon size={12}/>{label}
            </button>
          ))}

          {/* Custom views */}
          {customViews.map(cv => (
            <div key={cv.id} className="flex items-center group/cv flex-shrink-0">
              <button onClick={() => { setActiveCustomId(cv.id); setProjectView(project.id, cv.baseType) }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-l-lg text-xs font-medium whitespace-nowrap transition-colors
                  ${activeCustomId===cv.id
                    ? 'bg-brand-50 text-brand-700 border border-brand-200 border-r-0'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
                <span>{cv.icon}</span>{cv.name}
              </button>
              <button onClick={() => { deleteCustomView(project.id, cv.id); if(activeCustomId===cv.id)setActiveCustomId(null) }}
                className="opacity-0 group-hover/cv:opacity-100 px-1 py-1.5 text-gray-300 hover:text-red-400 transition-all text-xs border-l-0">
                <X size={10}/>
              </button>
            </div>
          ))}

          {/* Add view */}
          <button onClick={() => openNewViewModal(project.id)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-1">
            <Plus size={11}/> Visualização
          </button>
        </div>

        {/* Sort (list/custom-list only) */}
        {(activeView==='list' || currentCustomView?.baseType==='list') && !['overview','mindmap','activity','dashboard'].includes(activeView) && (
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 mt-2 w-fit">
            {(['status','priority','dueDate'] as SortBy[]).map(s=>(
              <button key={s} onClick={()=>setSortBy(s)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${sortBy===s?'bg-white text-gray-800 font-medium shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                {{status:'Status',priority:'Prioridade',dueDate:'Prazo'}[s]}
              </button>
            ))}
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
          <TaskList tasks={projectTasks} projectId={project.id} columns={project.columns} sortBy={sortBy}/>
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
        {/* Mind map */}
        {activeView==='mindmap' && !activeCustomId && (
          <MindMapView tasks={projectTasks} project={project}/>
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
          return <TaskList tasks={filtered} projectId={project.id} columns={project.columns} sortBy={sortBy}/>
        })()}

        {filterPanelOpen && <FilterPanel/>}
        {aiPanelOpen && <AIPanel/>}

        {/* Side task detail */}
        {selectedTaskId && taskOpenMode==='side' && (
          <TaskDetail mode="side" onChangeMode={handleChangeMode}/>
        )}
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

// ── Helper: apply custom view filters ─────────────────────────────────────
function applyCustomViewFilter(tasks: any[], view: CustomProjectView): any[] {
  let result = tasks
  if (view.filterStatus && view.filterStatus !== 'all') {
    result = result.filter(t => t.status === view.filterStatus)
  }
  if (view.filterDaysBack) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - view.filterDaysBack)
    result = result.filter(t => new Date(t.updatedAt) >= cutoff)
  }
  return result
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
                <select value={t.status} onChange={e=>{e.stopPropagation();updateTask(t.id,{status:e.target.value as any})}} onClick={e=>e.stopPropagation()}
                  className="text-xs bg-transparent border-none outline-none cursor-pointer text-gray-600">
                  <option value="todo">A fazer</option>
                  <option value="in_progress">Em progresso</option>
                  <option value="done">Concluído</option>
                </select>
              </td>
              <td className="px-3 py-2">
                <span className={`text-[10px] font-medium ${t.priority==='urgent'?'text-red-500':t.priority==='high'?'text-orange-500':t.priority==='medium'?'text-blue-500':'text-gray-400'}`}>
                  {t.priority}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-600">{t.assignee}</td>
              <td className="px-3 py-2 text-gray-500">{t.dueDate?new Date(t.dueDate).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):''}</td>
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

// ── Mind Map ──────────────────────────────────────────────────────────────
function MindMapView({ tasks, project }: { tasks: any[]; project: any }) {
  const { setSelectedTask } = useAppStore()
  const rootTasks = tasks.filter(t => !t.parentId).slice(0, 20)
  const svgW = 900, svgH = 560
  const cx = svgW / 2, cy = svgH / 2
  const r = 180

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden w-full" style={{maxWidth:900}}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-500">Mapa mental — {project.name}</span>
          <span className="text-[10px] text-gray-400">{rootTasks.length} tarefas</span>
        </div>
        <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{minHeight:360}}>
          {/* Center node */}
          <ellipse cx={cx} cy={cy} rx={68} ry={26} fill={project.color} opacity={0.9}/>
          <text x={cx} y={cy+4} textAnchor="middle" fill="white" fontSize={11} fontWeight={600}>{project.name}</text>

          {rootTasks.map((t, i) => {
            const angle = (2 * Math.PI * i) / Math.max(rootTasks.length, 1) - Math.PI / 2
            const nx = cx + r * Math.cos(angle)
            const ny = cy + r * Math.sin(angle)
            const subtasks = tasks.filter(s => s.parentId === t.id)
            const isDone = t.status === 'done'
            const nodeColor = isDone ? '#1D9E75' : t.priority==='urgent' ? '#E24B4A' : t.priority==='high' ? '#D85A30' : '#6B5EE8'

            return (
              <g key={t.id}>
                {/* Line to center */}
                <line x1={cx} y1={cy} x2={nx} y2={ny}
                  stroke={nodeColor} strokeWidth={1.5} opacity={0.3} strokeDasharray={isDone?'0':'4 2'}/>

                {/* Task node */}
                <g onClick={() => setSelectedTask(t.id)} style={{cursor:'pointer'}}>
                  <ellipse cx={nx} cy={ny} rx={52} ry={20}
                    fill={isDone ? '#E1F5EE' : nodeColor + '18'}
                    stroke={nodeColor} strokeWidth={1.5}/>
                  <text x={nx} y={ny+4} textAnchor="middle" fill={isDone?'#1D9E75':nodeColor} fontSize={9.5} fontWeight={500}>
                    {t.title.length>14 ? t.title.slice(0,13)+'…' : t.title}
                  </text>
                  {isDone && (
                    <text x={nx+46} y={ny+5} fill="#1D9E75" fontSize={9}>✓</text>
                  )}
                </g>

                {/* Subtask mini-nodes */}
                {subtasks.slice(0,3).map((s, si) => {
                  const subAngle = angle + (si - subtasks.length/2 + 0.5) * 0.3
                  const sr = r + 80
                  const sx = cx + sr * Math.cos(subAngle)
                  const sy = cy + sr * Math.sin(subAngle)
                  return (
                    <g key={s.id}>
                      <line x1={nx} y1={ny} x2={sx} y2={sy} stroke="#ccc" strokeWidth={1} opacity={0.5}/>
                      <ellipse cx={sx} cy={sy} rx={36} ry={13} fill="#f9f9f9" stroke="#ddd" strokeWidth={1}/>
                      <text x={sx} y={sy+3.5} textAnchor="middle" fill="#888" fontSize={8}>
                        {s.title.length>10 ? s.title.slice(0,9)+'…' : s.title}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}

          {rootTasks.length === 0 && (
            <text x={cx} y={cy+55} textAnchor="middle" fill="#bbb" fontSize={11}>Nenhuma tarefa no projeto</text>
          )}
        </svg>
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
                  <span className="text-[9px] font-bold" style={{color:statusColor[t.status]}}>
                    {t.status==='done'?'✓':t.status==='in_progress'?'→':'○'}
                  </span>
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
                    {t.dueDate && <span className="text-[10px] text-gray-400">📅 {new Date(t.dueDate).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>}
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
            { label:'Total de tarefas', val:root.length, color:'#6B5EE8' },
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

// ── New View Modal (inside ProjectDetailView via store) ────────────────────
export function NewViewModal() {
  const { newViewModal, closeNewViewModal, projects, addCustomView } = useAppStore()
  const project = projects.find(p => p.id === newViewModal)
  const [name, setName] = useState('')
  const [baseType, setBaseType] = useState<'list'|'board'|'table'|'calendar'>('list')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [daysBack, setDaysBack] = useState<string>('')
  const [icon, setIcon] = useState('📋')

  if (!newViewModal || !project) return null

  const ICONS = ['📋','📊','📅','🎯','✅','🔥','⭐','📌']
  const BASE_TYPES: {key:'list'|'board'|'table'|'calendar'; label:string}[] = [
    {key:'list', label:'Lista'}, {key:'board', label:'Board'},
    {key:'table', label:'Tabela'}, {key:'calendar', label:'Calendário'},
  ]

  const save = () => {
    if (!name.trim()) return
    addCustomView(project.id, {
      name: name.trim(), icon, baseType,
      filterStatus: filterStatus !== 'all' ? filterStatus as any : undefined,
      filterDaysBack: daysBack ? parseInt(daysBack) : undefined,
    })
    setName(''); setIcon('📋'); setBaseType('list'); setFilterStatus('all'); setDaysBack('')
    closeNewViewModal()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={closeNewViewModal}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-[400px]" onClick={e=>e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Nova visualização</h2>

        {/* Icon + Name */}
        <div className="flex gap-2 mb-4">
          <div className="relative">
            <button className="w-10 h-10 border-2 border-gray-200 rounded-xl flex items-center justify-center text-lg hover:border-gray-300 transition-colors">
              {icon}
            </button>
            <select value={icon} onChange={e=>setIcon(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer">
              {ICONS.map(i=><option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <input autoFocus value={name} onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&save()}
            placeholder="Nome da visualização (ex: Apresentação)"
            className="flex-1 text-sm px-3 py-2 border-2 border-gray-200 rounded-xl outline-none focus:border-brand-400 transition-all"/>
        </div>

        {/* Base type */}
        <div className="mb-4">
          <label className="block text-[11px] font-medium text-gray-500 mb-2">Tipo base</label>
          <div className="grid grid-cols-4 gap-1.5">
            {BASE_TYPES.map(b=>(
              <button key={b.key} onClick={()=>setBaseType(b.key)}
                className={`py-2 text-xs rounded-lg border-2 transition-all ${baseType===b.key?'border-brand-400 bg-brand-50 text-brand-700 font-medium':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Filtrar por status</label>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none">
              <option value="all">Todos</option>
              <option value="todo">A fazer</option>
              <option value="in_progress">Em progresso</option>
              <option value="done">Concluído</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Últimos N dias</label>
            <input type="number" min={1} max={365} value={daysBack} onChange={e=>setDaysBack(e.target.value)}
              placeholder="ex: 7"
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none"/>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 mb-4">Ex: "Apresentação" → status: Concluído + últimos 7 dias</p>

        <div className="flex gap-2">
          <button onClick={closeNewViewModal} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={!name.trim()}
            className="flex-1 py-2.5 text-sm bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors font-medium">
            Criar visualização
          </button>
        </div>
      </div>
    </div>
  )
}
