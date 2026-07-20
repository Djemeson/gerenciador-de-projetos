import React, { useRef, useState } from 'react'
import { Calendar, AlertCircle, Search, Clock, RotateCw, CalendarDays, Sun, Bed, ArrowRight } from 'lucide-react'
import { FloatingPanel } from './FloatingPanel'
import { MiniCalendar, quickDateOptions, fmtShort } from './DatePeriodPicker'
import { isoDate, parseISO } from '../../lib/dateFilter'

// Popover de prazo (atalhos rápidos + mini-calendário), único seletor de data de tarefa
// do app — reusado na célula da lista (`TaskRow`) e na propriedade "Prazo" (`TaskDetail`).
// Reaproveita `MiniCalendar`/`quickDateOptions` do `DatePeriodPicker` (fonte única de
// calendário) em vez de recriar a grade de dias.
function displayLabel(value: string | null): string {
  if (!value) return ''
  const d = parseISO(value)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  return fmtShort(d)
}

interface DueDatePickerProps {
  value: string | null
  onChange: (v: string | null) => void
  variant?: 'row' | 'side'
  overdue?: boolean
}

export function DueDatePicker({ value, onChange, variant = 'row', overdue = false }: DueDatePickerProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const selected = value ? parseISO(value) : null
  const label = displayLabel(value)

  const pick = (d: Date) => { onChange(isoDate(d)); setOpen(false) }

  const trigger = variant === 'row' ? (
    <button ref={btnRef} onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
      className={`flex items-center gap-1 min-w-0 text-[11px] transition-colors ${overdue ? 'text-red-500' : label ? 'text-gray-600' : 'text-gray-300'} hover:text-brand-600`}>
      {value && (overdue ? <AlertCircle size={10} className="flex-shrink-0" /> : <Calendar size={10} className="flex-shrink-0 text-gray-400" />)}
      <span className={`truncate ${!label ? 'italic' : ''}`}>{label || 'Sem prazo'}</span>
    </button>
  ) : (
    <button ref={btnRef} onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
      className={`flex items-center gap-2 w-full text-sm font-medium text-left transition-all border border-gray-200/80 rounded-xl px-3 py-2 bg-white hover:border-gray-300 ${label ? 'text-gray-700' : 'text-gray-400'}`}>
      <Calendar size={14} className="flex-shrink-0 text-gray-400" />
      <span className="truncate flex-1">{label || 'Digite um vencimento'}</span>
    </button>
  )

  return (
    <>
      {trigger}
      {open && btnRef.current && (
        <FloatingPanel anchor={btnRef.current} onClose={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="p-1 border border-gray-200 rounded-xl shadow-2xl bg-white w-[280px]">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input placeholder="Digite um vencimento" className="w-full pl-7 pr-2 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
              </div>
            </div>

            <div className="py-1">
              {quickDateOptions().slice(0, 4).map((o, i) => {
                const icons = [CalendarDays, Sun, Bed, ArrowRight];
                const Icon = icons[i];
                return (
                  <button key={o.label} onClick={() => pick(o.date)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-gray-500" />
                      <span className="text-[12px] text-gray-700">{o.label}</span>
                    </div>
                    <span className="text-[11px] text-gray-400">{i === 3 ? fmtShort(o.date) : o.date.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                  </button>
                )
              })}
            </div>

            <div className="border-t border-gray-100 p-2">
              <MiniCalendar selected={selected} onSelect={pick} />
            </div>

            <div className="border-t border-gray-100 p-1 space-y-1">
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700">
                <Clock size={14} />
                <span className="text-[12px]">Hora</span>
              </button>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700">
                <RotateCw size={14} />
                <span className="text-[12px]">Repetir</span>
              </button>
            </div>
          </div>
        </FloatingPanel>
      )}
    </>
  )
}
