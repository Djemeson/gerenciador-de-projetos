import React, { useState, useRef, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [input, setInput]       = useState('')
  const [open,  setOpen]        = useState(false)
  const inputRef                = useRef<HTMLInputElement>(null)
  const allTags                 = useAppStore(s => s.getAllTags())

  const suggestions = allTags.filter(
    t => t.toLowerCase().includes(input.toLowerCase()) && !value.includes(t)
  )

  const add = (tag: string) => {
    const t = tag.trim()
    if (!t || value.includes(t)) return
    onChange([...value, t])
    setInput('')
  }

  const remove = (tag: string) => onChange(value.filter(t => t !== tag))

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      add(input)
    }
    if (e.key === 'Backspace' && !input && value.length) {
      remove(value[value.length - 1])
    }
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.tag-input-root')) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="tag-input-root relative">
      <div
        className="flex flex-wrap gap-1 items-center min-h-[38px] px-3 py-1.5 border border-gray-200/80 rounded-xl bg-white cursor-text w-full transition-all hover:border-gray-300"
        onClick={() => { inputRef.current?.focus(); setOpen(true) }}
      >
        {value.length === 0 && !open && !input && (
          <span className="text-sm font-medium text-gray-400 italic">Sem etiquetas</span>
        )}
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-indigo-50/60 text-indigo-700 rounded-full border border-indigo-100/50 font-medium">
            {tag}
            <button type="button" onClick={e => { e.stopPropagation(); remove(tag) }} className="text-indigo-400 hover:text-indigo-700">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true) }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 && open ? 'Escreva uma tag...' : ''}
          className="flex-1 min-w-[60px] text-sm outline-none bg-transparent text-gray-700 placeholder:text-gray-400"
        />
        {value.length === 0 && !open && !input && (
          <ChevronDown size={13} className="text-gray-400 ml-auto flex-shrink-0" />
        )}
      </div>

      {open && (input || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden">
          {input.trim() && !allTags.includes(input.trim()) && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); add(input) }}
              className="w-full text-left px-3 py-2 text-xs text-brand-600 hover:bg-brand-50 flex items-center gap-2"
            >
              <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded text-[10px] font-medium">Nova</span>
              Criar tag "{input.trim()}"
            </button>
          )}
          {suggestions.slice(0, 6).map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => { e.preventDefault(); add(s) }}
              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
