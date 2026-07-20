import React, { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Trash2 } from 'lucide-react'
import type { DateFieldKey, DateFilterValue, PeriodKey } from '../../types'
import {
  PERIOD_LABEL, PERIOD_GROUPS, PERIODS_NEEDING_DATE, PERIODS_NEEDING_RANGE,
  DATE_FIELD_LABEL, periodDisplayLabel, isoDate, parseISO,
} from '../../lib/dateFilter'
import { Select } from './Select'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x }
export function fmtShort(d: Date) { return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) }

// Exportada — reusada pelo `DueDatePicker` (data única de tarefa), fonte única dos atalhos
// de data relativos (Hoje/Amanhã/fim de semana/semana que vem).
export function quickDateOptions(): { label: string; date: Date }[] {
  const today = new Date(); today.setHours(0,0,0,0)
  const day = today.getDay() // 0=Dom..6=Sáb
  const thisSaturday = addDays(today, (6 - day + 7) % 7)
  const nextMonday   = addDays(today, ((1 - day + 7) % 7) || 7)
  const nextSaturday = addDays(thisSaturday, 7)
  return [
    { label: 'Hoje',                   date: today },
    { label: 'Amanhã',                 date: addDays(today, 1) },
    { label: 'Este final de semana',   date: thisSaturday },
    { label: 'Semana que vem',         date: nextMonday },
    { label: 'Próximo final de semana',date: nextSaturday },
    { label: '2 semanas',              date: addDays(today, 14) },
    { label: '4 semanas',              date: addDays(today, 28) },
  ]
}

// ── Mini calendário ──────────────────────────────────────────────────────────
// Exportado — reusado pelo `DueDatePicker` (data única de tarefa), único componente de
// calendário do app; não recriar uma grade de dias em outro lugar.
export function MiniCalendar({ selected, onSelect }: { selected: Date | null; onSelect: (d: Date) => void }) {
  const base = selected ?? new Date()
  const [year,  setYear]  = useState(base.getFullYear())
  const [month, setMonth] = useState(base.getMonth())
  const today = new Date()

  const firstDay     = new Date(year, month, 1).getDay()
  const daysInMonth  = new Date(year, month+1, 0).getDate()
  const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); onSelect(new Date(today.getFullYear(),today.getMonth(),today.getDate())) }

  return (
    <div className="w-[220px] flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <button onClick={()=>{ if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1) }}
          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"><ChevronLeft size={13}/></button>
        <span className="text-[11px] font-medium text-gray-700">{MONTHS[month]} {year}</span>
        <button onClick={()=>{ if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1) }}
          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"><ChevronRight size={13}/></button>
      </div>
      <div className="flex justify-end mb-1">
        <button onClick={goToday} className="text-[10px] text-brand-600 hover:text-brand-700 font-medium">Hoje</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map(d=><div key={d} className="text-center text-[9px] text-gray-400 py-0.5">{d}</div>)}
        {cells.map((day,i)=>{
          if (!day) return <div key={i}/>
          const d = new Date(year, month, day)
          const isSel   = !!selected && isoDate(selected)===isoDate(d)
          const isToday = isoDate(today)===isoDate(d)
          return (
            <button key={i} onClick={()=>onSelect(d)}
              className={`text-[10px] h-6 rounded-md transition-colors
                ${isSel ? 'bg-brand-600 text-white font-medium' : isToday ? 'text-brand-600 font-medium hover:bg-gray-100' : 'text-gray-600 hover:bg-gray-100'}`}>
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Seletor de uma única data (chips rápidos + calendário) ──────────────────
function SingleDatePicker({ value, onChange }: { value?: string; onChange: (iso: string) => void }) {
  const selected = value ? parseISO(value) : null
  return (
    <div className="flex gap-3 p-3">
      <div className="w-[132px] flex-shrink-0 space-y-0.5">
        {quickDateOptions().map(o => (
          <button key={o.label} onClick={()=>onChange(isoDate(o.date))}
            className="w-full flex items-center justify-between px-2 py-1 rounded-lg hover:bg-gray-50 text-left transition-colors">
            <span className="text-[11px] text-gray-700">{o.label}</span>
            <span className="text-[10px] text-gray-400">{fmtShort(o.date)}</span>
          </button>
        ))}
      </div>
      <div className="w-px bg-gray-100"/>
      <MiniCalendar selected={selected} onSelect={d=>onChange(isoDate(d))}/>
    </div>
  )
}

// ── Seletor de intervalo (De/Até) ────────────────────────────────────────────
function RangeDatePicker({ start, end, onChange }: { start?: string; end?: string; onChange: (s:string,e:string)=>void }) {
  const [editing, setEditing] = useState<'start'|'end'>('start')
  const sel = editing==='start' ? (start?parseISO(start):null) : (end?parseISO(end):null)

  const pick = (d: Date) => {
    if (editing==='start') {
      const s = isoDate(d)
      onChange(s, end && end>=s ? end : s)
      setEditing('end')
    } else {
      const e = isoDate(d)
      onChange(start && start<=e ? start : e, e)
    }
  }

  return (
    <div className="p-3">
      <div className="flex gap-2 mb-2">
        <button onClick={()=>setEditing('start')}
          className={`flex-1 text-[11px] px-2 py-1.5 rounded-lg border transition-colors text-left ${editing==='start'?'border-brand-400 bg-brand-50 text-brand-700':'border-gray-200 text-gray-600'}`}>
          <span className="block text-[9px] text-gray-400">De</span>
          {start ? fmtShort(parseISO(start)) : 'Selecionar'}
        </button>
        <button onClick={()=>setEditing('end')}
          className={`flex-1 text-[11px] px-2 py-1.5 rounded-lg border transition-colors text-left ${editing==='end'?'border-brand-400 bg-brand-50 text-brand-700':'border-gray-200 text-gray-600'}`}>
          <span className="block text-[9px] text-gray-400">Até</span>
          {end ? fmtShort(parseISO(end)) : 'Selecionar'}
        </button>
      </div>
      <div className="flex gap-3">
        <div className="w-[120px] flex-shrink-0 space-y-0.5">
          {quickDateOptions().map(o => (
            <button key={o.label} onClick={()=>pick(o.date)}
              className="w-full flex items-center justify-between px-2 py-1 rounded-lg hover:bg-gray-50 text-left transition-colors">
              <span className="text-[11px] text-gray-700">{o.label}</span>
              <span className="text-[10px] text-gray-400">{fmtShort(o.date)}</span>
            </button>
          ))}
        </div>
        <div className="w-px bg-gray-100"/>
        <MiniCalendar selected={sel} onSelect={pick}/>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export interface DatePeriodPickerProps {
  field:         DateFieldKey
  fieldOptions?: DateFieldKey[]
  onFieldChange?: (f: DateFieldKey) => void
  value:         DateFilterValue | undefined
  onChange:      (v: DateFilterValue | undefined) => void
  onRemove?:     () => void
}

export function DatePeriodPicker({ field, fieldOptions, onFieldChange, value, onChange, onRemove }: DatePeriodPickerProps) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [sub, setSub]       = useState<'list'|PeriodKey>('list')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setOpen(false); setSub('list'); setSearch('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const pickPeriod = (p: PeriodKey) => {
    if (PERIODS_NEEDING_DATE.has(p))  { setSub(p); onChange({ period: p }); return }
    if (PERIODS_NEEDING_RANGE.has(p)) { setSub(p); onChange({ period: p }); return }
    onChange({ period: p }); setOpen(false); setSub('list'); setSearch('')
  }

  const filteredGroups = PERIOD_GROUPS.map(g => ({
    ...g,
    periods: g.periods.filter(p => PERIOD_LABEL[p].toLowerCase().includes(search.toLowerCase())),
  })).filter(g => g.periods.length>0)

  return (
    <div ref={ref} className="relative flex items-center gap-1.5 flex-wrap">
      {fieldOptions && fieldOptions.length>1 && (
        <Select value={field} onChange={v=>onFieldChange?.(v as DateFieldKey)} ariaLabel="Campo de data"
          options={fieldOptions.map(f => ({ value:f, label: DATE_FIELD_LABEL[f] }))}/>
      )}
      <span className="text-[11px] text-gray-400 flex-shrink-0">É</span>

      <button onClick={()=>setOpen(v=>!v)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 hover:border-gray-300 transition-colors min-w-[120px]">
        <CalendarIcon size={11} className="text-gray-400 flex-shrink-0"/>
        <span className="flex-1 text-left truncate">{value ? periodDisplayLabel(value) : 'Selecionar período'}</span>
        <ChevronDown size={11} className="text-gray-400 flex-shrink-0"/>
      </button>

      {onRemove && (
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="Remover filtro">
          <Trash2 size={13}/>
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden" style={{minWidth: sub==='list' ? 220 : 'auto'}}>
          {sub === 'list' ? (
            <>
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar..."
                    className="w-full pl-7 pr-2 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"/>
                </div>
              </div>
              <div className="max-h-[280px] overflow-y-auto py-1">
                {filteredGroups.map(g => (
                  <div key={g.label}>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1">{g.label}</p>
                    {g.periods.map(p => (
                      <button key={p} onClick={()=>pickPeriod(p)}
                        className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 transition-colors ${value?.period===p?'text-brand-600 font-medium bg-brand-50/50':'text-gray-700'}`}>
                        {PERIOD_LABEL[p]}
                      </button>
                    ))}
                  </div>
                ))}
                {filteredGroups.length===0 && <p className="text-[11px] text-gray-400 px-3 py-3">Nenhum período encontrado.</p>}
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                <button onClick={()=>setSub('list')} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={13}/></button>
                <span className="text-[11px] font-medium text-gray-700 flex-1">{PERIOD_LABEL[sub]}</span>
                <button onClick={()=>{setOpen(false);setSub('list')}} className="text-gray-300 hover:text-gray-500"><X size={13}/></button>
              </div>
              {PERIODS_NEEDING_RANGE.has(sub) ? (
                <RangeDatePicker start={value?.start} end={value?.end}
                  onChange={(s,e)=>onChange({ period: sub, start:s, end:e })}/>
              ) : (
                <SingleDatePicker value={value?.date}
                  onChange={d=>{ onChange({ period: sub, date: d }); setOpen(false); setSub('list') }}/>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
