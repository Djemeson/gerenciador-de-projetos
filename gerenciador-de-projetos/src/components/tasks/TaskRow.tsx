import React, { useState, useRef, useEffect } from 'react'
import { Calendar, AlertCircle, Check, ChevronRight, ChevronDown, GitBranch, Trash2 } from 'lucide-react'
import type { Task, Project, Priority, ColumnDef, TaskType } from '../../types'
import { PRIORITY_LABEL, TASK_TYPE_META } from '../../types'
import { useAppStore } from '../../stores/useAppStore'
import { QuickAddRow } from './QuickAddRow'
import { CustomFieldCell } from './CustomFieldCell'

const PRIORITY_CIRCLE: Record<Priority,{border:string;bg:string}> = {
  urgent: { border:'border-red-500',    bg:'bg-red-50'    },
  high:   { border:'border-orange-400', bg:'bg-orange-50' },
  medium: { border:'border-blue-400',   bg:''             },
  low:    { border:'border-gray-300',   bg:''             },
}

const TASK_TYPES: TaskType[] = ['task','milestone','meeting_note','bug','goal','objective','form_response','request']

interface TaskRowProps {
  task:         Task
  project?:     Project
  showProject?: boolean
  depth?:       number
  columns?:     ColumnDef[]
  selected?:    boolean
  onSelect?:    (id: string, e: React.MouseEvent) => void
}

export function TaskRow({ task, project, showProject=false, depth=0, columns=[], selected=false, onSelect }: TaskRowProps) {
  const { updateTask, deleteTask, setSelectedTask, selectedTaskId, tasks } = useAppStore()
  const [expanded,      setExpanded]      = useState(true)
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [confirmDel,    setConfirmDel]    = useState(false)
  const [typeOpen,      setTypeOpen]      = useState(false)
  const typeRef = useRef<HTMLDivElement>(null)

  const subtasks    = tasks.filter(t => t.parentId===task.id)
  const hasChildren = subtasks.length > 0
  const isSelected  = selectedTaskId===task.id
  const isDone      = task.status==='done'
  const isOverdue   = task.dueDate && !isDone && new Date(task.dueDate) < new Date()
  const indent      = depth * 20
  const circle      = isDone ? null : PRIORITY_CIRCLE[task.priority]
  const typeMeta    = TASK_TYPE_META[task.taskType ?? 'task']

  // Close type picker on outside click
  useEffect(() => {
    if (!typeOpen) return
    const handler = (e: MouseEvent) => { if (!typeRef.current?.contains(e.target as Node)) setTypeOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [typeOpen])

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateTask(task.id, { status: isDone ? 'todo' : 'done' })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault()
  }

  const handleClick = (e: React.MouseEvent) => {
    if (onSelect && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      onSelect(task.id, e); return
    }
    setSelectedTask(isSelected ? null : task.id)
  }

  const formatDate = (d: string) => {
    const dt=new Date(d); const today=new Date()
    const diff=Math.floor((dt.getTime()-today.setHours(0,0,0,0))/86400000)
    if(diff===0)return'Hoje'; if(diff===1)return'Amanhã'
    return dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})
  }

  return (
    <>
      <div
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        className={`flex items-center border-b border-gray-100 transition-colors group cursor-pointer
          ${selected  ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' :
            isSelected? 'bg-brand-50/60' :
            isDone    ? 'bg-gray-50/40 hover:bg-gray-50' : 'hover:bg-gray-50'}`}
        style={{ paddingLeft:`${16+indent}px`, minHeight:'36px' }}
      >
        {/* Expand */}
        <button onClick={e=>{e.stopPropagation();setExpanded(v=>!v)}}
          className={`w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1 ${hasChildren?'text-gray-400 hover:text-gray-600':'text-transparent pointer-events-none'}`}>
          {expanded?<ChevronDown size={11}/>:<ChevronRight size={11}/>}
        </button>

        {/* Status circle = task-type icon (merged, ClickUp-style) */}
        <div ref={typeRef} className="relative flex-shrink-0 mr-2 flex items-center">
          <button
            onClick={toggleDone}
            title={isDone ? 'Reabrir' : `${typeMeta.label} · concluir`}
            className={`group/st relative w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 transition-all hover:scale-110
              ${isDone
                ? 'bg-brand-500 border-brand-500'
                : `${circle?.border ?? 'border-gray-300'} ${circle?.bg ?? ''} hover:border-brand-400`}`}
          >
            {isDone ? (
              <Check size={10} className="text-white" strokeWidth={3}/>
            ) : (
              <>
                {task.taskType && task.taskType!=='task' && (
                  <span className="text-[10px] leading-none transition-opacity group-hover/st:opacity-0"
                    style={{ color: typeMeta.color }}>{typeMeta.symbol}</span>
                )}
                <Check size={10} strokeWidth={3}
                  className="absolute text-brand-400 opacity-0 transition-opacity group-hover/st:opacity-100"/>
              </>
            )}
          </button>

          {/* Type picker trigger (appears on row hover) */}
          <button
            onClick={e=>{e.stopPropagation();setTypeOpen(v=>!v)}}
            title={`Tipo: ${typeMeta.label}`}
            className="w-3 h-4 -ml-px flex items-center justify-center text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-all">
            <ChevronDown size={9}/>
          </button>

          {typeOpen && (
            <div className="absolute left-0 top-6 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 min-w-[190px]"
              onMouseDown={e=>e.stopPropagation()}>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-3 py-1">Tipo de tarefa</p>
              {TASK_TYPES.map(type => {
                const m = TASK_TYPE_META[type]
                return (
                  <button key={type} onClick={()=>{updateTask(task.id,{taskType:type});setTypeOpen(false)}}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 transition-colors">
                    <span className="w-5 h-5 rounded flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: m.bg, color: m.color }}>{m.symbol}</span>
                    <span className="text-xs text-gray-700">{m.label}</span>
                    {(task.taskType??'task')===type && <Check size={10} className="ml-auto text-brand-500"/>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {depth>0&&<GitBranch size={10} className="text-gray-300 flex-shrink-0 mr-1"/>}

        {/* Name */}
        <div className="flex-1 min-w-0 py-1 pr-2" style={{minWidth:120}}>
          <span className={`block text-sm truncate ${isDone?'line-through text-gray-400':'text-gray-800'}`}>{task.title}</span>
          {task.description&&!isDone&&<span className="block text-[11px] text-gray-400 truncate">{task.description}</span>}
          {hasChildren&&(
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
              <GitBranch size={9}/>{subtasks.filter(s=>s.status==='done').length}/{subtasks.length}
            </span>
          )}
        </div>

        {/* Fixed columns */}
        <div className="flex items-center flex-shrink-0">
          {/* Tags */}
          <div className="w-28 px-2 hidden lg:flex gap-1 flex-wrap">
            {task.tags.slice(0,2).map(t=>(
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 truncate max-w-[50px]">{t}</span>
            ))}
          </div>

          {/* Assignee */}
          <div className="w-20 px-2 hidden sm:flex items-center gap-1">
            <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[9px] font-medium flex items-center justify-center">
              {task.assignee.slice(0,2)}
            </span>
            <span className="text-xs text-gray-500 truncate">{task.assignee}</span>
          </div>

          {/* Due date */}
          <div className="w-24 px-2 hidden md:flex items-center">
            {task.dueDate?(
              <span className={`flex items-center gap-1 text-[11px] ${isOverdue?'text-red-500':'text-gray-400'}`}>
                {isOverdue?<AlertCircle size={10}/>:<Calendar size={10}/>}
                {formatDate(task.dueDate)}
              </span>
            ):<span className="text-gray-200 text-xs">—</span>}
          </div>

          {/* Priority label */}
          <div className="w-20 px-2 hidden md:flex items-center">
            <span className={`text-[11px] font-medium ${
              task.priority==='urgent'?'text-red-500':
              task.priority==='high'  ?'text-orange-500':
              task.priority==='medium'?'text-blue-500':'text-gray-400'}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
          </div>

          {/* Project badge */}
          {showProject&&project&&(
            <div className="w-24 px-2 hidden lg:flex items-center">
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium truncate"
                style={{background:project.color+'18',color:project.color}}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:project.color}}/>
                {project.name}
              </span>
            </div>
          )}

          {/* Custom columns */}
          {columns.map(col=>(
            <div key={col.id} className="px-2 flex items-center border-l border-gray-100" style={{width:col.width??100,minWidth:col.width??100}}>
              <CustomFieldCell task={task} column={col}/>
            </div>
          ))}

          {/* Actions on hover */}
          <div className="w-16 px-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {confirmDel?(
              <button onClick={e=>{e.stopPropagation();deleteTask(task.id)}}
                className="text-[10px] text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded animate-pulse">
                Del?
              </button>
            ):(
              <button onClick={e=>{e.stopPropagation();setConfirmDel(true);setTimeout(()=>setConfirmDel(false),2500)}}
                className="text-gray-300 hover:text-red-400 transition-colors" title="Deletar">
                <Trash2 size={12}/>
              </button>
            )}
            {!isDone&&(
              <button onClick={e=>{e.stopPropagation();setExpanded(true);setAddingSubtask(v=>!v)}}
                className="text-gray-300 hover:text-brand-500 text-sm font-light" title="Subtarefa">+</button>
            )}
          </div>
        </div>
      </div>

      {expanded&&(
        <>
          {subtasks.map(s=>(
            <TaskRow key={s.id} task={s} project={project} showProject={showProject}
              depth={depth+1} columns={columns} onSelect={onSelect} selected={selected}/>
          ))}
          {addingSubtask&&task.projectId&&(
            <div style={{paddingLeft:`${16+(depth+1)*20}px`}}>
              <QuickAddRow projectId={task.projectId} status={task.status==='done'?'todo':task.status} parentId={task.id} onDone={()=>setAddingSubtask(false)}/>
            </div>
          )}
        </>
      )}
    </>
  )
}
