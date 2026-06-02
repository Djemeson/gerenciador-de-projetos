import React from 'react'
import {
  X, Calendar, Tag, User, Flag, Folder,
  Plus, Trash2, CheckSquare,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { PRIORITY_LABEL, STATUS_LABEL } from '../../types'
import type { Priority, TaskStatus } from '../../types'
import { Button } from '../ui'
import { nanoid } from '../../lib/nanoid'

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: 'text-red-600 bg-red-50 border-red-200',
  high:   'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-blue-600 bg-blue-50 border-blue-200',
  low:    'text-gray-500 bg-gray-50 border-gray-200',
}

export function TaskDetail() {
  const { tasks, projects, selectedTaskId, setSelectedTask, updateTask, deleteTask, toggleSubtask } = useAppStore()

  const task    = tasks.find(t => t.id === selectedTaskId)
  const project = task ? projects.find(p => p.id === task.projectId) : undefined

  if (!task) return null

  const done      = task.subtasks.filter(s => s.done).length
  const total     = task.subtasks.length
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0

  const addSubtask = () => {
    const title = window.prompt('Nome da subtarefa:')
    if (!title?.trim()) return
    updateTask(task.id, {
      subtasks: [...task.subtasks, { id: nanoid(), title: title.trim(), done: false }]
    })
  }

  const removeSubtask = (id: string) => {
    updateTask(task.id, { subtasks: task.subtasks.filter(s => s.id !== id) })
  }

  return (
    <aside className="w-80 min-w-[320px] border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {project && (
            <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
          )}
          <span className="text-xs text-gray-500 truncate max-w-[200px]">{project?.name ?? 'Sem projeto'}</span>
        </div>
        <button onClick={() => setSelectedTask(null)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <h2 className="text-sm font-medium text-gray-900 leading-5">{task.title}</h2>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-gray-500 leading-relaxed">{task.description}</p>
        )}

        {/* Fields grid */}
        <div className="space-y-2.5">
          <Field icon={<Flag size={13} />} label="Prioridade">
            <select
              value={task.priority}
              onChange={e => updateTask(task.id, { priority: e.target.value as Priority })}
              className={`text-xs px-2 py-1 rounded-md border font-medium cursor-pointer outline-none ${PRIORITY_COLORS[task.priority]}`}
            >
              {(['urgent','high','medium','low'] as Priority[]).map(p => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </Field>

          <Field icon={<CheckSquare size={13} />} label="Status">
            <select
              value={task.status}
              onChange={e => updateTask(task.id, { status: e.target.value as TaskStatus })}
              className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-700 cursor-pointer outline-none"
            >
              {(['todo','in_progress','done'] as TaskStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>

          <Field icon={<Calendar size={13} />} label="Prazo">
            <input
              type="date"
              value={task.dueDate ?? ''}
              onChange={e => updateTask(task.id, { dueDate: e.target.value || null })}
              className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-700 outline-none"
            />
          </Field>

          <Field icon={<User size={13} />} label="Responsável">
            <input
              type="text"
              value={task.assignee}
              onChange={e => updateTask(task.id, { assignee: e.target.value })}
              className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-700 outline-none w-24"
            />
          </Field>

          {task.tags.length > 0 && (
            <Field icon={<Tag size={13} />} label="Tags">
              <div className="flex flex-wrap gap-1">
                {task.tags.map(t => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{t}</span>
                ))}
              </div>
            </Field>
          )}
        </div>

        {/* Subtasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">
              Subtarefas {total > 0 && <span className="text-gray-400">{done}/{total}</span>}
            </span>
            <button onClick={addSubtask} className="text-gray-400 hover:text-brand-600 transition-colors">
              <Plus size={13} />
            </button>
          </div>

          {total > 0 && (
            <div className="h-1 bg-gray-100 rounded-full mb-3 overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}

          <div className="space-y-1">
            {task.subtasks.map(s => (
              <div key={s.id} className="flex items-center gap-2 group py-1">
                <button
                  onClick={() => toggleSubtask(task.id, s.id)}
                  className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 transition-colors
                    ${s.done ? 'bg-brand-500 border-brand-500' : 'border-gray-300 hover:border-brand-400'}`}
                />
                <span className={`flex-1 text-xs ${s.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {s.title}
                </span>
                <button
                  onClick={() => removeSubtask(s.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3 flex gap-2">
        <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => deleteTask(task.id)} className="flex-1">
          Excluir
        </Button>
      </div>
    </aside>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 flex-shrink-0">{icon}</span>
      <span className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</span>
      {children}
    </div>
  )
}
