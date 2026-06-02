import React, { useState } from 'react'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { TaskRow } from './TaskRow'
import type { Task, TaskStatus } from '../../types'
import { STATUS_LABEL } from '../../types'

const STATUS_ORDER: TaskStatus[] = ['in_progress', 'todo', 'done']

interface TaskListProps {
  tasks: Task[]
  showProject?: boolean
  title?: string
  sortBy?: 'status' | 'priority' | 'dueDate' | 'project'
}

export function TaskList({ tasks, showProject = false, title, sortBy = 'status' }: TaskListProps) {
  const { projects, openNewTask } = useAppStore()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['done']))

  const toggle = (key: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  if (sortBy === 'status') {
    const groups = STATUS_ORDER.map(status => ({
      status,
      label: STATUS_LABEL[status],
      items: tasks.filter(t => t.status === status),
    }))

    return (
      <div className="flex-1 overflow-y-auto">
        {groups.map(g => {
          if (g.items.length === 0 && g.status !== 'todo') return null
          const isCollapsed = collapsed.has(g.status)
          return (
            <div key={g.status}>
              <SectionHeader
                label={g.label}
                count={g.items.length}
                collapsed={isCollapsed}
                onToggle={() => toggle(g.status)}
                onAdd={g.status !== 'done' ? () => openNewTask() : undefined}
              />
              {!isCollapsed && g.items.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  project={projects.find(p => p.id === t.projectId)}
                  showProject={showProject}
                />
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  if (sortBy === 'priority') {
    type PrioGroup = { label: string; items: Task[] }
    const prioOrder = ['urgent', 'high', 'medium', 'low'] as const
    const prioLabel = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' }
    const groups: PrioGroup[] = prioOrder.map(p => ({
      label: prioLabel[p],
      items: tasks.filter(t => t.priority === p && t.status !== 'done'),
    }))

    return (
      <div className="flex-1 overflow-y-auto">
        {groups.map(g => {
          if (g.items.length === 0) return null
          const isCollapsed = collapsed.has(g.label)
          return (
            <div key={g.label}>
              <SectionHeader label={g.label} count={g.items.length} collapsed={isCollapsed} onToggle={() => toggle(g.label)} />
              {!isCollapsed && g.items.map(t => (
                <TaskRow key={t.id} task={t} project={projects.find(p => p.id === t.projectId)} showProject={showProject} />
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  if (sortBy === 'project') {
    const byProject = projects.map(p => ({
      project: p,
      items: tasks.filter(t => t.projectId === p.id && t.status !== 'done'),
    })).filter(g => g.items.length > 0)

    return (
      <div className="flex-1 overflow-y-auto">
        {byProject.map(g => {
          const isCollapsed = collapsed.has(g.project.id)
          return (
            <div key={g.project.id}>
              <SectionHeader
                label={g.project.name}
                count={g.items.length}
                collapsed={isCollapsed}
                onToggle={() => toggle(g.project.id)}
                color={g.project.color}
              />
              {!isCollapsed && g.items.map(t => (
                <TaskRow key={t.id} task={t} project={g.project} showProject={false} />
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  // dueDate sort
  const sorted = [...tasks].filter(t => t.status !== 'done').sort((a, b) => {
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })

  return (
    <div className="flex-1 overflow-y-auto">
      {sorted.map(t => (
        <TaskRow key={t.id} task={t} project={projects.find(p => p.id === t.projectId)} showProject={showProject} />
      ))}
    </div>
  )
}

function SectionHeader({
  label, count, collapsed, onToggle, onAdd, color,
}: {
  label: string; count: number; collapsed: boolean; onToggle: () => void; onAdd?: () => void; color?: string
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-2 bg-white sticky top-0 z-10 border-b border-gray-100 group">
      <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 transition-colors">
        {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      </button>
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{count}</span>
      <div className="flex-1 h-px bg-gray-100" />
      {onAdd && (
        <button
          onClick={onAdd}
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-600 transition-all"
        >
          <Plus size={11} /> adicionar
        </button>
      )}
    </div>
  )
}
