import React, { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { FloatingPanel } from './FloatingPanel'
import { TagInput } from './TagInput'

interface TagsCellProps {
  value: string[]
  onChange: (tags: string[]) => void
}

/**
 * Célula de tags editável na lista (TaskRow, variant row): mostra as tags como pílulas e,
 * ao clicar, abre um popover flutuante com o `TagInput` completo (mesma fonte de verdade do
 * painel de detalhe — não recria a lógica de sugestões/criação de tag).
 */
export function TagsCell({ value, onChange }: TagsCellProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={ref}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="flex items-center gap-1 flex-wrap w-full text-left rounded-md px-1 py-0.5 hover:bg-gray-100 transition-colors min-h-[22px]"
        title="Editar etiquetas"
      >
        {value.length ? (
          <>
            {value.slice(0, 2).map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50/70 text-indigo-700 border border-indigo-100/50 truncate max-w-[60px] font-medium">{t}</span>
            ))}
            {value.length > 2 && <span className="text-[10px] text-gray-400 font-semibold">+{value.length - 2}</span>}
          </>
        ) : (
          <span className="text-gray-300 group-hover:text-gray-400 inline-flex items-center gap-0.5 text-xs"><Plus size={11} /></span>
        )}
      </button>
      {open && ref.current && (
        <FloatingPanel anchor={ref.current} onClose={() => setOpen(false)} align="left"
          className="w-64 bg-white border border-gray-200 rounded-xl shadow-2xl p-2">
          <TagInput value={value} onChange={onChange} />
        </FloatingPanel>
      )}
    </>
  )
}
