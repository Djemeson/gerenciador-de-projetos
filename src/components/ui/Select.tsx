import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'

// ── Dropdown premium reutilizável ────────────────────────────────────────────
// Substitui os <select> nativos por um menu estilizado, consistente com o design
// (sofisticado/minimalista). Usa portal para não ser cortado por containers com
// overflow (linhas de tarefa, tabelas, modais). Fecha por clique-fora, Esc,
// scroll e resize; navegação por teclado (setas, Enter, Home/End).

export interface SelectOption {
  value: string
  label: string
  color?: string              // ponto colorido + cor do texto (prioridade/status)
  icon?: React.ElementType    // ícone lucide opcional
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  variant?: 'default' | 'inline'   // default = com borda; inline = sem borda (células densas)
  size?: 'sm' | 'md'
  align?: 'left' | 'right'
  disabled?: boolean
  stop?: boolean                    // stopPropagation nos eventos (para linhas clicáveis)
  colorText?: boolean               // colore o texto do gatilho com a cor da opção
  pill?: boolean                    // gatilho vira badge sólido colorido (bg tinta da cor + ponto), variant="inline"
  className?: string                 // no wrapper
  buttonClassName?: string           // sobrescreve/estende o gatilho
  ariaLabel?: string
  searchable?: boolean               // mostra barra de busca no topo do dropdown (listas longas, ex.: projetos)
  searchPlaceholder?: string
}

export function Select({
  value, onChange, options, placeholder = 'Selecionar',
  variant = 'default', size = 'sm', align = 'left', disabled = false,
  stop = false, colorText = false, pill = false, className = '', buttonClassName = '', ariaLabel,
  searchable = false, searchPlaceholder = 'Buscar...',
}: SelectProps) {
  const [open, setOpen]   = useState(false)
  const [hi, setHi]       = useState(0)      // índice destacado (teclado)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [coords, setCoords] = useState<{ left: number; top: number; width: number; drop: 'down' | 'up' }>({ left: 0, top: 0, width: 0, drop: 'down' })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)
  const stopIf = (e: React.SyntheticEvent) => { if (stop) e.stopPropagation() }
  const visibleOptions = searchable && query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  const place = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const menuH = Math.min(options.length * 34 + 12, 288)
    const spaceBelow = window.innerHeight - r.bottom
    const drop: 'down' | 'up' = spaceBelow < menuH + 8 && r.top > menuH ? 'up' : 'down'
    setCoords({
      left: align === 'right' ? r.right - Math.max(r.width, 176) : r.left,
      top:  drop === 'down' ? r.bottom + 4 : r.top - 4,
      width: Math.max(r.width, 176),
      drop,
    })
  }

  useLayoutEffect(() => { if (open) place() }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, visibleOptions.length - 1)) }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
      else if (e.key === 'Home' && !searchable)      { e.preventDefault(); setHi(0) }
      else if (e.key === 'End' && !searchable)       { e.preventDefault(); setHi(visibleOptions.length - 1) }
      else if (e.key === 'Enter')     { e.preventDefault(); const o = visibleOptions[hi]; if (o) { onChange(o.value); setOpen(false) } }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, hi, visibleOptions, onChange, searchable])

  // Reset da busca ao abrir/fechar + autofoco no campo de busca
  useEffect(() => {
    if (open) { setQuery(''); if (searchable) setTimeout(() => searchRef.current?.focus(), 0) }
  }, [open, searchable])

  const toggle = (e: React.MouseEvent) => {
    stopIf(e)
    if (disabled) return
    if (!open) setHi(Math.max(0, options.findIndex(o => o.value === value)))
    setOpen(o => !o)
  }

  const sizeCls = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2.5 py-1.5 text-xs'
  const base = pill
    ? 'inline-flex items-center justify-center gap-1.5 min-w-[84px] rounded-full px-2.5 py-1 text-[11.5px] font-bold cursor-pointer transition-colors max-w-full'
    : variant === 'inline'
    ? 'inline-flex items-center gap-1 bg-transparent hover:bg-gray-100 rounded-md px-1.5 py-1 text-xs cursor-pointer transition-colors max-w-full'
    : `inline-flex items-center gap-1.5 w-full justify-between bg-white border border-gray-200 rounded-lg ${sizeCls} text-gray-700 hover:border-gray-300 cursor-pointer transition-colors`

  const triggerColor = colorText && selected?.color ? selected.color : undefined
  const SelIcon = selected?.icon

  return (
    <div className={`relative ${variant === 'inline' ? 'inline-flex max-w-full' : ''} ${className}`}>
      <button
        ref={btnRef} type="button" onClick={toggle} onMouseDown={stopIf}
        disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        className={`${base} ${disabled ? 'opacity-40 pointer-events-none' : ''} ${buttonClassName}`}
        style={pill && triggerColor ? { color: triggerColor, background: triggerColor + '18' } : triggerColor ? { color: triggerColor } : undefined}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          {selected?.color && !SelIcon && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selected.color }} />}
          {SelIcon && <SelIcon size={14} className="flex-shrink-0" style={{ color: selected.color || 'currentColor', fill: selected.color ? selected.color + '20' : 'none' }} />}
          <span className={`truncate ${!selected ? 'text-gray-400' : 'text-gray-700'} font-medium`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        {!pill && <ChevronDown size={variant === 'inline' ? 11 : 13} className={`flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''} ${variant === 'inline' ? 'opacity-60' : ''}`} />}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          onMouseDown={e => e.stopPropagation()}
          className="fixed z-[100] bg-white border border-gray-200/80 rounded-xl shadow-xl py-1 animate-scale-in max-h-72 overflow-y-auto"
          style={{
            left: coords.left,
            width: coords.width,
            ...(coords.drop === 'down' ? { top: coords.top } : { bottom: window.innerHeight - coords.top }),
          }}
          role="listbox"
        >
          {searchable && (
            <div className="px-1.5 pb-1.5 pt-0.5 sticky top-0 bg-white">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setHi(0) }}
                  placeholder={searchPlaceholder}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 bg-gray-50 focus:bg-white"
                />
              </div>
            </div>
          )}
          {visibleOptions.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400 text-center">Nenhum resultado</div>
          )}
          {visibleOptions.map((o, i) => {
            const isSel = o.value === value
            const OIcon = o.icon
            return (
              <button
                key={o.value} type="button" role="option" aria-selected={isSel}
                onMouseEnter={() => setHi(i)}
                onClick={e => { e.stopPropagation(); onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${i === hi ? 'bg-gray-50' : ''} ${isSel ? 'font-medium' : ''}`}
              >
                {o.color && !OIcon && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.color }} />}
                {OIcon && <OIcon size={13} className="flex-shrink-0" style={{ color: o.color || '#6b7280', fill: o.color ? o.color + '20' : 'none' }} />}
                <span className="flex-1 truncate text-gray-700">{o.label}</span>
                {isSel && <Check size={13} className="text-brand-600 flex-shrink-0" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── Conjuntos de opções comuns (cores consistentes com os tokens de status) ──
export const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'urgent', label: 'Urgente', color: '#E24B4A' },
  { value: 'high',   label: 'Alta',    color: '#D85A30' },
  { value: 'medium', label: 'Média',   color: '#378ADD' },
  { value: 'low',    label: 'Baixa',   color: '#9B9EA8' },
]

export const STATUS_OPTIONS: SelectOption[] = [
  { value: 'todo',        label: 'A fazer',      color: '#888780' },
  { value: 'in_progress', label: 'Em progresso', color: '#378ADD' },
  { value: 'done',        label: 'Concluído',    color: '#1D9E75' },
]
