import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Plus, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { TaskRow } from './TaskRow'
import { QuickAddRow } from './QuickAddRow'
import { ColumnHeaders } from './ColumnHeaders'
import type { Task, TaskStatus, Priority, ColumnDef } from '../../types'
import { STATUS_LABEL, PRIORITY_LABEL } from '../../types'
import {
  buildColumns, loadSort, saveSort, loadOrder, saveOrder, loadLabels, saveLabels, sortTasks,
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
}

export function TaskList({ tasks, projectId, scopeKey, columns=[], showProject=false, sortBy='status' }: TaskListProps) {
  const { projects, activeProjectId, deleteTask, updateTask, reorderTask, filteredTasks } = useAppStore()
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set(['done']))
  const [quickAdd,     setQuickAdd]     = useState<{key:string;status:TaskStatus}|null>(null)
  const [selectedIds,  setSelectedIds]  = useState<string[]>([])
  const [lastSelected, setLastSelected] = useState<string|null>(null)
  const [dragTaskId,   setDragTaskId]   = useState<string|null>(null)
  const [focusId,      setFocusId]      = useState<string|null>(null)

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

  const handleDropTask = (targetId: string) => {
    if (dragTaskId && dragTaskId !== targetId) {
      const dragged = tasks.find(t => t.id===dragTaskId)
      const target  = tasks.find(t => t.id===targetId)
      if (dragged && target && dragged.status !== target.status) updateTask(dragTaskId, { status: target.status })
      reorderTask(dragTaskId, targetId)
    }
    setDragTaskId(null)
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
    [scope, columns, showProject, colVersion],
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

  const renderGroup = (key:string, label:string, items:Task[], status:TaskStatus, color?:string) => {
    const isCollapsed = collapsed.has(key)
    const isAdding    = quickAdd?.key===key
    return (
      <div key={key}>
        <div className="flex items-center gap-2 px-4 py-1.5 bg-white sticky top-8 z-[9] border-b border-gray-100 group">
          <button onClick={()=>toggle(key)} className="text-gray-400 hover:text-gray-600">
            {isCollapsed?<ChevronRight size={13}/>:<ChevronDown size={13}/>}
          </button>
          {color&&<span className="w-2 h-2 rounded-full" style={{background:color}}/>}
          <span className="text-xs font-medium text-gray-600">{label}</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{items.length}</span>
          <div className="flex-1 h-px bg-gray-100"/>
          {status!=='done'&&(
            <button onClick={()=>setQuickAdd({key,status})} className="opacity-0 group-hover:opacity-100 text-[11px] text-gray-400 hover:text-brand-600 flex items-center gap-1 transition-all">
              <Plus size={11}/> adicionar
            </button>
          )}
        </div>
        {!isCollapsed&&(
          <div className="animate-fade-in">
            {sortTasks(items, colSort).map(t=>(
              <TaskRow key={t.id} task={t} project={projects.find(p=>p.id===t.projectId)}
                showProject={showProject} columns={columns} orderedColumns={orderedColumns}
                selected={selectedIds.includes(t.id)} focused={focusId===t.id} onSelect={handleSelect} {...taskDragProps}/>
            ))}
            {isAdding&&<QuickAddRow projectId={resolvedPid} status={status} onDone={()=>setQuickAdd(null)}/>}
            {!isAdding&&status!=='done'&&(
              <button onClick={()=>setQuickAdd({key,status})}
                className="w-full flex items-center gap-2 px-10 py-2 text-xs text-gray-400 hover:text-brand-600 hover:bg-gray-50 transition-colors">
                <Plus size={12}/> Adicionar tarefa
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  let content: React.ReactNode
  if (sortBy==='status') {
    content = STATUS_ORDER.map(s=>renderGroup(s,STATUS_LABEL[s],rootTasks.filter(t=>t.status===s),s))
  } else if (sortBy==='priority') {
    const po=['urgent','high','medium','low'] as Priority[]
    content = po.map(p=>{const items=rootTasks.filter(t=>t.priority===p&&t.status!=='done'); return items.length?renderGroup(p,PRIORITY_LABEL[p],items,'todo'):null})
  } else if (sortBy==='project') {
    content = projects.map(pr=>{const items=rootTasks.filter(t=>t.projectId===pr.id&&t.status!=='done'); return items.length?renderGroup(pr.id,pr.name,items,'todo',pr.color):null})
  } else if (sortBy==='assignee') {
    const assignees=[...new Set(rootTasks.filter(t=>t.status!=='done').map(t=>t.assignee||'Sem responsável'))].sort()
    content = assignees.map(a=>{const items=rootTasks.filter(t=>(t.assignee||'Sem responsável')===a&&t.status!=='done'); return items.length?renderGroup('asg_'+a,a,items,'todo','#7B68EE'):null})
  } else {
    const base=[...rootTasks].filter(t=>t.status!=='done').sort((a,b)=>{if(!a.dueDate)return 1;if(!b.dueDate)return-1;return new Date(a.dueDate).getTime()-new Date(b.dueDate).getTime()})
    const sorted=colSort?sortTasks(base,colSort):base
    content = sorted.map(t=><TaskRow key={t.id} task={t} project={projects.find(p=>p.id===t.projectId)} showProject={showProject} columns={columns} orderedColumns={orderedColumns} selected={selectedIds.includes(t.id)} focused={focusId===t.id} onSelect={handleSelect} {...taskDragProps}/>)
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Column headers */}
      <ColumnHeaders projectId={resolvedPid} columns={columns} showProject={showProject}
        orderedColumns={orderedColumns} sort={colSort}
        onSort={cycleSort} onReorder={reorderCol} onRename={renameCol}/>
      <div className="flex-1">{content}</div>

      {/* Multi-select action bar */}
      {selectedIds.length>0&&(
        <div className="sticky bottom-0 border-t border-gray-200 bg-white shadow-lg px-4 py-2 flex items-center gap-3 flex-wrap z-20">
          <span className="text-xs font-medium text-gray-700">{selectedIds.length} selecionadas</span>
          <div className="flex-1"/>
          <select onChange={e=>{if(e.target.value)bulkStatus(e.target.value as TaskStatus)}} defaultValue=""
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none cursor-pointer text-gray-600">
            <option value="" disabled>Status...</option>
            {(['todo','in_progress','done'] as TaskStatus[]).map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select onChange={e=>{if(e.target.value)bulkPriority(e.target.value as Priority)}} defaultValue=""
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none cursor-pointer text-gray-600">
            <option value="" disabled>Prioridade...</option>
            {(['urgent','high','medium','low'] as Priority[]).map(p=><option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
          <button onClick={bulkDelete} className="flex items-center gap-1 text-xs px-2 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 size={11}/> Excluir
          </button>
          <button onClick={clearSel} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
        </div>
      )}
    </div>
  )
}
