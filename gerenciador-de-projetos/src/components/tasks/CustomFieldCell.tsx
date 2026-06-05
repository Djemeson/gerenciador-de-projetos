import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { Task, ColumnDef } from '../../types'
import { useAppStore } from '../../stores/useAppStore'

interface Props { task: Task; column: ColumnDef }

export function CustomFieldCell({ task, column }: Props) {
  const { updateCustomField } = useAppStore()
  const value = task.customFields?.[column.id]
  const [dropOpen, setDropOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropOpen) return
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const update = (v: unknown) => updateCustomField(task.id, column.id, v)

  // ── Dropdown with colors ────────────────────────────────────────────────
  if (column.type === 'dropdown') {
    const selected = column.dropdownOptions.find(o => o.label === value)
    return (
      <div ref={ref} className="relative w-full">
        <button
          onClick={e => { e.stopPropagation(); setDropOpen(v => !v) }}
          className="flex items-center gap-1.5 w-full text-left"
        >
          {selected ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium truncate"
              style={{ background: selected.color + '25', color: selected.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: selected.color }}/>
              {selected.label}
            </span>
          ) : (
            <span className="text-gray-300 text-[11px]">—</span>
          )}
          <ChevronDown size={9} className="text-gray-400 flex-shrink-0 ml-auto"/>
        </button>

        {dropOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]"
            onClick={e => e.stopPropagation()}>
            {/* Clear */}
            <button onClick={() => { update(''); setDropOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:bg-gray-50 transition-colors">
              — Nenhuma
            </button>
            <div className="h-px bg-gray-100 my-1"/>
            {column.dropdownOptions.map(opt => (
              <button key={opt.id} onClick={() => { update(opt.label); setDropOpen(false) }}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: opt.color }}/>
                <span className="text-[12px] text-gray-700 flex-1">{opt.label}</span>
                {value === opt.label && <Check size={11} className="text-brand-500 flex-shrink-0"/>}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Checkbox ────────────────────────────────────────────────────────────
  if (column.type === 'checkbox') {
    return (
      <input type="checkbox" checked={!!value}
        onChange={e => { e.stopPropagation(); update(e.target.checked) }}
        onClick={e => e.stopPropagation()}
        className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 cursor-pointer accent-brand-600"/>
    )
  }

  // ── Date ────────────────────────────────────────────────────────────────
  if (column.type === 'date') {
    return (
      <input type="date" value={String(value ?? '')}
        onChange={e => { e.stopPropagation(); update(e.target.value) }}
        onClick={e => e.stopPropagation()}
        className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 cursor-pointer"/>
    )
  }

  // ── Number / Money ───────────────────────────────────────────────────────
  if (column.type === 'number' || column.type === 'money') {
    const prefix = column.type === 'money' ? 'R$ ' : ''
    return (
      <div className="flex items-center gap-0.5 w-full">
        {column.type === 'money' && <span className="text-[10px] text-gray-400 flex-shrink-0">R$</span>}
        <input type="number" value={String(value ?? '')}
          onChange={e => { e.stopPropagation(); update(e.target.value) }}
          onClick={e => e.stopPropagation()}
          placeholder="0"
          className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 min-w-0"/>
      </div>
    )
  }

  // ── URL ─────────────────────────────────────────────────────────────────
  if (column.type === 'url') {
    const url = String(value ?? '')
    return url ? (
      <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
        className="text-[11px] text-brand-600 hover:underline truncate block w-full">
        {url.replace(/^https?:\/\//, '')}
      </a>
    ) : (
      <input type="url" value={url}
        onChange={e => { e.stopPropagation(); update(e.target.value) }}
        onClick={e => e.stopPropagation()}
        placeholder="https://..."
        className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 placeholder:text-gray-300"/>
    )
  }

  // ── Text (default) ───────────────────────────────────────────────────────
  return (
    <input type="text" value={String(value ?? '')}
      onChange={e => { e.stopPropagation(); update(e.target.value) }}
      onClick={e => e.stopPropagation()}
      placeholder="—"
      className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 placeholder:text-gray-300"/>
  )
}
