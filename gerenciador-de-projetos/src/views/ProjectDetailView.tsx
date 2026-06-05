import React, { useState } from 'react'
import { Target, ChevronLeft, Archive, Trash2, AlertTriangle, LayoutGrid, Table2, Calendar, List, SlidersHorizontal, Sparkles, Columns } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetail } from '../components/tasks/TaskDetail'
import { FilterPanel } from '../components/FilterPanel'
import { AIPanel } from '../components/AIPanel'
import { gutTier } from '../types'
import type { ViewType } from '../types'

type SortBy = 'status' | 'priority' | 'dueDate'

const VIEW_ICONS: Record<ViewType, React.ElementType> = {
  list:     List,
  board:    LayoutGrid,
  table:    Table2,
  calendar: Calendar,
}

export function ProjectDetailView() {
  const { activeProjectId, projects, tasks, selectedTaskId, openGUT, setView,
          archiveProject, deleteProject, setProjectView, openColumnsModal,
          filterPanelOpen, toggleFilterPanel, aiPanelOpen, toggleAIPanel } = useAppStore()

  const [sortBy,     setSortBy]     = useState<SortBy>('status')
  const [confirmDel, setConfirmDel] = useState(false)

  const project = projects.find(p => p.id === activeProjectId)
  if (!project) return null

  const projectTasks = tasks.filter(t => t.projectId === project.id)
  const rootTasks    = projectTasks.filter(t => !t.parentId)
  const done  = rootTasks.filter(t => t.status === 'done').length
  const total = rootTasks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const tier  = gutTier(project.gut.score)
  const activeView = project.activeView ?? 'list'

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-5 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button onClick={() => setView('projects')} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronLeft size={15}/>
            </button>
            <span className="w-3 h-3 rounded-full" style={{ background: project.color }}/>
            <h1 className="text-sm font-semibold text-gray-900 flex-1">{project.name}</h1>

            {/* View selector */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {(['list','board','table','calendar'] as ViewType[]).map(v => {
                const Icon = VIEW_ICONS[v]
                return (
                  <button key={v} onClick={() => setProjectView(project.id, v)}
                    className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 text-xs
                      ${activeView===v?'bg-white text-gray-800 font-medium shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                    <Icon size={12}/>{v.charAt(0).toUpperCase()+v.slice(1)}
                  </button>
                )
              })}
            </div>

            {/* Sort (list only) */}
            {activeView==='list' && (
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {(['status','priority','dueDate'] as SortBy[]).map(s=>(
                  <button key={s} onClick={()=>setSortBy(s)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${sortBy===s?'bg-white text-gray-800 font-medium shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                    {{status:'Status',priority:'Prioridade',dueDate:'Prazo'}[s]}
                  </button>
                ))}
              </div>
            )}

            {/* Toolbar icons */}
            <button onClick={toggleFilterPanel} title="Filtros"
              className={`p-1.5 rounded-lg transition-colors ${filterPanelOpen?'bg-brand-100 text-brand-600':'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
              <SlidersHorizontal size={14}/>
            </button>
            <button onClick={() => openColumnsModal(project.id)} title="Colunas"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Columns size={14}/>
            </button>
            <button onClick={toggleAIPanel} title="Pergunte à IA"
              className={`p-1.5 rounded-lg transition-colors ${aiPanelOpen?'bg-brand-100 text-brand-600':'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
              <Sparkles size={14}/>
            </button>

            {/* GUT */}
            <button onClick={() => openGUT(project.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors hover:border-gray-300"
              style={{ background:tier.bg, color:tier.color, borderColor:tier.color+'33' }}>
              <Target size={11}/> GUT {project.gut.score} — {tier.label}
            </button>

            {/* Archive */}
            <button onClick={() => { archiveProject(project.id); setView('projects') }}
              className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
              <Archive size={11}/> Arquivar
            </button>

            {/* Delete */}
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

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background:project.color }}/>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{done}/{total} · {pct}%</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-[11px] text-gray-400">
            <span>G·Gravidade <strong className="text-gray-600">{project.gut.g}</strong></span>
            <span>U·Urgência <strong className="text-gray-600">{project.gut.u}</strong></span>
            <span>T·Tendência <strong className="text-gray-600">{project.gut.t}</strong></span>
          </div>
        </div>

        {/* View content */}
        <div className="flex flex-1 overflow-hidden">
          {activeView==='list' && (
            <TaskList tasks={projectTasks} projectId={project.id} columns={project.columns} sortBy={sortBy}/>
          )}
          {activeView==='board' && <BoardView tasks={projectTasks} projectId={project.id} project={project}/>}
          {activeView==='table' && <TableView tasks={projectTasks} project={project}/>}
          {activeView==='calendar' && <CalendarInline tasks={projectTasks} projectId={project.id}/>}
        </div>
      </div>

      {filterPanelOpen && <FilterPanel/>}
      {selectedTaskId && <TaskDetail/>}
      {aiPanelOpen && <AIPanel/>}
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
