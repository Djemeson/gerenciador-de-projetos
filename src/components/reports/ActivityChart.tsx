import React from 'react'
import type { Bucket } from '../../lib/reportMetrics'

// Gráfico de barras do relatório: duas séries (criadas × concluídas) no mesmo eixo, com
// grade e escala — sem elas as barras eram só alturas relativas, impossíveis de ler como
// número. Continua sendo SVG/CSS puro: o app não traz biblioteca de gráfico.

const CREATED_COLOR   = '#C7CBFF'   // índigo claro — entrada
const COMPLETED_COLOR = '#6366F1'   // brand-500 — saída

/** Escala "bonita": 1, 2, 5, 10, 20, 50… logo acima do maior valor. */
function niceMax(value: number): number {
  if (value <= 1) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(value)))
  const norm = value / pow
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * pow
}

export function ActivityChart({ buckets, height = 168 }: { buckets: Bucket[]; height?: number }) {
  const peak = Math.max(...buckets.map(b => Math.max(b.created, b.completed)), 0)
  const max  = niceMax(peak)
  // Escalas pequenas (max = 1) gerariam [1, 1, 0]: o meio some para não repetir marca.
  const ticks = [...new Set([max, Math.round(max / 2), 0])]

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-4 mb-3">
        <Legend color={CREATED_COLOR}   label="Criadas" />
        <Legend color={COMPLETED_COLOR} label="Concluídas" />
      </div>

      <div className="flex gap-2">
        {/* Eixo de valores */}
        <div className="flex flex-col justify-between text-[10px] text-gray-400 tabnum pb-5 flex-shrink-0" style={{ height }}>
          {ticks.map(t => <span key={t}>{t}</span>)}
        </div>

        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="relative" style={{ height }}>
            {/* Grade — as linhas são o que permite estimar valores sem contar pixel */}
            {ticks.map((t, i) => (
              <div key={t} className="absolute inset-x-0 border-t border-gray-100"
                   style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
            ))}

            <div className="absolute inset-0 flex items-end gap-1.5 pb-px">
              {buckets.map((b, i) => (
                <div key={i} className="flex-1 min-w-[18px] flex items-end justify-center gap-[2px] h-full"
                     title={`${b.label} · ${b.created} criadas · ${b.completed} concluídas`}>
                  <Bar value={b.created}   max={max} color={CREATED_COLOR} />
                  <Bar value={b.completed} max={max} color={COMPLETED_COLOR} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5 mt-1.5">
            {buckets.map((b, i) => (
              <span key={i} className="flex-1 min-w-[18px] text-center text-[10px] text-gray-400 truncate">{b.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  // 2px de altura mínima só quando há valor: barra zerada tem que ser visivelmente zero.
  const pct = max ? (value / max) * 100 : 0
  return (
    <div className="w-1/2 rounded-t-[3px] transition-all"
         style={{ height: value > 0 ? `max(3px, ${pct}%)` : 0, background: color, minHeight: value > 0 ? 3 : 0 }} />
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
      <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  )
}
