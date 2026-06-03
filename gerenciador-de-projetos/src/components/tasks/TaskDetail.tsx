import React, { useState, useRef, useCallback } from 'react'
import { X, Flag, Calendar, User, CheckSquare, Trash2, Plus, ListChecks, GitBranch } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { PRIORITY_LABEL, STATUS_LABEL } from '../../types'
import type { Priority, TaskStatus } from '../../types'
import { Button } from '../ui'
import { TagInput } from '../ui/TagInput'
import { QuickAddRow } from './QuickAddRow'
import { BlockEditor } from './BlockEditor'
import { nanoid } from '../../lib/nanoid'

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: 'text-red-600 bg-red-50 border-red-200',
  high:   'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-blue-600 bg-blue-50 border-blue-200',
  low:    'text-gray-500 bg-gray-50 border-gray-200',
}

export function TaskDetail() {
  const {
    tasks, projects, selectedTaskId, setSelectedTask,
    updateTask, deleteTask, updateBlocks,
    addChecklist, removeChecklist, addChecklistItem,
    toggleChecklistItem, removeChecklistItem,
    getSubtasks,
  } = useAppStore()

  // ── Resize ──────────────────────────────────────────────────────────────
  const [width, setWidth]  = useState(380)
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragging.current = true; startX.current = e.clientX; startW.current = width
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setWidth(Math.max(300, Math.min(700, startW.current + (startX.current - ev.clientX))))
    }
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [width])

  // ── Checklist UI state ───────────────────────────────────────────────────
  const [addingChecklist,  setAddingChecklist]   = useState(false)
  const [checklistTitle,   setChecklistTitle]    = useState('')
  const [addingItems,      setAddingItems]       = useState<Record<string,boolean>>({})
  const [itemInputs,       setItemInputs]        = useState<Record<string,string>>({})
  const [addingSubtask,    setAddingSubtask]     = useState(false)

  const task     = tasks.find(t => t.id === selectedTaskId)
  const project  = task ? projects.find(p => p.id === task.projectId) : undefined
  const subtasks = task ? getSubtasks(task.id) : []

  if (!task) return null

  const saveChecklist = () => {
    if (!checklistTitle.trim()) return
    addChecklist(task.id, checklistTitle.trim())
    setChecklistTitle(''); setAddingChecklist(false)
  }
  const saveItem = (clId: string) => {
    const text = itemInputs[clId]?.trim(); if (!text) return
    addChecklistItem(task.id, clId, text)
    setItemInputs(p => ({ ...p, [clId]: '' })); setAddingItems(p => ({ ...p, [clId]: false }))
  }

  return (
    <aside
      className="relative flex flex-col border-l border-gray-200 bg-white h-full overflow-hidden flex-shrink-0"
      style={{ width }}
    >
      {/* Draggable divider */}
      <div
        onMouseDown={onDragStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-400 z-20 transition-colors"
        title="Arrastar para redimensionar"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {project && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: project.color }} />}
          <span className="text-xs text-gray-500 truncate">{project?.name}</span>
          {task.parentId && <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-shrink-0"><GitBranch size={10} /> sub</span>}
        </div>
        <button onClick={() => setSelectedTask(null)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 flex-shrink-0">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Title */}
        <div className="px-4 pt-4 pb-2">
          <textarea value={task.title} onChange={e => updateTask(task.id, { title: e.target.value })}
            className="w-full text-sm font-medium text-gray-900 leading-5 resize-none outline-none bg-transparent" rows={2} />
        </div>

        {/* Fields */}
        <div className="px-4 space-y-2 pb-3 border-b border-gray-100">
          <Field icon={<Flag size={12} />} label="Prioridade">
            <select value={task.priority} onChange={e => updateTask(task.id, { priority: e.target.value as Priority })}
              className={`text-xs px-2 py-1 rounded-md border font-medium cursor-pointer outline-none ${PRIORITY_COLORS[task.priority]}`}>
              {(['urgent','high','medium','low'] as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </Field>
          <Field icon={<CheckSquare size={12} />} label="Status">
            <select value={task.status} onChange={e => updateTask(task.id, { status: e.target.value as TaskStatus })}
              className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-700 cursor-pointer outline-none">
              {(['todo','in_progress','done'] as TaskStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field icon={<Calendar size={12} />} label="Prazo">
            <input type="date" value={task.dueDate ?? ''} onChange={e => updateTask(task.id, { dueDate: e.target.value || null })}
              className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-700 outline-none" />
          </Field>
          <Field icon={<User size={12} />} label="Responsável">
            <input type="text" value={task.assignee} onChange={e => updateTask(task.id, { assignee: e.target.value })}
              className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-700 outline-none w-24" />
          </Field>
          <div className="pt-1">
            <TagInput value={task.tags} onChange={tags => updateTask(task.id, { tags })} />
          </div>
        </div>

        {/* Block editor — texto + imagens + áudios misturados */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Conteúdo</p>
          <BlockEditor
            blocks={task.blocks}
            onChange={blocks => updateBlocks(task.id, blocks)}
          />
        </div>

        {/* Subtasks */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <GitBranch size={10} /> Subtarefas
              {subtasks.length > 0 && <span className="ml-1">({subtasks.filter(s => s.status==='done').length}/{subtasks.length})</span>}
            </p>
            <button onClick={() => setAddingSubtask(v => !v)} className="text-gray-400 hover:text-brand-600 transition-colors"><Plus size={12} /></button>
          </div>
          {subtasks.length > 0 && (
            <div className="space-y-0.5 mb-1">
              {subtasks.map(s => (
                <button key={s.id} onClick={() => setSelectedTask(s.id)}
                  className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 group">
                  <span className={`w-3 h-3 rounded-full border flex-shrink-0 flex items-center justify-center ${s.status==='done' ? 'bg-brand-500 border-brand-500' : 'border-gray-300'}`}>
                    {s.status==='done' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </span>
                  <span className={`flex-1 text-xs truncate ${s.status==='done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{s.title}</span>
                  <X size={10} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400"
                    onClick={e => { e.stopPropagation(); deleteTask(s.id) }} />
                </button>
              ))}
            </div>
          )}
          {addingSubtask && task.projectId && (
            <QuickAddRow projectId={task.projectId} status="todo" parentId={task.id} onDone={() => setAddingSubtask(false)} />
          )}
        </div>

        {/* Checklists */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <ListChecks size={10} /> Checklists
            </p>
            <button onClick={() => setAddingChecklist(v => !v)} className="text-gray-400 hover:text-brand-600 transition-colors"><Plus size={12} /></button>
          </div>

          {addingChecklist && (
            <div className="flex gap-1 mb-3">
              <input autoFocus value={checklistTitle} onChange={e => setChecklistTitle(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter') saveChecklist(); if (e.key==='Escape') setAddingChecklist(false) }}
                placeholder="Nome do checklist..." className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
              <button onClick={saveChecklist} className="text-xs px-2 py-1 bg-brand-600 text-white rounded-lg">OK</button>
            </div>
          )}

          {task.checklists.map(cl => {
            const done = cl.items.filter(i => i.done).length; const total = cl.items.length
            return (
              <div key={cl.id} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">{cl.title}</span>
                  <div className="flex items-center gap-2">
                    {total > 0 && <span className="text-[10px] text-gray-400">{done}/{total}</span>}
                    <button onClick={() => removeChecklist(task.id, cl.id)} className="text-gray-300 hover:text-red-400"><X size={10} /></button>
                  </div>
                </div>
                {total > 0 && <div className="h-1 bg-gray-100 rounded-full mb-2 overflow-hidden"><div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.round((done/total)*100)}%` }} /></div>}
                <div className="space-y-1">
                  {cl.items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 group py-0.5">
                      <button onClick={() => toggleChecklistItem(task.id, cl.id, item.id)}
                        className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${item.done ? 'bg-brand-500 border-brand-500' : 'border-gray-300 hover:border-brand-400'}`}>
                        {item.done && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </button>
                      <span className={`flex-1 text-xs ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.text}</span>
                      <button onClick={() => removeChecklistItem(task.id, cl.id, item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400"><X size={10} /></button>
                    </div>
                  ))}
                </div>
                {addingItems[cl.id] ? (
                  <div className="flex gap-1 mt-1.5">
                    <input autoFocus value={itemInputs[cl.id] ?? ''} onChange={e => setItemInputs(p => ({ ...p, [cl.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key==='Enter') saveItem(cl.id); if (e.key==='Escape') setAddingItems(p => ({ ...p, [cl.id]: false })) }}
                      placeholder="Item..." className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none" />
                    <button onClick={() => saveItem(cl.id)} className="text-xs px-2 bg-brand-600 text-white rounded-lg">OK</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingItems(p => ({ ...p, [cl.id]: true }))}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-600 mt-1">
                    <Plus size={10} /> Item
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3 flex-shrink-0">
        <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => deleteTask(task.id)} className="w-full justify-center">
          Excluir tarefa
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
