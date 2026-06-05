import React from 'react'
import { Plus, Tag, User, Calendar, Flag } from 'lucide-react'
import type { ColumnDef } from '../../types'
import { useAppStore } from '../../stores/useAppStore'

interface Props {
  projectId:   string
  columns:     ColumnDef[]
  showProject?: boolean
}

export function ColumnHeaders({ projectId, columns, showProject }: Props) {
  const { openColumnsModal } = useAppStore()

  return (
    <div className="flex items-center border-b-2 border-gray-200 bg-gray-50/80 sticky top-0 z-10 text-[11px] font-medium text-gray-500 select-none"
      style={{ minHeight: 32 }}>
      {/* indent spacer: 16px + 4px expand + 4px circle + 8px = ~44px */}
      <div style={{ width: 44 + 16 }} />

      {/* Name */}
      <div className="flex-1 px-2 min-w-[120px]">Nome</div>

      {/* Fixed columns */}
      <div className="flex items-center flex-shrink-0">
        <div className="w-28 px-2 hidden lg:flex items-center gap-1"><Tag size={10}/> Tags</div>
        <div className="w-20 px-2 hidden sm:flex items-center gap-1"><User size={10}/> Responsável</div>
        <div className="w-24 px-2 hidden md:flex items-center gap-1"><Calendar size={10}/> Prazo</div>
        <div className="w-20 px-2 hidden md:flex items-center gap-1"><Flag size={10}/> Prioridade</div>
        {showProject && <div className="w-24 px-2 hidden lg:flex items-center">Projeto</div>}

        {/* Custom columns */}
        {columns.map(col => (
          <div key={col.id} className="px-2 flex items-center text-gray-500 font-medium"
            style={{ width: col.width ?? 100 }}>
            {col.name}
          </div>
        ))}

        {/* Add column */}
        <div className="w-16 px-2 flex justify-center">
          <button onClick={() => openColumnsModal(projectId)}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
            title="Adicionar coluna">
            <Plus size={12}/>
          </button>
        </div>
      </div>
    </div>
  )
}
