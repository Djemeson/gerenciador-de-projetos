import React from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { Delta } from '../../lib/reportMetrics'

// Peças visuais do painel de Relatórios. Ficam fora do ReportsView para a tela ser só
// composição — e para que cartão, seção e barra de progresso tenham um acabamento só.

/** Moldura padrão de bloco do relatório (cabeçalho + corpo). */
export function Section({ icon, title, hint, action, children, className = '' }: {
  icon: React.ReactNode; title: string; hint?: string
  action?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white border border-gray-200/70 rounded-xl overflow-hidden print:break-inside-avoid ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        {icon}
        <span className="text-[13px] font-bold text-gray-800 tracking-tight">{title}</span>
        {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  )
}

/**
 * Variação contra o período anterior. Sem base de comparação (`pct` null) mostra só o
 * absoluto — "+100%" sobre zero seria uma informação inventada.
 */
export function DeltaBadge({ delta, inverted = false }: { delta: Delta; inverted?: boolean }) {
  if (delta.direction === 'flat') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-gray-400">
        <Minus size={11} /> igual
      </span>
    )
  }
  // `inverted`: em métricas como "em atraso", subir é ruim.
  const good = inverted ? delta.direction === 'down' : delta.direction === 'up'
  const Icon = delta.direction === 'up' ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-bold ${good ? 'text-[#1D9E75]' : 'text-[#E24B4A]'}`}>
      <Icon size={11} />
      {delta.pct !== null ? `${Math.abs(delta.pct)}%` : `${delta.abs > 0 ? '+' : ''}${delta.abs}`}
    </span>
  )
}

export function KpiCard({ icon, label, value, sub, delta, invertedDelta, onClick }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string
  delta?: Delta; invertedDelta?: boolean; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      className={`bg-white border border-gray-200/70 rounded-xl p-4 print:break-inside-avoid ${onClick ? 'cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        {icon}
        {delta && <DeltaBadge delta={delta} inverted={invertedDelta} />}
      </div>
      <p className="text-2xl font-extrabold tracking-tight text-gray-900 tabnum">{value}</p>
      <p className="text-[12px] text-gray-600 mt-0.5 font-medium">{label}</p>
      {sub && <p className="text-[10.5px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

/** Barra de progresso fina, usada nas listas agrupadas (espaço, projeto, tag, pessoa). */
export function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[12.5px] text-gray-500 font-medium">{message}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}
