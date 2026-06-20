import React, { useState } from 'react'
import {
  Eye, List, LayoutGrid, Table2, Calendar, Network, Activity, LayoutDashboard,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { TaskList } from './TaskList'
import { TaskDetail } from './TaskDetail'
import { FilterPanel } from '../FilterPanel'
import { AIPanel } from '../AIPanel'
import type { Task, ColumnDef, ViewType } from '../../types'

export type GroupBy = 'status' | 'priority' | 'dueDate' | 'assignee' | 'project'

const GROUP_LABEL: Record<GroupBy, string> = {
  status: 'Status', priority: 'Prioridade', dueDate: 'Prazo', assignee: 'Responsável', project: 'Projeto',
}

const ALL_VIEWS: { key: ViewType; label: string; Icon: React.ElementType }[] = [
  { key:'overview',  label:'Overview',    Icon: Eye },
  { key:'list',      label:'Tarefas',     Icon: List },
  { key:'board',     label:'Board',       Icon: LayoutGrid },
  { key:'table',     label:'Tabela',      Icon: Table2 },
  { key:'calendar',  label:'Calendário',  Icon: Calendar },
  { key:'mindmap',   label:'Mapa mental', Icon: Network },
  { key:'activity',  label:'Atividade',   Icon: Activity },
  { key:'dashboard', label:'Painéis',     Icon: LayoutDashboard },
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
  scopeKey, tasks, title, accent = '#7B68EE', icon, breadcrumb, headerRight, toolbarExtra,
  columns = [], defaultProjectId, showProject = false,
  groupOptions = ['status','priority','dueDate','assignee'],
  defaultGroup = 'status', views, defaultView = 'list', gut,
}: TaskPanelProps) {
  const { selectedTaskId } = useAppStore()
  const tabs = (views ? ALL_VIEWS.filter(v => views.includes(v.key)) : ALL_VIEWS)

  const [view,  setView]  = useState<ViewType>(() => vGet(scopeKey+'_view', defaultView) as ViewType)
  const [group, setGroup] = useState<GroupBy>(() => vGet(scopeKey+'_group', defaultGroup) as GroupBy)

  const selectView  = (v: ViewType) => { setView(v); vSet(scopeKey+'_view', v) }
  const selectGroup = (g: GroupBy)  => { setGroup(g); vSet(scopeKey+'_group', g) }

  const root  = tasks.filter(t => !t.parentId)
  const done  = root.filter(t => t.status === 'done').length
  const total = root.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          {/* Breadcrumb + title + toolbar */}
          <div className="px-4 pt-3 pb-0 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-[13px] min-w-0">
              {breadcrumb}
              {icon}
              <h1 className="font-semibold text-gray-900 truncate min-w-0">{title}</h1>
              <span className="text-[11px] text-gray-400 flex-shrink-0">· {total} {total===1?'tarefa':'tarefas'}</span>
            </div>
            {headerRight && <div className="flex items-center gap-1 flex-shrink-0">{headerRight}</div>}
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 px-4 mt-2">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }}/>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{done}/{total} · {pct}%</span>
          </div>

          {/* View tabs */}
          <div className="flex items-center overflow-x-auto scrollbar-none px-3 mt-1">
            {tabs.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => selectView(key)}
                className={`flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 border-b-2 -mb-px
                  ${view===key ? 'text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'}`}
                style={view===key ? { borderColor: accent, color: accent } : undefined}>
                <Icon size={12}/>{label}
              </button>
            ))}
          </div>

          {/* Group control (list only) */}
          {view==='list' && (
            <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
              <span className="text-[11px] text-gray-400">Agrupar por</span>
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {groupOptions.map(g => (
                  <button key={g} onClick={() => selectGroup(g)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${group===g?'bg-white text-gray-800 font-medium shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                    {GROUP_LABEL[g]}
                  </button>
                ))}
              </div>
              {toolbarExtra}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {view==='overview'  && <OverviewView  tasks={tasks} accent={accent} pct={pct} gut={gut}/>}
          {view==='list'      && <TaskList tasks={tasks} projectId={defaultProjectId} scopeKey={scopeKey} columns={columns} showProject={showProject} sortBy={group}/>}
          {view==='board'     && <BoardView     tasks={tasks}/>}
          {view==='table'     && <TableView     tasks={tasks} columns={columns} showProject={showProject}/>}
          {view==='calendar'  && <CalendarInline tasks={tasks}/>}
          {view==='mindmap'   && <MindMapView   tasks={tasks} title={title} accent={accent}/>}
          {view==='activity'  && <ActivityView  tasks={tasks}/>}
          {view==='dashboard' && <DashboardView tasks={tasks} accent={accent}/>}

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
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label:'Total', value: root.length, color: accent },
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

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-600 mb-3">Progresso geral</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:accent}}/>
            </div>
            <span className="text-sm font-bold text-gray-700">{pct}%</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">{done} de {root.length} tarefas concluídas</p>
        </div>
        {gut && (
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-600 mb-2">GUT Score</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold" style={{color:accent}}>{gut.score}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">G:{gut.g} · U:{gut.u} · T:{gut.t}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-600 mb-3">Próximos prazos</p>
          {upcoming.length===0 ? (
            <p className="text-xs text-gray-400">Nenhuma tarefa com prazo</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(t=>(
                <button key={t.id} onClick={()=>setSelectedTask(t.id)}
                  className="w-full flex items-center gap-2 text-left hover:bg-gray-50 px-1 py-1 rounded-lg transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:accent}}/>
                  <span className="flex-1 text-xs text-gray-700 truncate">{t.title}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(t.dueDate as string).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
                  <span className="text-[10px] text-red-400 flex-shrink-0">{new Date(t.dueDate as string).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>
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

// ── Board ───────────────────────────────────────────────────────────────────
function BoardView({ tasks }: { tasks: Task[] }) {
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

// ── Mind map ────────────────────────────────────────────────────────────────
function MindMapView({ tasks, title, accent }: { tasks: Task[]; title: string; accent: string }) {
  const { setSelectedTask } = useAppStore()
  const rootTasks = tasks.filter(t => !t.parentId).slice(0, 20)
  const svgW = 900, svgH = 560
  const cx = svgW / 2, cy = svgH / 2
  const r = 180
  return (
    <div className="flex-1 overflow-auto bg-gray-50/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden w-full" style={{maxWidth:900}}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-500">Mapa mental — {title}</span>
          <span className="text-[10px] text-gray-400">{rootTasks.length} tarefas</span>
        </div>
        <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{minHeight:360}}>
          <ellipse cx={cx} cy={cy} rx={68} ry={26} fill={accent} opacity={0.9}/>
          <text x={cx} y={cy+4} textAnchor="middle" fill="white" fontSize={11} fontWeight={600}>{title.length>16?title.slice(0,15)+'…':title}</text>
          {rootTasks.map((t, i) => {
            const angle = (2 * Math.PI * i) / Math.max(rootTasks.length, 1) - Math.PI / 2
            const nx = cx + r * Math.cos(angle)
            const ny = cy + r * Math.sin(angle)
            const subtasks = tasks.filter(s => s.parentId === t.id)
            const isDone = t.status === 'done'
            const nodeColor = isDone ? '#1D9E75' : t.priority==='urgent' ? '#E24B4A' : t.priority==='high' ? '#D85A30' : '#6B5EE8'
            return (
              <g key={t.id}>
                <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={nodeColor} strokeWidth={1.5} opacity={0.3} strokeDasharray={isDone?'0':'4 2'}/>
                <g onClick={() => setSelectedTask(t.id)} style={{cursor:'pointer'}}>
                  <ellipse cx={nx} cy={ny} rx={52} ry={20} fill={isDone ? '#E1F5EE' : nodeColor + '18'} stroke={nodeColor} strokeWidth={1.5}/>
                  <text x={nx} y={ny+4} textAnchor="middle" fill={isDone?'#1D9E75':nodeColor} fontSize={9.5} fontWeight={500}>
                    {t.title.length>14 ? t.title.slice(0,13)+'…' : t.title}
                  </text>
                  {isDone && (<text x={nx+46} y={ny+5} fill="#1D9E75" fontSize={9}>✓</text>)}
                </g>
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
          {rootTasks.length === 0 && (<text x={cx} y={cy+55} textAnchor="middle" fill="#bbb" fontSize={11}>Nenhuma tarefa</text>)}
        </svg>
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
