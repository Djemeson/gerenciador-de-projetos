import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  X, Flag, Calendar, User, CheckSquare, Trash2, Plus, ListChecks, GitBranch,
  PanelRight, Square, Maximize2, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { PRIORITY_LABEL, STATUS_LABEL, TASK_TYPE_META } from '../../types'
import type { Priority, TaskStatus, TaskOpenMode } from '../../types'
import { TYPE_ICON, TYPE_ICON_COLOR } from '../../lib/taskTypeIcons'
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

const MODE_CONFIG: Record<TaskOpenMode, { label: string; Icon: React.ElementType }> = {
  side:   { label: 'Lado a lado',  Icon: PanelRight  },
  center: { label: 'Centralizado', Icon: Square      },
  full:   { label: 'Página inteira',Icon: Maximize2  },
}

interface Props {
  mode?: TaskOpenMode
  onChangeMode?: (mode: TaskOpenMode) => void
}

export function TaskDetail({ mode = 'side', onChangeMode }: Props) {
  const {
    tasks, projects, selectedTaskId, setSelectedTask,
    updateTask, deleteTask, updateBlocks,
    addChecklist, removeChecklist, addChecklistItem,
    toggleChecklistItem, removeChecklistItem,
    getSubtasks,
  } = useAppStore()

  // ── Resize (side mode only) — abre grande (metade da janela ou mais) ──────
  const [width, setWidth]  = useState(() => {
    try { const saved = Number(localStorage.getItem('tf_taskpanel_width')); if (saved >= 420) return saved } catch {}
    return typeof window !== 'undefined'
      ? Math.min(960, Math.max(560, Math.round(window.innerWidth * 0.55)))
      : 640
  })
  useEffect(() => { try { localStorage.setItem('tf_taskpanel_width', String(width)) } catch {} }, [width])
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragging.current = true; startX.current = e.clientX; startW.current = width
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const max = typeof window !== 'undefined' ? window.innerWidth * 0.85 : 1100
      setWidth(Math.max(420, Math.min(max, startW.current + (startX.current - ev.clientX))))
    }
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [width])

  // ── Checklist state ──────────────────────────────────────────────────────
  const [addingChecklist,  setAddingChecklist]   = useState(false)
  const [checklistTitle,   setChecklistTitle]    = useState('')
  const [addingItems,      setAddingItems]       = useState<Record<string,boolean>>({})
  const [itemInputs,       setItemInputs]        = useState<Record<string,string>>({})
  const [addingSubtask,    setAddingSubtask]     = useState(false)
  const [contentOpen,      setContentOpen]       = useState(true)

  const task     = tasks.find(t => t.id === selectedTaskId)
  const project  = task ? projects.find(p => p.id === task.projectId) : undefined
  const subtasks = task ? getSubtasks(task.id) : []

  if (!task) return null

  const typeMeta = TASK_TYPE_META[task.taskType ?? 'task']

  // keepOpen → fluxo contínuo (Enter cria e já espera a próxima)
  const saveChecklist = (keepOpen = false) => {
    if (!checklistTitle.trim()) { if (!keepOpen) setAddingChecklist(false); return }
    addChecklist(task.id, checklistTitle.trim())
    setChecklistTitle('')
    if (!keepOpen) setAddingChecklist(false)
  }
  const openAddChecklist = () => {
    setChecklistTitle(task.checklists.length === 0 ? 'Checklist' : '')
    setAddingChecklist(v => !v)
  }
  const saveItem = (clId: string, keepOpen = false) => {
    const text = itemInputs[clId]?.trim()
    if (!text) { if (!keepOpen) setAddingItems(p => ({ ...p, [clId]: false })); return }
    addChecklistItem(task.id, clId, text)
    setItemInputs(p => ({ ...p, [clId]: '' }))
    if (!keepOpen) setAddingItems(p => ({ ...p, [clId]: false }))
  }

  const containerClass = mode === 'full'
    ? 'flex flex-col flex-1 bg-white h-full overflow-hidden'
    : mode === 'center'
    ? 'flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden'
    : 'relative flex flex-col border-l border-gray-200 bg-white h-full overflow-hidden flex-shrink-0'

  const containerStyle = mode === 'full'
    ? {}
    : mode === 'center'
    ? { width: '720px', maxWidth: '90vw', maxHeight: '90vh' }
    : { width }

  const content = (
    <>
      {/* Draggable divider (side mode only) */}
      {mode === 'side' && (
        <div onMouseDown={onDragStart}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-400 z-20 transition-colors"
          title="Arrastar para redimensionar"/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          {/* Type icon — padrão (mesmo da lista) */}
          {(() => { const Icon = TYPE_ICON[task.taskType ?? 'task']; return (
            <Icon size={15} strokeWidth={2} style={{ color: TYPE_ICON_COLOR }} className="flex-shrink-0" />
          ) })()}
          {project && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: project.color }} />}
          <span className="text-xs text-gray-500 truncate">{project?.name}</span>
          {task.parentId && <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-shrink-0"><GitBranch size={10} /> sub</span>}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Open mode selector */}
          {onChangeMode && (
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 mr-1">
              {(['side','center','full'] as TaskOpenMode[]).map(m => {
                const cfg = MODE_CONFIG[m]
                return (
                  <button key={m} onClick={() => onChangeMode(m)} title={cfg.label}
                    className={`p-1 rounded-md transition-colors ${mode===m?'bg-white text-gray-700 shadow-sm':'text-gray-400 hover:text-gray-600'}`}>
                    <cfg.Icon size={11}/>
                  </button>
                )
              })}
            </div>
          )}
          <button onClick={() => setSelectedTask(null)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 flex-shrink-0">
            <X size={13} />
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${mode === 'center' || mode === 'full' ? 'max-w-3xl mx-auto w-full' : ''}`}>
        {/* Title */}
        <div className="px-5 pt-5 pb-2">
          <textarea value={task.title} onChange={e => updateTask(task.id, { title: e.target.value })}
            className={`w-full font-semibold text-gray-900 leading-6 resize-none outline-none bg-transparent ${mode==='full'?'text-xl':'text-base'}`}
            rows={2} />
        </div>

        {/* Ações rápidas — logo abaixo do nome */}
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
          {[
            { label: 'Subtarefa', onClick: () => setAddingSubtask(true) },
            { label: 'Checklist', onClick: openAddChecklist },
            { label: 'Conteúdo',  onClick: () => setContentOpen(true) },
          ].map(a => (
            <button key={a.label} onClick={a.onClick}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors">
              <Plus size={11} /> {a.label}
            </button>
          ))}
        </div>

        {/* Propriedades — 3 por linha */}
        <div className="px-5 pb-4 border-b border-gray-100">
          <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
            <PropCell icon={<Flag size={11} />} label="Prioridade">
              <select value={task.priority} onChange={e => updateTask(task.id, { priority: e.target.value as Priority })}
                className={`w-full text-xs px-2 py-1 rounded-md border font-medium cursor-pointer outline-none ${PRIORITY_COLORS[task.priority]}`}>
                {(['urgent','high','medium','low'] as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </PropCell>
            <PropCell icon={<CheckSquare size={11} />} label="Status">
              <select value={task.status} onChange={e => updateTask(task.id, { status: e.target.value as TaskStatus })}
                className="w-full text-xs px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-700 cursor-pointer outline-none">
                {(['todo','in_progress','done'] as TaskStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </PropCell>
            <PropCell icon={<Calendar size={11} />} label="Prazo">
              <input type="date" value={task.dueDate ?? ''} onChange={e => updateTask(task.id, { dueDate: e.target.value || null })}
                className="w-full text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-700 outline-none" />
            </PropCell>
            <PropCell icon={<User size={11} />} label="Responsável">
              <input type="text" value={task.assignee} onChange={e => updateTask(task.id, { assignee: e.target.value })}
                className="w-full text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-700 outline-none" />
            </PropCell>
          </div>
          <div className="pt-3">
            <TagInput value={task.tags} onChange={tags => updateTask(task.id, { tags })} />
          </div>
        </div>

        {/* Conteúdo — colapsável */}
        <div className="px-5 py-4 border-b border-gray-100">
          <button onClick={() => setContentOpen(v => !v)}
            className="w-full flex items-center gap-1 mb-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors">
            {contentOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Conteúdo
          </button>
          {contentOpen && <BlockEditor blocks={task.blocks} onChange={blocks => updateBlocks(task.id, blocks)} />}
        </div>

        {/* Subtasks */}
        <div className="px-5 py-4 border-b border-gray-100">
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
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <ListChecks size={10} /> Checklists
            </p>
            <button onClick={openAddChecklist} className="text-gray-400 hover:text-brand-600 transition-colors"><Plus size={12} /></button>
          </div>

          {addingChecklist && (
            <div className="flex gap-1 mb-3">
              <input autoFocus value={checklistTitle} onChange={e => setChecklistTitle(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); saveChecklist(true) } if (e.key==='Escape') setAddingChecklist(false) }}
                onBlur={() => saveChecklist(false)}
                placeholder="Nome do checklist..." className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
              <button onMouseDown={e => e.preventDefault()} onClick={() => saveChecklist(false)} className="text-xs px-2 py-1 bg-brand-600 text-white rounded-lg">OK</button>
            </div>
          )}

          {task.checklists.map(cl => {
            const done = cl.items.filter(i => i.done).length; const total = cl.items.length
            return (
              <div key={cl.id} className="mb-4">
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
                      onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); saveItem(cl.id, true) } if (e.key==='Escape') setAddingItems(p => ({ ...p, [cl.id]: false })) }}
                      onBlur={() => saveItem(cl.id, false)}
                      placeholder="Item..." className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none" />
                    <button onMouseDown={e => e.preventDefault()} onClick={() => saveItem(cl.id, true)} className="text-xs px-2 bg-brand-600 text-white rounded-lg">OK</button>
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
        <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => { setSelectedTask(null); deleteTask(task.id) }} className="w-full justify-center">
          Excluir tarefa
        </Button>
      </div>
    </>
  )

  if (mode === 'center') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
        onClick={() => setSelectedTask(null)}>
        <div className={containerClass} style={containerStyle} onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    )
  }

  return (
    <aside className={containerClass} style={containerStyle}>
      {content}
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

// Célula de propriedade (rótulo em cima, controle embaixo) — grade 3 por linha
function PropCell({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] text-gray-400 flex items-center gap-1 truncate">{icon}{label}</span>
      {children}
    </div>
  )
}
