import React, { useEffect } from 'react'
import { X, SlidersHorizontal, RotateCcw } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import type { TaskStatus, Priority } from '../types'
import { STATUS_LABEL, PRIORITY_LABEL } from '../types'
import { DatePeriodPicker } from './ui/DatePeriodPicker'
import { Select } from './ui/Select'

/**
 * Painel de filtros.
 *
 * **Janela flutuante desde 01/08/2026.** Era `w-64 flex-shrink-0` com borda à esquerda, ou
 * seja, participava da linha e *empurrava* a lista: abrir o filtro reorganizava a tela e
 * estreitava as colunas justamente quando se queria olhar os dados. Agora sobrepõe, ancorada
 * no canto inferior direito, no mesmo padrão do bloco de notas.
 *
 * Sem fundo escurecido, pela mesma razão de lá: filtro se ajusta *olhando* o resultado na
 * lista atrás. Fecha no X ou no Esc.
 */
export function FilterPanel() {
  const { filterPanelOpen, toggleFilterPanel, filters, setFilters, clearFilters, getAllTags, tasks, activeWorkspaceId } = useAppStore()

  // Esc fecha — sem scrim, é a única saída pelo teclado.
  useEffect(() => {
    if (!filterPanelOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') toggleFilterPanel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [filterPanelOpen, toggleFilterPanel])

  if (!filterPanelOpen) return null

  const allTags      = getAllTags()
  const allAssignees = [...new Set(tasks.filter(t => t.workspaceId===activeWorkspaceId).map(t=>t.assignee).filter(Boolean))].sort()
  const isActive     = filters.status!=='all' || filters.priority!=='all' || filters.assignee || filters.tags.length>0 || !!filters.datePeriod

  return (
    <aside
      role="dialog" aria-label="Filtros"
      className="fixed z-[55] bg-white flex flex-col animate-window-in
                 inset-0 md:inset-auto md:right-5 md:bottom-5 md:w-72 md:h-[min(620px,calc(100vh-7rem))]
                 md:rounded-2xl md:border md:border-gray-200 md:shadow-2xl md:ring-1 md:ring-black/5 md:overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <SlidersHorizontal size={14} className="text-gray-400"/>
        <span className="text-sm font-medium text-gray-800 flex-1">Filtros</span>
        {isActive && (
          <button onClick={clearFilters} className="text-[11px] text-brand-600 hover:text-brand-700 flex items-center gap-1">
            <RotateCcw size={12}/> Limpar
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
          <Select value={filters.assignee} onChange={v=>setFilters({assignee:v})} ariaLabel="Responsável"
            options={[{ value:'', label:'Todos' }, ...allAssignees.map(a=>({ value:a, label:a }))]}/>
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

        {/* Data (período) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Data</label>
            {filters.datePeriod && (
              <button onClick={()=>setFilters({datePeriod:null})} className="text-[10px] text-gray-400 hover:text-danger-500 transition-colors">Limpar</button>
            )}
          </div>
          <DatePeriodPicker
            field={filters.dateField}
            fieldOptions={['dueDate','completedAt','createdAt']}
            onFieldChange={f=>setFilters({dateField:f})}
            value={filters.datePeriod ?? undefined}
            onChange={v=>setFilters({datePeriod:v ?? null})}
          />
        </div>
      </div>
    </aside>
  )
}
