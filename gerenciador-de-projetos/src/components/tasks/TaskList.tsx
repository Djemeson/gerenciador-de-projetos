import React, { useState } from 'react'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { TaskRow } from './TaskRow'
import { QuickAddRow } from './QuickAddRow'
import type { Task, TaskStatus } from '../../types'
import { STATUS_LABEL } from '../../types'

const STATUS_ORDER: TaskStatus[] = ['in_progress', 'todo', 'done']

interface TaskListProps {
  tasks: Task[]
  projectId?: string
  showProject?: boolean
  sortBy?: 'status' | 'priority' | 'dueDate' | 'project'
}

export function TaskList({ tasks, projectId, showProject = false, sortBy = 'status' }: TaskListProps) {
  const { projects, activeProjectId } = useAppStore()
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set(['done']))
  const [quickAdd,  setQuickAdd]      = useState<{ sectionKey: string; status: TaskStatus } | null>(null)

  const toggle = (key: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const resolvedProjectId = projectId ?? activeProjectId ?? projects[0]?.id ?? ''

  // Root tasks only (no subtarefas na lista principal)
  const rootTasks = tasks.filter(t => !t.parentId)

  if (sortBy === 'status') {
    const groups = STATUS_ORDER.map(status => ({
      status,
      label: STATUS_LABEL[status],
      items: rootTasks.filter(t => t.status === status),
    }))

    return (
      <div className="flex-1 overflow-y-auto">
        {groups.map(g => {
          if (g.items.length === 0 && g.status !== 'todo') return null
          const isCollapsed = collapsed.has(g.status)
          const isAdding    = quickAdd?.sectionKey === g.status
          return (
            <div key={g.status}>
              <SectionHeader
                label={g.label}
                count={g.items.length}
                collapsed={isCollapsed}
                onToggle={() => toggle(g.status)}
                onAdd={g.status !== 'done' ? () => setQuickAdd({ sectionKey: g.status, status: g.status }) : undefined}
              />
              {!isCollapsed && (
                <>
                  {g.items.map(t => (
                    <TaskRow key={t.id} task={t}
                      project={projects.find(p => p.id === t.projectId)}
                      showProject={showProject}
                    />
                  ))}
                  {isAdding && (
                    <QuickAddRow
                      projectId={resolvedProjectId}
                      status={g.status}
                      onDone={() => setQuickAdd(null)}
                    />
                  )}
                  {!isAdding && g.status !== 'done' && (
                    <button
                      onClick={() => setQuickAdd({ sectionKey: g.status, status: g.status })}
                      className="w-full flex items-center gap-2 px-5 py-2 text-xs text-gray-400 hover:text-brand-600 hover:bg-gray-50 transition-colors"
                    >
                      <Plus size={12} /> Adicionar tarefa
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (sortBy === 'priority') {
    const prioOrder = ['urgent','high','medium','low'] as const
    const prioLabel = { urgent:'Urgente', high:'Alta', medium:'Média', low:'Baixa' }
    return (
      <div className="flex-1 overflow-y-auto">
        {prioOrder.map(p => {
          const items = rootTasks.filter(t => t.priority === p && t.status !== 'done')
          if (!items.length) return null
          const isCollapsed = collapsed.has(p)
          const isAdding    = quickAdd?.sectionKey === p
          return (
            <div key={p}>
              <SectionHeader label={prioLabel[p]} count={items.length} collapsed={isCollapsed} onToggle={() => toggle(p)} onAdd={() => setQuickAdd({ sectionKey: p, status: 'todo' })} />
              {!isCollapsed && (
                <>
                  {items.map(t => <TaskRow key={t.id} task={t} project={projects.find(pr => pr.id === t.projectId)} showProject={showProject} />)}
                  {isAdding && <QuickAddRow projectId={resolvedProjectId} status="todo" onDone={() => setQuickAdd(null)} />}
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (sortBy === 'project') {
    return (
      <div className="flex-1 overflow-y-auto">
        {projects.map(proj => {
          const items = rootTasks.filter(t => t.projectId === proj.id && t.status !== 'done')
          if (!items.length) return null
          const isCollapsed = collapsed.has(proj.id)
          const isAdding    = quickAdd?.sectionKey === proj.id
          return (
            <div key={proj.id}>
              <SectionHeader label={proj.name} count={items.length} collapsed={isCollapsed} onToggle={() => toggle(proj.id)} color={proj.color} onAdd={() => setQuickAdd({ sectionKey: proj.id, status: 'todo' })} />
              {!isCollapsed && (
                <>
                  {items.map(t => <TaskRow key={t.id} task={t} project={proj} showProject={false} />)}
                  {isAdding && <QuickAddRow projectId={proj.id} status="todo" onDone={() => setQuickAdd(null)} />}
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // dueDate sort
  const sorted = [...rootTasks].filter(t => t.status !== 'done').sort((a, b) => {
    if (!a.dueDate) return 1; if (!b.dueDate) return -1
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })
  return (
    <div className="flex-1 overflow-y-auto">
      {sorted.map(t => <TaskRow key={t.id} task={t} project={projects.find(p => p.id === t.projectId)} showProject={showProject} />)}
    </div>
  )
}

function SectionHeader({ label, count, collapsed, onToggle, onAdd, color }: {
  label: string; count: number; collapsed: boolean; onToggle: () => void; onAdd?: () => void; color?: string
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-2 bg-white sticky top-0 z-10 border-b border-gray-100 group">
      <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
        {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      </button>
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{count}</span>
      <div className="flex-1 h-px bg-gray-100" />
      {onAdd && (
        <button onClick={onAdd} className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-600 transition-all">
          <Plus size={11} /> adicionar
        </button>
      )}
    </div>
  )
}
