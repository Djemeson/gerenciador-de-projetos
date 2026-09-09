import React, { useState } from 'react'
import { Plus, ChevronUp, ChevronDown, GripVertical, Sparkles } from 'lucide-react'
import type { ListColumn } from '../../types'
import { isAIColumnType } from '../../types'
import type { ColumnSort } from '../../lib/taskColumns'
import { useAppStore } from '../../stores/useAppStore'

interface Props {
  projectId:       string
  scope?:          string
  showAddColumn?:  boolean
  orderedColumns:  ListColumn[]
  sort?:           ColumnSort | null
  onSort?:         (key: string) => void
  onReorder?:      (fromKey: string, toKey: string) => void
  onRename?:       (key: string, label: string) => void
  onResize?:       (key: string, width: number) => void
}

export function ColumnHeaders({
  projectId, scope, showAddColumn = true,
  orderedColumns, sort, onSort, onReorder, onRename, onResize,
}: Props) {
  const { openColumnsModal } = useAppStore()
  const [dragKey,    setDragKey]    = useState<string | null>(null)
  const [overKey,    setOverKey]    = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)

  const SortArrow = ({ k }: { k: string }) =>
    sort?.key === k
      ? (sort.dir === 'asc' ? <ChevronUp size={12} className="text-brand-500"/> : <ChevronDown size={12} className="text-brand-500"/>)
      : null

  return (
    <div className="hidden md:flex items-center border-y border-gray-200/70 bg-gray-50 sticky top-0 z-10 text-[11px] font-semibold text-gray-500 uppercase tracking-wider select-none"
      style={{ minHeight: 38, paddingLeft: '24px', paddingRight: '24px' }}>
      <div style={{ width: 46 }} />

      {/* Nome — clicável para ordenar por título */}
      <button onClick={() => onSort?.('title')}
        className="flex-1 px-2 min-w-[120px] flex items-center gap-1 text-left hover:text-gray-600 transition-colors h-full py-2.5">
        Tarefa <SortArrow k="title"/>
      </button>

      {/* Colunas */}
      <div className="flex items-center flex-shrink-0">
        {orderedColumns.map(c => (
          <div
            key={c.key}
            draggable={editingKey !== c.key}
            onDragStart={e => { setDragKey(c.key); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => { e.preventDefault(); if (overKey !== c.key) setOverKey(c.key) }}
            onDragLeave={() => setOverKey(k => (k === c.key ? null : k))}
            onDrop={e => { e.preventDefault(); if (dragKey && dragKey !== c.key) onReorder?.(dragKey, c.key); setDragKey(null); setOverKey(null) }}
            onDragEnd={() => { setDragKey(null); setOverKey(null) }}
            className={`group/col relative px-3 flex items-center h-8 cursor-grab active:cursor-grabbing border-l border-transparent
              ${overKey === c.key ? 'border-l-brand-400 bg-brand-50/60' : ''} ${dragKey === c.key ? 'opacity-40' : ''}`}
            style={{ width: c.width, minWidth: c.width }}
          >
            {editingKey === c.key ? (
              <input
                autoFocus defaultValue={c.label}
                onBlur={e => { const v = e.target.value.trim(); if (v) onRename?.(c.key, v); setEditingKey(null) }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingKey(null) }}
                onClick={e => e.stopPropagation()}
                className="flex-1 min-w-0 bg-white border border-brand-300 rounded px-1 py-0.5 text-[11px] outline-none"
              />
            ) : (
              <button
                onClick={() => onSort?.(c.key)}
                onDoubleClick={() => setEditingKey(c.key)}
                title="Clique: ordenar · Duplo-clique: renomear · Arraste para reordenar"
                className="flex-1 min-w-0 flex items-center justify-center gap-1 truncate text-center hover:text-gray-700 transition-colors">
                {c.col && isAIColumnType(c.col.type) && <Sparkles size={12} className="ai-gradient-text flex-shrink-0"/>}
                <span className={`truncate ${c.col && isAIColumnType(c.col.type) ? 'ai-gradient-text font-medium' : ''}`}>{c.label}</span> <SortArrow k={c.key}/>
              </button>
            )}
            {/* Grip flutuante (não desloca o rótulo) */}
            <GripVertical size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 md:opacity-0 md:group-hover/col:opacity-100 pointer-events-none"/>
            
            {/* Alça de redimensionamento de coluna */}
            {onResize && (
              <div
                onMouseDown={e => {
                  e.stopPropagation()
                  e.preventDefault()
                  const startX = e.clientX
                  const startWidth = c.width
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const deltaX = moveEvent.clientX - startX
                    onResize(c.key, Math.max(48, startWidth + deltaX))
                  }
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-slate-300 active:bg-brand-500 z-20 group-hover/col:bg-slate-200/50 transition-colors"
                title="Arraste para redimensionar"
              />
            )}
          </div>
        ))}

        <div className="w-16 px-2 flex justify-center">
          {showAddColumn && (
            <button onClick={() => openColumnsModal(projectId, scope)}
              className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              title="Adicionar coluna">
              <Plus size={12}/>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
