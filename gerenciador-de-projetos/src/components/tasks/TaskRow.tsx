import React from 'react'
import { Calendar, AlertCircle, Circle, CheckCircle2 } from 'lucide-react'
import type { Task, Project } from '../../types'
import { PRIORITY_LABEL } from '../../types'
import { useAppStore } from '../../stores/useAppStore'

const PRIORITY_STYLE = {
  urgent: { dot: 'bg-red-500',    text: 'text-red-600',   bg: 'bg-red-50   text-red-700'   },
  high:   { dot: 'bg-orange-400', text: 'text-orange-600',bg: 'bg-orange-50 text-orange-700'},
  medium: { dot: 'bg-blue-400',   text: 'text-blue-600',  bg: 'bg-blue-50   text-blue-700'  },
  low:    { dot: 'bg-gray-300',   text: 'text-gray-500',  bg: 'bg-gray-100  text-gray-600'  },
}

interface TaskRowProps {
  task: Task
  project?: Project
  showProject?: boolean
  isSelected?: boolean
}

export function TaskRow({ task, project, showProject = false, isSelected = false }: TaskRowProps) {
  const { updateTask, setSelectedTask, selectedTaskId } = useAppStore()

  const sel = isSelected || selectedTaskId === task.id

  const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date()
  const isDone    = task.status === 'done'
  const pStyle    = PRIORITY_STYLE[task.priority]

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateTask(task.id, { status: isDone ? 'todo' : 'done' })
  }

  const formatDate = (d: string) => {
    const dt = new Date(d)
    const today = new Date()
    const diff = Math.floor((dt.getTime() - today.setHours(0,0,0,0)) / 86400000)
    if (diff === 0)  return 'Hoje'
    if (diff === 1)  return 'Amanhã'
    if (diff === -1) return 'Ontem'
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <div
      onClick={() => setSelectedTask(sel ? null : task.id)}
      className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer border-b border-gray-100 transition-colors group
        ${sel ? 'bg-brand-50/60' : isDone ? 'bg-gray-50/50 hover:bg-gray-50' : 'hover:bg-gray-50'}`}
    >
      {/* Check */}
      <button onClick={toggleDone} className="flex-shrink-0 text-gray-300 hover:text-brand-500 transition-colors">
        {isDone
          ? <CheckCircle2 size={16} className="text-brand-500" />
          : <Circle size={16} />}
      </button>

      {/* Title */}
      <span className={`flex-1 text-sm leading-5 min-w-0 truncate
        ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {task.title}
      </span>

      {/* Project badge (cross-project view) */}
      {showProject && project && (
        <span
          className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
          style={{ background: project.color + '18', color: project.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: project.color }} />
          {project.name}
        </span>
      )}

      {/* Tags */}
      {task.tags.slice(0, 2).map(tag => (
        <span key={tag} className="hidden lg:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
          {tag}
        </span>
      ))}

      {/* Priority dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pStyle.dot}`} title={PRIORITY_LABEL[task.priority]} />

      {/* Due date */}
      {task.dueDate && (
        <span className={`flex items-center gap-1 text-[11px] flex-shrink-0
          ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
          {isOverdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
          {formatDate(task.dueDate)}
        </span>
      )}

      {/* Assignee */}
      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[9px] font-medium flex items-center justify-center flex-shrink-0">
        {task.assignee.slice(0, 2)}
      </span>
    </div>
  )
}
