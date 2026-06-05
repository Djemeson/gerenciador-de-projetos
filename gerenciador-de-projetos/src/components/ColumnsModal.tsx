import React, { useState } from 'react'
import { X, Trash2, Plus } from 'lucide-react'
import { Modal } from './ui/Modal'
import { useAppStore } from '../stores/useAppStore'
import type { ColumnType } from '../types'

const COLUMN_TYPES: { value: ColumnType; label: string; icon: string }[] = [
  { value:'text',     label:'Texto',         icon:'T'  },
  { value:'number',   label:'Número',        icon:'#'  },
  { value:'date',     label:'Data',          icon:'📅' },
  { value:'dropdown', label:'Lista suspensa', icon:'▾' },
  { value:'checkbox', label:'Caixa de seleção',icon:'☑'},
  { value:'money',    label:'Dinheiro',      icon:'$'  },
  { value:'url',      label:'Link',          icon:'🔗' },
]

export function ColumnsModal() {
  const { columnsModal, closeColumnsModal, projects, addColumn, deleteColumn } = useAppStore()
  const project = projects.find(p => p.id === columnsModal)

  const [name,    setName]    = useState('')
  const [type,    setType]    = useState<ColumnType>('text')
  const [options, setOptions] = useState('')

  if (!columnsModal || !project) return null

  const handleAdd = () => {
    if (!name.trim()) return
    addColumn(project.id, {
      name: name.trim(), type, projectId: project.id,
      options: type==='dropdown' ? options.split(',').map(o=>o.trim()).filter(Boolean) : undefined,
      width: 100,
    })
    setName(''); setType('text'); setOptions('')
  }

  return (
    <Modal open={!!columnsModal} onClose={closeColumnsModal} title={`Colunas — ${project.name}`} width="max-w-md">
      <div className="space-y-4">
        {/* Existing columns */}
        {project.columns.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Colunas atuais</p>
            <div className="space-y-1.5">
              {project.columns.map(col => (
                <div key={col.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg group">
                  <span className="text-xs font-mono text-gray-400 w-5 text-center">{COLUMN_TYPES.find(t=>t.value===col.type)?.icon??'?'}</span>
                  <span className="flex-1 text-xs text-gray-700 font-medium">{col.name}</span>
                  <span className="text-[10px] text-gray-400">{COLUMN_TYPES.find(t=>t.value===col.type)?.label}</span>
                  <button onClick={() => deleteColumn(project.id, col.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                    <Trash2 size={12}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add new */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-3">Adicionar coluna</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Nome</label>
              <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()}
                placeholder="Ex: Sprint, Estimativa..."
                className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"/>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Tipo</label>
              <select value={type} onChange={e=>setType(e.target.value as ColumnType)}
                className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none bg-white cursor-pointer">
                {COLUMN_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {type==='dropdown' && (
            <div className="mb-3">
              <label className="text-[11px] text-gray-500 block mb-1">Opções (separadas por vírgula)</label>
              <input value={options} onChange={e=>setOptions(e.target.value)}
                placeholder="Opção 1, Opção 2, Opção 3"
                className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"/>
            </div>
          )}

          <button onClick={handleAdd} disabled={!name.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors">
            <Plus size={12}/> Adicionar coluna
          </button>
        </div>
      </div>
    </Modal>
  )
}
