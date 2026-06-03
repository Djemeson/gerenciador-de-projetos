import React, { useState, useCallback } from 'react'
import { Plus, ChevronDown, ChevronRight, Trash2, CheckSquare, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { TaskRow } from './TaskRow'
import { QuickAddRow } from './QuickAddRow'
import type { Task, TaskStatus, Priority } from '../../types'
import { STATUS_LABEL, PRIORITY_LABEL } from '../../types'

const STATUS_ORDER: TaskStatus[] = ['in_progress', 'todo', 'done']

interface TaskListProps {
  tasks:        Task[]
  projectId?:   string
  showProject?: boolean
  sortBy?:      'status' | 'priority' | 'dueDate' | 'project'
}

export function TaskList({ tasks, projectId, showProject = false, sortBy = 'status' }: TaskListProps) {
  const { projects, activeProjectId, deleteTask, updateTask } = useAppStore()
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set(['done']))
  const [quickAdd,     setQuickAdd]     = useState<{ sectionKey: string; status: TaskStatus } | null>(null)
  const [selectedIds,  setSelectedIds]  = useState<string[]>([])
  const [lastSelected, setLastSelected] = useState<string | null>(null)

  const rootTasks = tasks.filter(t => !t.parentId)

  const resolvedProject = projectId ?? activeProjectId ?? projects[0]?.id ?? ''

  const toggle = (key: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // Multi-select handler
  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelected) {
      // Range select
      const flat = rootTasks.map(t => t.id)
      const a = flat.indexOf(lastSelected), b = flat.indexOf(id)
      const range = flat.slice(Math.min(a,b), Math.max(a,b)+1)
      setSelectedIds(prev => [...new Set([...prev, ...range])])
    } else {
      // Toggle
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
      setLastSelected(id)
    }
  }, [rootTasks, lastSelected])

  const clearSelection = () => { setSelectedIds([]); setLastSelected(null) }

  const bulkDelete  = () => { selectedIds.forEach(id => deleteTask(id)); clearSelection() }
  const bulkStatus  = (s: TaskStatus) => { selectedIds.forEach(id => updateTask(id, { status: s })); clearSelection() }
  const bulkPriority= (p: Priority)   => { selectedIds.forEach(id => updateTask(id, { priority: p })); clearSelection() }
  const bulkMove    = (pid: string)   => { selectedIds.forEach(id => updateTask(id, { projectId: pid })); clearSelection() }

  const renderGroup = (groupKey: string, label: string, items: Task[], status: TaskStatus, color?: string) => {
    const isCollapsed = collapsed.has(groupKey)
    const isAdding    = quickAdd?.sectionKey === groupKey
    return (
      <div key={groupKey}>
        <SectionHeader label={label} count={items.length} collapsed={isCollapsed} onToggle={() => toggle(groupKey)}
          color={color} onAdd={status !== 'done' ? () => setQuickAdd({ sectionKey: groupKey, status }) : undefined} />
        {!isCollapsed && (
          <>
            {items.map(t => (
              <TaskRow key={t.id} task={t}
                project={projects.find(p => p.id === t.projectId)}
                showProject={showProject}
                selected={selectedIds.includes(t.id)}
                onSelect={handleSelect}
              />
            ))}
            {isAdding && (
              <QuickAddRow projectId={resolvedProject} status={status} onDone={() => setQuickAdd(null)} />
            )}
            {!isAdding && status !== 'done' && (
              <button onClick={() => setQuickAdd({ sectionKey: groupKey, status })}
                className="w-full flex items-center gap-2 px-5 py-2 text-xs text-gray-400 hover:text-brand-600 hover:bg-gray-50 transition-colors">
                <Plus size={12} /> Adicionar tarefa
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  let content: React.ReactNode
  if (sortBy === 'status') {
    content = STATUS_ORDER.map(s => renderGroup(s, STATUS_LABEL[s], rootTasks.filter(t => t.status === s), s))
  } else if (sortBy === 'priority') {
    const prioOrder = ['urgent','high','medium','low'] as Priority[]
    content = prioOrder.map(p => {
      const items = rootTasks.filter(t => t.priority === p && t.status !== 'done')
      return items.length ? renderGroup(p, PRIORITY_LABEL[p], items, 'todo') : null
    })
  } else if (sortBy === 'project') {
    content = projects.map(proj => {
      const items = rootTasks.filter(t => t.projectId === proj.id && t.status !== 'done')
      return items.length ? renderGroup(proj.id, proj.name, items, 'todo', proj.color) : null
    })
  } else {
    const sorted = [...rootTasks].filter(t => t.status !== 'done').sort((a,b) => {
      if (!a.dueDate) return 1; if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    content = sorted.map(t => <TaskRow key={t.id} task={t} project={projects.find(p=>p.id===t.projectId)} showProject={showProject} selected={selectedIds.includes(t.id)} onSelect={handleSelect} />)
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="flex-1">{content}</div>

      {/* Multi-select action bar */}
      {selectedIds.length > 0 && (
        <div className="sticky bottom-0 border-t border-gray-200 bg-white shadow-lg px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-700">{selectedIds.length} selecionadas</span>
          <div className="flex-1" />

          <select onChange={e => { if (e.target.value) bulkStatus(e.target.value as TaskStatus) }} defaultValue=""
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none cursor-pointer text-gray-600">
            <option value="" disabled>Status...</option>
            {(['todo','in_progress','done'] as TaskStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>

          <select onChange={e => { if (e.target.value) bulkPriority(e.target.value as Priority) }} defaultValue=""
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none cursor-pointer text-gray-600">
            <option value="" disabled>Prioridade...</option>
            {(['urgent','high','medium','low'] as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>

          <select onChange={e => { if (e.target.value) bulkMove(e.target.value) }} defaultValue=""
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none cursor-pointer text-gray-600">
            <option value="" disabled>Mover para...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <button onClick={bulkDelete} className="flex items-center gap-1 text-xs px-2 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 size={11} /> Excluir
          </button>

          <button onClick={clearSelection} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Cancelar
          </button>
        </div>
      )}
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
