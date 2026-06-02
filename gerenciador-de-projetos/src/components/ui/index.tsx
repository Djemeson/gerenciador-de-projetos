import React from 'react'

// ── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode
  color?: string
  bg?: string
  className?: string
}
export function Badge({ children, color, bg, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}
      style={color || bg ? { color, backgroundColor: bg } : undefined}
    >
      {children}
    </span>
  )
}

// ── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
}
export function Button({ variant = 'default', size = 'md', icon, children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors cursor-pointer border'
  const sizes = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  }
  const variants = {
    default: 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100',
    primary: 'bg-brand-600 border-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
    ghost:   'bg-transparent border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700',
    danger:  'bg-white border-red-200 text-red-600 hover:bg-red-50',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  )
}

// ── Avatar ───────────────────────────────────────────────────────────────────
interface AvatarProps { initials: string; color?: string; size?: 'sm' | 'md' }
export function Avatar({ initials, color = '#6B5EE8', size = 'sm' }: AvatarProps) {
  const hex = color
  const bg  = hex + '22'
  const sz  = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  return (
    <span className={`${sz} rounded-full flex items-center justify-center font-medium flex-shrink-0`} style={{ background: bg, color: hex }}>
      {initials.slice(0, 2).toUpperCase()}
    </span>
  )
}

// ── Divider ──────────────────────────────────────────────────────────────────
export function Divider() {
  return <div className="h-px bg-gray-100 my-1" />
}

// ── Kbd ──────────────────────────────────────────────────────────────────────
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-100 border border-gray-200 rounded text-gray-500 font-mono">
      {children}
    </kbd>
  )
}
