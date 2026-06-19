import React, { useEffect, useRef } from 'react'
import { ICON_OPTIONS } from '../../types'

interface EmojiPickerProps {
  onPick: (emoji: string | undefined) => void
  onClose: () => void
  /** posição do popover relativa ao botão âncora */
  className?: string
}

/**
 * Popover compacto com grade de emojis curados (estilo ClickUp).
 * Inclui opção de remover o ícone.
 */
export function EmojiPicker({ onPick, onClose, className = '' }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      onMouseDown={e => e.stopPropagation()}
      className={`z-[60] w-[232px] bg-cu-active border border-cu-border rounded-xl shadow-2xl p-2 ${className}`}
    >
      <div className="grid grid-cols-8 gap-0.5 max-h-[180px] overflow-y-auto sidebar-scroll">
        {ICON_OPTIONS.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => { onPick(emoji); onClose() }}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[15px] hover:bg-cu-hover transition-colors leading-none"
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="h-px bg-cu-border my-1.5" />
      <button
        type="button"
        onClick={() => { onPick(undefined); onClose() }}
        className="w-full text-[11px] text-cu-muted hover:text-white px-2 py-1 rounded-md hover:bg-cu-hover transition-colors text-left"
      >
        Remover ícone
      </button>
    </div>
  )
}
