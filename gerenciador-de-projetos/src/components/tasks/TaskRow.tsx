import React, { useState } from 'react'
import { Calendar, AlertCircle, Circle, CheckCircle2, ChevronRight, ChevronDown, GitBranch } from 'lucide-react'
import type { Task, Project } from '../../types'
import { PRIORITY_LABEL } from '../../types'
import { useAppStore } from '../../stores/useAppStore'
import { QuickAddRow } from './QuickAddRow'

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500', high: 'bg-orange-400', medium: 'bg-blue-400', low: 'bg-gray-300',
}

interface TaskRowProps {
  task: Task
  project?: Project
  showProject?: boolean
  depth?: number
}

export function TaskRow({ task, project, showProject = false, depth = 0 }: TaskRowProps) {
  const { updateTask, setSelectedTask, selectedTaskId, tasks } = useAppStore()
  const [expanded,     setExpanded]     = useState(true)
  const [addingSubtask, setAddingSubtask] = useState(false)

  const subtasks  = tasks.filter(t => t.parentId === task.id)
  const hasChildren = subtasks.length > 0
  const isSelected  = selectedTaskId === task.id
  const isDone      = task.status === 'done'
  const isOverdue   = task.dueDate && !isDone && new Date(task.dueDate) < new Date()

  const indent = depth * 20  // px por nível

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateTask(task.id, { status: isDone ? 'todo' : 'done' })
  }

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(v => !v)
  }

  const formatDate = (d: string) => {
    const dt = new Date(d); const today = new Date()
    const diff = Math.floor((dt.getTime() - today.setHours(0,0,0,0)) / 86400000)
    if (diff === 0) return 'Hoje'; if (diff === 1) return 'Amanhã'; if (diff === -1) return 'Ontem'
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <>
      <div
        onClick={() => setSelectedTask(isSelected ? null : task.id)}
        className={`flex items-center gap-2 py-2 pr-4 cursor-pointer border-b border-gray-100 transition-colors group
          ${isSelected ? 'bg-brand-50/60' : isDone ? 'bg-gray-50/40 hover:bg-gray-50' : 'hover:bg-gray-50'}`}
        style={{ paddingLeft: `${20 + indent}px` }}
      >
        {/* Expand / collapse arrow */}
        <button
          onClick={toggleExpand}
          className={`w-4 h-4 flex items-center justify-center flex-shrink-0 transition-colors
            ${hasChildren ? 'text-gray-400 hover:text-gray-600' : 'text-transparent'}`}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Done toggle */}
        <button onClick={toggleDone} className="flex-shrink-0 text-gray-300 hover:text-brand-500 transition-colors">
          {isDone ? <CheckCircle2 size={15} className="text-brand-500" /> : <Circle size={15} />}
        </button>

        {/* Subtask icon */}
        {depth > 0 && <GitBranch size={11} className="text-gray-300 flex-shrink-0" />}

        {/* Title */}
        <span className={`flex-1 text-sm leading-5 min-w-0 truncate
          ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.title}
        </span>

        {/* Project badge */}
        {showProject && project && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
            style={{ background: project.color + '18', color: project.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: project.color }} />
            {project.name}
          </span>
        )}

        {/* Tags */}
        {task.tags.slice(0,1).map(tag => (
          <span key={tag} className="hidden lg:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{tag}</span>
        ))}

        {/* Priority dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-gray-300'}`} title={PRIORITY_LABEL[task.priority]} />

        {/* Due date */}
        {task.dueDate && (
          <span className={`flex items-center gap-1 text-[11px] flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
            {isOverdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
            {formatDate(task.dueDate)}
          </span>
        )}

        {/* Assignee */}
        <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[9px] font-medium flex items-center justify-center flex-shrink-0">
          {task.assignee.slice(0,2)}
        </span>

        {/* Add subtask button (hover) */}
        {!isDone && (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(true); setAddingSubtask(v => !v) }}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-brand-500 transition-all flex-shrink-0 text-xs"
            title="Adicionar subtarefa"
          >
            +
          </button>
        )}
      </div>

      {/* Subtasks tree (recursive) */}
      {expanded && (
        <>
          {subtasks.map(s => (
            <TaskRow
              key={s.id}
              task={s}
              project={project}
              showProject={showProject}
              depth={depth + 1}
            />
          ))}
          {addingSubtask && task.projectId && (
            <div style={{ paddingLeft: `${20 + (depth + 1) * 20}px` }}>
              <QuickAddRow
                projectId={task.projectId}
                status={task.status === 'done' ? 'todo' : task.status}
                parentId={task.id}
                onDone={() => setAddingSubtask(false)}
              />
            </div>
          )}
        </>
      )}
    </>
  )
}
