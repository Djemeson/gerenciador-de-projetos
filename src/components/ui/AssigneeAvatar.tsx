import React from 'react'
import { assigneeInitials, assigneeLook } from '../../lib/assigneeLook'

// Avatar de responsável — único do app (seletor, quadro, relatórios). A cor vem de
// `lib/assigneeLook.ts`: Claude laranja, DJ azul claro, outros nomes no índigo da marca.
//   solid → gradiente (lista, menu do seletor, relatório)
//   soft  → fundo claro com borda (propriedade do painel, cartão do quadro)
interface AssigneeAvatarProps {
  name: string
  size?: 20 | 24 | 28
  variant?: 'solid' | 'soft'
  /** Anel branco + anel na cor da pessoa (célula da lista). */
  ring?: boolean
}

const SIZE_CLASS = { 20: 'w-5 h-5', 24: 'w-6 h-6', 28: 'w-7 h-7' } as const

export function AssigneeAvatar({ name, size = 24, variant = 'solid', ring = false }: AssigneeAvatarProps) {
  const l = assigneeLook(name)
  const style: React.CSSProperties = variant === 'solid'
    ? { background: `linear-gradient(135deg, ${l.from}, ${l.to})`, color: l.text }
    : { background: l.soft, color: l.softText, border: `1px solid ${l.softBorder}` }
  if (ring) style.boxShadow = `0 0 0 2px var(--white, #fff), 0 0 0 4px ${l.soft}`
  return (
    <span title={name} style={style}
      className={`${SIZE_CLASS[size]} rounded-full text-[10px] ${variant === 'solid' ? 'font-extrabold' : 'font-bold'} flex items-center justify-center flex-shrink-0`}>
      {assigneeInitials(name)}
    </span>
  )
}
