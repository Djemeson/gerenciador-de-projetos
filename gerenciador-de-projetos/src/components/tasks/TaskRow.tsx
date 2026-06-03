import React, { useState } from 'react'
import { Calendar, AlertCircle, Check, ChevronRight, ChevronDown, GitBranch } from 'lucide-react'
import type { Task, Project, Priority } from '../../types'
import { PRIORITY_LABEL } from '../../types'
import { useAppStore } from '../../stores/useAppStore'
import { QuickAddRow } from './QuickAddRow'

// Círculos visuais de prioridade — borda colorida + preenchimento leve
const PRIORITY_CIRCLE: Record<Priority, { border: string; bg: string; dot: string }> = {
  urgent: { border: 'border-red-500',    bg: 'bg-red-50',     dot: 'bg-red-500'    },
  high:   { border: 'border-orange-400', bg: 'bg-orange-50',  dot: 'bg-orange-400' },
  medium: { border: 'border-blue-400',   bg: '',              dot: 'bg-blue-400'   },
  low:    { border: 'border-gray-300',   bg: '',              dot: 'bg-gray-300'   },
}

interface TaskRowProps {
  task:         Task
  project?:     Project
  showProject?: boolean
  depth?:       number
  selected?:    boolean
  onSelect?:    (id: string, e: React.MouseEvent) => void
}

export function TaskRow({ task, project, showProject = false, depth = 0, selected = false, onSelect }: TaskRowProps) {
  const { updateTask, setSelectedTask, selectedTaskId, tasks } = useAppStore()
  const [expanded,      setExpanded]      = useState(true)
  const [addingSubtask, setAddingSubtask] = useState(false)

  const subtasks    = tasks.filter(t => t.parentId === task.id)
  const hasChildren = subtasks.length > 0
  const isSelected  = selectedTaskId === task.id
  const isDone      = task.status === 'done'
  const isOverdue   = task.dueDate && !isDone && new Date(task.dueDate) < new Date()
  const isMultiSel  = selected
  const indent      = depth * 20

  const circle = isDone ? null : PRIORITY_CIRCLE[task.priority]

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateTask(task.id, { status: isDone ? 'todo' : 'done' })
  }

  const handleClick = (e: React.MouseEvent) => {
    if (onSelect && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.preventDefault(); onSelect(task.id, e); return
    }
    setSelectedTask(isSelected ? null : task.id)
  }

  const formatDate = (d: string) => {
    const dt = new Date(d); const today = new Date()
    const diff = Math.floor((dt.getTime() - today.setHours(0,0,0,0)) / 86400000)
    if (diff === 0) return 'Hoje'; if (diff === 1) return 'Amanhã'
    return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })
  }

  const doneSubs  = subtasks.filter(s => s.status === 'done').length

  return (
    <>
      <div
        onClick={handleClick}
        className={`flex items-center gap-2 py-1.5 pr-4 cursor-pointer border-b border-gray-100 transition-colors group
          ${isMultiSel  ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' :
            isSelected  ? 'bg-brand-50/60' :
            isDone      ? 'bg-gray-50/40 hover:bg-gray-50' : 'hover:bg-gray-50'}`}
        style={{ paddingLeft: `${20 + indent}px` }}
      >
        {/* Expand arrow */}
        <button onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          className={`w-4 h-4 flex items-center justify-center flex-shrink-0 ${hasChildren ? 'text-gray-400 hover:text-gray-600' : 'text-transparent pointer-events-none'}`}>
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>

        {/* Priority circle (check button) */}
        <button
          onClick={toggleDone}
          title={isDone ? 'Marcar como pendente' : PRIORITY_LABEL[task.priority]}
          className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all
            ${isDone
              ? 'bg-brand-500 border-brand-500'
              : `${circle?.border} ${circle?.bg} hover:scale-110`
            }`}
        >
          {isDone && <Check size={9} className="text-white" strokeWidth={3} />}
        </button>

        {/* Subtask icon */}
        {depth > 0 && <GitBranch size={10} className="text-gray-300 flex-shrink-0" />}

        {/* Title + description */}
        <div className="flex-1 min-w-0 py-0.5">
          <span className={`block text-sm leading-5 truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </span>
          {task.description && !isDone && (
            <span className="block text-[11px] text-gray-400 truncate leading-4">{task.description}</span>
          )}
        </div>

        {/* Subtask count */}
        {hasChildren && (
          <span className="hidden sm:flex items-center gap-0.5 text-[10px] text-gray-400 flex-shrink-0">
            <GitBranch size={9} /> {doneSubs}/{subtasks.length}
          </span>
        )}

        {/* Project badge */}
        {showProject && project && (
          <span className="hidden md:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
            style={{ background: project.color + '18', color: project.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: project.color }} />{project.name}
          </span>
        )}

        {/* Tags */}
        {task.tags.slice(0,1).map(tag => (
          <span key={tag} className="hidden lg:inline text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{tag}</span>
        ))}

        {/* Due date */}
        {task.dueDate && (
          <span className={`flex items-center gap-0.5 text-[10px] flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
            {isOverdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
            {formatDate(task.dueDate)}
          </span>
        )}

        {/* Assignee */}
        <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[9px] font-medium flex items-center justify-center flex-shrink-0">
          {task.assignee.slice(0,2)}
        </span>

        {/* Add subtask on hover */}
        {!isDone && (
          <button onClick={e => { e.stopPropagation(); setExpanded(true); setAddingSubtask(v => !v) }}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-brand-500 transition-all text-sm font-light flex-shrink-0"
            title="Adicionar subtarefa">+</button>
        )}
      </div>

      {/* Subtree */}
      {expanded && (
        <>
          {subtasks.map(s => (
            <TaskRow key={s.id} task={s} project={project} showProject={showProject} depth={depth + 1} onSelect={onSelect} />
          ))}
          {addingSubtask && task.projectId && (
            <div style={{ paddingLeft: `${20 + (depth + 1) * 20}px` }}>
              <QuickAddRow projectId={task.projectId} status={task.status === 'done' ? 'todo' : task.status} parentId={task.id} onDone={() => setAddingSubtask(false)} />
            </div>
          )}
        </>
      )}
    </>
  )
}
