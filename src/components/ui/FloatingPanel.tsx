import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface FloatingPanelProps {
  /** Elemento âncora (botão/ícone que abriu o painel) — define a posição. */
  anchor: HTMLElement
  onClose: () => void
  align?: 'left' | 'right'   // alinha a borda esquerda ou direita do painel com a âncora
  className?: string
  children: React.ReactNode
}

/**
 * Popover flutuante via portal (document.body), posicionado com `position: fixed`
 * a partir do retângulo da âncora. Evita o corte por containers com `overflow-y-auto`
 * (ex.: a lista rolável da sidebar) — mesmo problema que o `Select.tsx` já resolve
 * para dropdowns. Reutilizar aqui em vez de `position:absolute` dentro de listas roláveis.
 */
export function FloatingPanel({ anchor, onClose, align = 'left', className = '', children }: FloatingPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', visibility: 'hidden', top: 0, left: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = anchor.getBoundingClientRect()
    const pw = el.offsetWidth, ph = el.offsetHeight
    const vw = window.innerWidth, vh = window.innerHeight
    const top = (vh - r.bottom >= ph + 8) ? r.bottom + 4 : Math.max(r.top - ph - 4, 8)
    let left = align === 'right' ? r.right - pw : r.left
    left = Math.min(Math.max(left, 8), vw - pw - 8)
    setStyle({ position: 'fixed', top, left, visibility: 'visible' })
  }, [anchor, align])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor.contains(e.target as Node)) return
      onClose()
    }
    const onScroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  return createPortal(
    <div ref={ref} style={style} className={`z-[100] ${className}`} onMouseDown={e => e.stopPropagation()}>
      {children}
    </div>,
    document.body,
  )
}
