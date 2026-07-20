import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Plus, Trash2, CheckCircle2, Clock, Circle } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { TaskRow } from './TaskRow'
import { QuickAddRow } from './QuickAddRow'
import { ColumnHeaders } from './ColumnHeaders'
import { Select, PRIORITY_OPTIONS, STATUS_OPTIONS } from '../ui/Select'
import type { Task, TaskStatus, Priority, ColumnDef } from '../../types'
import { STATUS_LABEL, PRIORITY_LABEL } from '../../types'

// Pílula colorida por status (estilo ClickUp) — cabeçalho de grupo
const STATUS_PILL: Record<TaskStatus, { color: string; Icon: React.ElementType }> = {
  todo:        { color: '#888780', Icon: Circle },
  in_progress: { color: '#378ADD', Icon: Clock },
  done:        { color: '#1D9E75', Icon: CheckCircle2 },
}
import {
  buildColumns, loadSort, saveSort, loadOrder, saveOrder, loadLabels, saveLabels, sortTasks,
  loadWidths, saveWidths,
  type ColumnSort,
} from '../../lib/taskColumns'

const STATUS_ORDER: TaskStatus[] = ['in_progress', 'todo', 'done']

interface TaskListProps {
  tasks:        Task[]
  projectId?:   string
  scopeKey?:    string
  columns?:     ColumnDef[]
  showProject?: boolean
  sortBy?:      'status' | 'priority' | 'dueDate' | 'project' | 'assignee'
  subtasksCollapsed?: boolean   // controlado pelo TaskPanel (botão "Expandir/Recolher subtarefas" na barra "Agrupar por")
  expandVersion?:     number
}

export function TaskList({ tasks, projectId, scopeKey, columns=[], showProject=false, sortBy='status', subtasksCollapsed=false, expandVersion=0 }: TaskListProps) {
  const { projects, activeProjectId, deleteTask, updateTask, reorderTask, filteredTasks, columnsVersion: storeColumnsVersion } = useAppStore()
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set(['done']))
  const [quickAdd,     setQuickAdd]     = useState<{key:string;status:TaskStatus}|null>(null)
  const [selectedIds,  setSelectedIds]  = useState<string[]>([])
  const [lastSelected, setLastSelected] = useState<string|null>(null)
  const [dragTaskId,   setDragTaskId]   = useState<string|null>(null)
  const [dragOverGroup,setDragOverGroup]= useState<string|null>(null)
  const [focusId,      setFocusId]      = useState<string|null>(null)

  // Garante que o estado de arraste não fique "preso" se o drop acontecer fora de um alvo válido
  useEffect(() => {
    const reset = () => { setDragTaskId(null); setDragOverGroup(null) }
    window.addEventListener('dragend', reset)
    return () => window.removeEventListener('dragend', reset)
  }, [])

  // Navegação por teclado (j/k navegar · e abrir · espaço concluir)
  const rootIdsRef = useRef<string[]>([])
  const focusIdRef = useRef<string|null>(null)
  focusIdRef.current = focusId
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT' || el.isContentEditable)) return
      const ids = rootIdsRef.current; if (!ids.length) return
      const cur = focusIdRef.current
      const idx = cur ? ids.indexOf(cur) : -1
      if (e.key==='j' || e.key==='ArrowDown') { e.preventDefault(); setFocusId(ids[Math.min(ids.length-1, idx+1)] ?? ids[0]) }
      else if (e.key==='k' || e.key==='ArrowUp') { e.preventDefault(); setFocusId(idx<=0 ? ids[0] : ids[idx-1]) }
      else if (e.key==='e' && cur) { e.preventDefault(); useAppStore.getState().setSelectedTask(cur) }
      else if (e.key===' ' && cur) {
        e.preventDefault()
        const t = useAppStore.getState().tasks.find(x => x.id===cur)
        if (t) useAppStore.getState().updateTask(cur, { status: t.status==='done'?'todo':'done' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Campo que o agrupamento ativo controla — arrastar para outro grupo transfere esse campo.
  // "Prazo" é só ordenação (não é um grupo), então não transfere nada.
  const groupField = (): keyof Task | null => {
    if (sortBy==='status')   return 'status'
    if (sortBy==='priority') return 'priority'
    if (sortBy==='project')  return 'projectId'
    if (sortBy==='assignee') return 'assignee'
    return null
  }
  const applyGroupTransfer = (id: string, value: unknown) => {
    const field = groupField()
    if (!field) return
    const dragged = tasks.find(t => t.id===id)
    if (dragged && dragged[field] !== value) updateTask(id, { [field]: value } as unknown as Partial<Task>)
  }

  const handleDropTask = (targetId: string) => {
    if (dragTaskId && dragTaskId !== targetId) {
      const target = tasks.find(t => t.id===targetId)
      const field  = groupField()
      if (target && field) applyGroupTransfer(dragTaskId, target[field])
      reorderTask(dragTaskId, targetId)
    }
    setDragTaskId(null)
    setDragOverGroup(null)
  }
  // Soltar na área do grupo (fora de uma linha específica) também transfere — cobre grupos
  // com poucas tarefas ou o espaço abaixo da última linha.
  const handleDropOnGroup = (e: React.DragEvent, groupValue: unknown) => {
    e.preventDefault()
    if (dragTaskId) applyGroupTransfer(dragTaskId, groupValue)
    setDragTaskId(null)
    setDragOverGroup(null)
  }
  const taskDragProps = {
    dragTaskId,
    onDragStartTask: (id: string) => setDragTaskId(id),
    onDropTask: handleDropTask,
  }

  const scope = scopeKey ?? (projectId ? 'project:'+projectId : 'global')
  const [colSort,    setColSort]    = useState<ColumnSort|null>(() => loadSort(scope))
  const [colVersion, setColVersion] = useState(0)

  const orderedColumns = useMemo(
    () => buildColumns(scope, columns, showProject),
    [scope, columns, showProject, colVersion, storeColumnsVersion],
  )

  const cycleSort = (key: string) => {
    setColSort(prev => {
      let next: ColumnSort | null
      if (!prev || prev.key !== key) next = { key, dir: 'asc' }
      else if (prev.dir === 'asc')   next = { key, dir: 'desc' }
      else                            next = null
      saveSort(scope, next)
      return next
    })
  }
  const reorderCol = (fromKey: string, toKey: string) => {
    const keys = orderedColumns.map(c => c.key)
    const from = keys.indexOf(fromKey), to = keys.indexOf(toKey)
    if (from < 0 || to < 0) return
    keys.splice(to, 0, keys.splice(from, 1)[0])
    saveOrder(scope, keys); setColVersion(v => v + 1)
  }
  const renameCol = (key: string, label: string) => {
    const labels = loadLabels(scope); labels[key] = label
    saveLabels(scope, labels); setColVersion(v => v + 1)
  }
  const resizeCol = (key: string, width: number) => {
    const widths = loadWidths(scope); widths[key] = width
    saveWidths(scope, widths); setColVersion(v => v + 1)
  }

  const rootTasks    = filteredTasks(tasks.filter(t=>!t.parentId))
  rootIdsRef.current = rootTasks.map(t=>t.id)
  const resolvedPid  = projectId ?? activeProjectId ?? projects[0]?.id ?? ''
  const toggle = (k:string) => setCollapsed(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n})

  const handleSelect = useCallback((id:string, e:React.MouseEvent) => {
    if (e.shiftKey && lastSelected) {
      const ids = rootTasks.map(t=>t.id)
      const a=ids.indexOf(lastSelected), b=ids.indexOf(id)
      const range=ids.slice(Math.min(a,b),Math.max(a,b)+1)
      setSelectedIds(p=>[...new Set([...p,...range])])
    } else {
      setSelectedIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])
      setLastSelected(id)
    }
  },[rootTasks,lastSelected])

  const clearSel = () => { setSelectedIds([]); setLastSelected(null) }
  const bulkDelete   = () => { selectedIds.forEach(id=>deleteTask(id)); clearSel() }
  const bulkStatus   = (s:TaskStatus) => { selectedIds.forEach(id=>updateTask(id,{status:s})); clearSel() }
  const bulkPriority = (p:Priority)   => { selectedIds.forEach(id=>updateTask(id,{priority:p})); clearSel() }

  const renderGroup = (key:string, label:string, items:Task[], status:TaskStatus, color?:string, pill?:{color:string;Icon?:React.ElementType}, groupValue?: unknown) => {
    const isCollapsed = collapsed.has(key)
    const isAdding    = quickAdd?.key===key
    const PillIcon    = pill?.Icon
    const isDropTarget = dragTaskId !== null && dragOverGroup === key
    return (
      <div key={key}>
        <div className="flex items-center gap-2.5 px-6 pt-3.5 pb-2 bg-white md:sticky md:top-[38px] z-[9] group">
          <button onClick={()=>toggle(key)} className="flex items-center gap-2 min-w-0" title={isCollapsed ? 'Expandir' : 'Recolher'}>
            {pill ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider min-w-[96px] justify-center shadow-sm border transition-all"
                style={{
                  backgroundColor: pill.color + '14',
                  color: pill.color,
                  borderColor: pill.color + '30'
                }}>
                {PillIcon && <PillIcon size={11} strokeWidth={2.5}/>} {label}
              </span>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100/80 shadow-sm">
                {color && <span className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style={{background:color}}/>}
                <span className="text-xs font-bold text-gray-700 tracking-tight">{label}</span>
              </div>
            )}
            <span className="text-[11px] text-gray-300 font-bold tabnum">{items.length}</span>
          </button>
          <div className="flex-1 h-px bg-gray-100"/>
          {status!=='done'&&(
            <button onClick={()=>setQuickAdd({key,status})} className="opacity-0 group-hover:opacity-100 text-[11px] text-gray-300 hover:text-brand-600 flex items-center gap-1 transition-all font-medium">
              <Plus size={11}/> adicionar
            </button>
          )}
        </div>
        {!isCollapsed&&(
          <div className={`animate-fade-in transition-colors ${isDropTarget ? 'ring-1 ring-inset ring-brand-400 bg-brand-50/30 rounded-lg' : ''}`}
            onDragOver={e=>{ if (dragTaskId) { e.preventDefault(); if (dragOverGroup!==key) setDragOverGroup(key) } }}
            onDrop={e=>handleDropOnGroup(e, groupValue)}>
            {sortTasks(items, colSort).map(t=>(
              <TaskRow key={t.id+':'+expandVersion} task={t} project={projects.find(p=>p.id===t.projectId)}
                showProject={showProject} columns={columns} orderedColumns={orderedColumns}
                selected={selectedIds.includes(t.id)} focused={focusId===t.id} onSelect={handleSelect}
                defaultExpanded={!subtasksCollapsed} groupBy={sortBy} {...taskDragProps}/>
            ))}
            {isAdding&&<QuickAddRow projectId={resolvedPid} status={status} onDone={()=>setQuickAdd(null)}/>}
            {!isAdding&&status!=='done'&&(
              <div className="px-6 py-1">
                <button onClick={()=>setQuickAdd({key,status})}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-gray-400 hover:text-brand-600 hover:bg-brand-50/20 border border-dashed border-gray-200 hover:border-brand-300 rounded-xl transition-all duration-200 font-semibold cursor-pointer">
                  <Plus size={13} className="transition-transform duration-200 group-hover:scale-110"/> Adicionar tarefa
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  let content: React.ReactNode
  if (sortBy==='status') {
    content = STATUS_ORDER.map(s=>renderGroup(s,STATUS_LABEL[s],rootTasks.filter(t=>t.status===s),s,undefined,STATUS_PILL[s],s))
  } else if (sortBy==='priority') {
    // Sempre renderiza os 4 grupos (mesmo vazios) para servirem de alvo de arraste, como o status.
    const po=['urgent','high','medium','low'] as Priority[]
    content = po.map(p=>{const items=rootTasks.filter(t=>t.priority===p); const c=PRIORITY_OPTIONS.find(o=>o.value===p)?.color; return renderGroup(p,PRIORITY_LABEL[p],items,'todo',undefined,c?{color:c}:undefined,p)})
  } else if (sortBy==='project') {
    content = projects.map(pr=>{const items=rootTasks.filter(t=>t.projectId===pr.id); return items.length?renderGroup(pr.id,pr.name,items,'todo',pr.color,{color:pr.color},pr.id):null})
  } else if (sortBy==='assignee') {
    const assignees=[...new Set(rootTasks.map(t=>t.assignee||'Sem responsável'))].sort()
    content = assignees.map(a=>{const items=rootTasks.filter(t=>(t.assignee||'Sem responsável')===a); return items.length?renderGroup('asg_'+a,a,items,'todo','#6366F1',undefined,a==='Sem responsável'?'':a):null})
  } else {
    const base=[...rootTasks].sort((a,b)=>{if(!a.dueDate)return 1;if(!b.dueDate)return-1;return new Date(a.dueDate).getTime()-new Date(b.dueDate).getTime()})
    const sorted=colSort?sortTasks(base,colSort):base
    content = sorted.map(t=><TaskRow key={t.id+':'+expandVersion} task={t} project={projects.find(p=>p.id===t.projectId)} showProject={showProject} columns={columns} orderedColumns={orderedColumns} selected={selectedIds.includes(t.id)} focused={focusId===t.id} onSelect={handleSelect} defaultExpanded={!subtasksCollapsed} groupBy={sortBy} {...taskDragProps}/>)
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Column headers */}
      <ColumnHeaders projectId={resolvedPid} scope={scope} columns={columns} showProject={showProject}
        orderedColumns={orderedColumns} sort={colSort}
        onSort={cycleSort} onReorder={reorderCol} onRename={renameCol} onResize={resizeCol}/>
      <div className="flex-1">{content}</div>

      {/* Multi-select action bar */}
      {selectedIds.length>0&&(
        <div className="sticky bottom-0 border-t border-gray-200 bg-white shadow-lg px-4 py-2 flex items-center gap-3 flex-wrap z-20">
          <span className="text-xs font-medium text-gray-700">{selectedIds.length} selecionadas</span>
          <div className="flex-1"/>
          <Select value="" placeholder="Status..." options={STATUS_OPTIONS}
            onChange={v=>bulkStatus(v as TaskStatus)} ariaLabel="Definir status"/>
          <Select value="" placeholder="Prioridade..." options={PRIORITY_OPTIONS}
            onChange={v=>bulkPriority(v as Priority)} ariaLabel="Definir prioridade"/>
          <button onClick={bulkDelete} className="flex items-center gap-1 text-xs px-2 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 size={11}/> Excluir
          </button>
          <button onClick={clearSel} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
        </div>
      )}
    </div>
  )
}
