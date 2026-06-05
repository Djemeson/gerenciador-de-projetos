import React from 'react'
import { X, SlidersHorizontal, RotateCcw } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import type { TaskStatus, Priority } from '../types'
import { STATUS_LABEL, PRIORITY_LABEL } from '../types'

export function FilterPanel() {
  const { filterPanelOpen, toggleFilterPanel, filters, setFilters, clearFilters, getAllTags, tasks } = useAppStore()

  if (!filterPanelOpen) return null

  const allTags      = getAllTags()
  const allAssignees = [...new Set(tasks.map(t=>t.assignee).filter(Boolean))].sort()
  const isActive     = filters.status!=='all' || filters.priority!=='all' || filters.assignee || filters.tags.length>0 || filters.dueBefore || filters.dueAfter

  return (
    <div className="w-64 min-w-[256px] border-l border-gray-200 bg-white flex flex-col h-full flex-shrink-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <SlidersHorizontal size={14} className="text-gray-400"/>
        <span className="text-sm font-medium text-gray-800 flex-1">Filtros</span>
        {isActive && (
          <button onClick={clearFilters} className="text-[11px] text-brand-600 hover:text-brand-700 flex items-center gap-1">
            <RotateCcw size={10}/> Limpar
          </button>
        )}
        <button onClick={toggleFilterPanel} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={14}/></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Status</label>
          <div className="space-y-1">
            {['all','todo','in_progress','done'].map(s=>(
              <label key={s} className="flex items-center gap-2 cursor-pointer group">
                <input type="radio" name="status" value={s} checked={filters.status===s} onChange={()=>setFilters({status:s as TaskStatus|'all'})}
                  className="text-brand-600"/>
                <span className="text-xs text-gray-700 group-hover:text-brand-600 transition-colors">
                  {s==='all'?'Todos':(STATUS_LABEL as any)[s]}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Prioridade</label>
          <div className="space-y-1">
            {['all','urgent','high','medium','low'].map(p=>(
              <label key={p} className="flex items-center gap-2 cursor-pointer group">
                <input type="radio" name="priority" value={p} checked={filters.priority===p} onChange={()=>setFilters({priority:p as Priority|'all'})}
                  className="text-brand-600"/>
                <span className="text-xs text-gray-700">{p==='all'?'Todas':(PRIORITY_LABEL as any)[p]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Responsável</label>
          <select value={filters.assignee} onChange={e=>setFilters({assignee:e.target.value})}
            className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none bg-white text-gray-700">
            <option value="">Todos</option>
            {allAssignees.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(tag=>{
              const active = filters.tags.includes(tag)
              return (
                <button key={tag} onClick={()=>setFilters({tags: active?filters.tags.filter(t=>t!==tag):[...filters.tags,tag]})}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors
                    ${active?'bg-brand-100 text-brand-700 border-brand-300':'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {tag}
                </button>
              )
            })}
            {allTags.length===0&&<span className="text-xs text-gray-400">Nenhuma tag</span>}
          </div>
        </div>

        {/* Due date */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Prazo</label>
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">De</label>
              <input type="date" value={filters.dueAfter} onChange={e=>setFilters({dueAfter:e.target.value})}
                className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none"/>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Até</label>
              <input type="date" value={filters.dueBefore} onChange={e=>setFilters({dueBefore:e.target.value})}
                className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
