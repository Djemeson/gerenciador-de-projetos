import React, { useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { FloatingPanel } from './FloatingPanel'

// Popover de responsável — lista quem já foi usado como responsável em outras tarefas do
// workspace (não existe um cadastro de "pessoas"/membros no app, é single-user local; a
// lista é só um atalho para reaproveitar nomes já digitados) + campo para digitar um novo
// nome. Único seletor de responsável do app — reusado na célula da lista (`TaskRow`) e na
// propriedade "Responsável" (`TaskDetail`).
const initialsOf = (name: string) => name.trim().slice(0, 2).toUpperCase()

interface AssigneePickerProps {
  value: string
  onChange: (v: string) => void
  variant?: 'row' | 'side'
}

export function AssigneePicker({ value, onChange, variant = 'row' }: AssigneePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const known = useAppStore(s => s.getAllAssignees())

  const openPop = () => { setDraft(''); setOpen(true) }
  const select = (name: string) => { onChange(name); setOpen(false) }

  const filtered = known.filter(n => n.toLowerCase().includes(draft.toLowerCase()))

  const trigger = variant === 'row' ? (
    <button ref={btnRef} onClick={e => { e.stopPropagation(); openPop() }}
      className="flex items-center justify-center min-w-0 w-full">
      {value ? (
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-200 to-brand-400 text-brand-800 text-[9.5px] font-extrabold flex items-center justify-center flex-shrink-0 shadow-[0_0_0_2px_#fff,0_0_0_4px_#EEF0FF]">{initialsOf(value)}</span>
      ) : <span className="text-xs text-gray-300">—</span>}
    </button>
  ) : (
    <button ref={btnRef} onClick={e => { e.stopPropagation(); openPop() }}
      className="flex items-center justify-between w-full text-left border border-gray-200/80 rounded-xl px-3 py-2 bg-white hover:border-gray-300 transition-all">
      <div className="flex items-center gap-2 min-w-0">
        {value ? (
          <>
            <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 border border-indigo-100/50">{initialsOf(value)}</span>
            <span className="min-w-0 truncate text-sm font-semibold text-gray-700">{value}</span>
          </>
        ) : (
          <span className="text-sm font-medium text-gray-400">Ninguém</span>
        )}
      </div>
      <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
    </button>
  )

  return (
    <>
      {trigger}
      {open && btnRef.current && (
        <FloatingPanel anchor={btnRef.current} onClose={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-[220px] border border-gray-200 rounded-xl shadow-2xl bg-white overflow-hidden">
            <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) select(draft.trim()) }}
              placeholder="Digite um nome…"
              className="w-full px-3 py-2 text-xs border-b border-gray-100 outline-none" />
            <div className="max-h-[220px] overflow-y-auto py-1">
              {filtered.map(name => (
                <button key={name} onClick={() => select(name)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${name===value?'bg-brand-50/60 text-brand-700 font-medium':'text-gray-700'}`}>
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-200 to-brand-400 text-brand-800 text-[9px] font-extrabold flex items-center justify-center flex-shrink-0">{initialsOf(name)}</span>
                  <span className="flex-1 min-w-0 truncate text-left">{name}</span>
                  {name===value && <Check size={12} className="flex-shrink-0" />}
                </button>
              ))}
              {draft.trim() && !known.includes(draft.trim()) && (
                <button onClick={() => select(draft.trim())}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-brand-600 hover:bg-brand-50 transition-colors">
                  <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded text-[10px] font-medium">Novo</span>
                  Definir "{draft.trim()}"
                </button>
              )}
              {filtered.length === 0 && !draft.trim() && (
                <p className="px-3 py-2 text-[11px] text-gray-400">Nenhum responsável ainda.</p>
              )}
            </div>
            {value && (
              <button onClick={() => select('')}
                className="w-full text-center text-[11px] font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 py-2 border-t border-gray-100 transition-colors">
                Sem responsável
              </button>
            )}
          </div>
        </FloatingPanel>
      )}
    </>
  )
}
