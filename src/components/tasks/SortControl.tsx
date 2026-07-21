import React, { useRef, useState } from 'react'
import { ArrowUpDown, Plus, X, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import { FloatingPanel } from '../ui/FloatingPanel'
import { Select } from '../ui/Select'
import { SORT_FIELDS, type MultiSort } from '../../lib/taskColumns'

interface SortControlProps {
  value: MultiSort
  onChange: (next: MultiSort) => void
}

/**
 * Controle de classificação multi-nível (estilo Notion): abre um popover com uma lista
 * ordenada de regras (campo + direção). A 1ª regra ordena; as seguintes só desempatam.
 * Aplicável em qualquer visualização (o resultado é usado para pré-ordenar as tarefas).
 */
export function SortControl({ value, onChange }: SortControlProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const used = new Set(value.map(s => s.key))
  const firstUnused = SORT_FIELDS.find(f => !used.has(f.key))?.key ?? 'priority'

  const addRule = () => onChange([...value, { key: firstUnused, dir: 'asc' }])
  const setRule = (i: number, patch: Partial<MultiSort[number]>) =>
    onChange(value.map((r, j) => j === i ? { ...r, ...patch } : r))
  const removeRule = (i: number) => onChange(value.filter((_, j) => j !== i))

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        title="Classificar"
        className={`flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs font-semibold border rounded-lg transition-colors
          ${value.length ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'}`}>
        <ArrowUpDown size={12}/>
        <span>Classificar{value.length ? ` (${value.length})` : ''}</span>
      </button>

      {open && btnRef.current && (
        <FloatingPanel anchor={btnRef.current} onClose={() => setOpen(false)} align="right"
          className="w-[300px] bg-white border border-gray-200 rounded-xl shadow-2xl p-2.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 pb-2">Classificação</p>
          {value.length === 0 && (
            <p className="text-xs text-gray-400 px-1 pb-2">Nenhuma regra. Adicione uma para ordenar as tarefas.</p>
          )}
          <div className="space-y-1.5">
            {value.map((rule, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <GripVertical size={13} className="text-gray-200 flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <Select value={rule.key} ariaLabel="Campo"
                    options={SORT_FIELDS.map(f => ({ value: f.key, label: f.label }))}
                    onChange={v => setRule(i, { key: v })}/>
                </div>
                <button onClick={() => setRule(i, { dir: rule.dir === 'asc' ? 'desc' : 'asc' })}
                  title={rule.dir === 'asc' ? 'Crescente' : 'Decrescente'}
                  className="flex items-center gap-0.5 px-1.5 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 flex-shrink-0">
                  {rule.dir === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
                </button>
                <button onClick={() => removeRule(i)} className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                  <X size={13}/>
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
            <button onClick={addRule} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 px-1.5 py-1 rounded-lg hover:bg-brand-50 transition-colors">
              <Plus size={12}/> Adicionar classificação
            </button>
            {value.length > 0 && (
              <button onClick={() => onChange([])} className="text-[11px] font-medium text-gray-400 hover:text-gray-600 px-1.5 py-1">
                Limpar
              </button>
            )}
          </div>
        </FloatingPanel>
      )}
    </>
  )
}
