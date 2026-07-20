import type { DateFieldKey, DateFilterValue, PeriodKey, Task } from '../types'

// ── Rótulos e agrupamento (para o dropdown de período) ──────────────────────
export const PERIOD_LABEL: Record<PeriodKey, string> = {
  today:         'Hoje',
  yesterday:     'Ontem',
  tomorrow:      'Amanhã',
  this_week:     'Esta semana',
  last_week:     'Semana passada',
  next_week:     'Próxima semana',
  last_7_days:   'Últimos 7 dias',
  last_30_days:  'Últimos 30 dias',
  this_month:    'Este mês',
  last_month:    'Mês passado',
  this_quarter:  'Este trimestre',
  last_quarter:  'Trimestre passado',
  this_year:     'Este ano',
  last_year:     'Ano passado',
  next_year:     'Próximo ano',
  exact_date:    'Data exata',
  before_date:   'Antes da data',
  after_date:    'Depois da data',
  between:       'Período personalizado',
}

export const PERIOD_GROUPS: { label: string; periods: PeriodKey[] }[] = [
  {
    label: 'Relativo',
    periods: [
      'today', 'yesterday', 'tomorrow',
      'this_week', 'last_week', 'next_week',
      'last_7_days', 'last_30_days',
      'this_month', 'last_month',
      'this_quarter', 'last_quarter',
      'this_year', 'last_year', 'next_year',
    ],
  },
  {
    label: 'Específico',
    periods: ['exact_date', 'before_date', 'after_date', 'between'],
  },
]

// Períodos que precisam de uma data escolhida manualmente
export const PERIODS_NEEDING_DATE  = new Set<PeriodKey>(['exact_date', 'before_date', 'after_date'])
export const PERIODS_NEEDING_RANGE = new Set<PeriodKey>(['between'])

export const DATE_FIELD_LABEL: Record<DateFieldKey, string> = {
  dueDate:     'Data de vencimento',
  completedAt: 'Data de conclusão',
  createdAt:   'Data de criação',
}

// ── Helpers de data ──────────────────────────────────────────────────────────
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date): Date { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1) }
function startOfQuarter(d: Date): Date { return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1) }
function startOfYear(d: Date): Date { return new Date(d.getFullYear(), 0, 1) }

export function isoDate(d: Date): string {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 10)
}
export function parseISO(s: string): Date {
  // aceita 'YYYY-MM-DD' (data local, sem deslocar fuso) ou ISO completo
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00')
  return new Date(s)
}

export interface Range { start: Date | null; end: Date | null } // [start, end)

/** Resolve um DateFilterValue num intervalo [start, end) concreto, relativo a `now`. */
export function resolvePeriodRange(value: DateFilterValue, now: Date = new Date()): Range {
  const today0 = startOfDay(now)
  switch (value.period) {
    case 'today':        return { start: today0,                 end: addDays(today0, 1) }
    case 'yesterday':     return { start: addDays(today0, -1),     end: today0 }
    case 'tomorrow':      return { start: addDays(today0, 1),      end: addDays(today0, 2) }
    case 'this_week':     { const s = startOfWeek(now); return { start: s, end: addDays(s, 7) } }
    case 'last_week':     { const s = startOfWeek(now); return { start: addDays(s, -7), end: s } }
    case 'next_week':     { const s = startOfWeek(now); return { start: addDays(s, 7),  end: addDays(s, 14) } }
    case 'last_7_days':   return { start: addDays(today0, -6),     end: addDays(today0, 1) }
    case 'last_30_days':  return { start: addDays(today0, -29),    end: addDays(today0, 1) }
    case 'this_month':    { const s = startOfMonth(now); return { start: s, end: addMonths(s, 1) } }
    case 'last_month':    { const s = startOfMonth(now); return { start: addMonths(s, -1), end: s } }
    case 'this_quarter':  { const s = startOfQuarter(now); return { start: s, end: addMonths(s, 3) } }
    case 'last_quarter':  { const s = startOfQuarter(now); return { start: addMonths(s, -3), end: s } }
    case 'this_year':     { const s = startOfYear(now); return { start: s, end: new Date(s.getFullYear() + 1, 0, 1) } }
    case 'last_year':     { const s = startOfYear(now); return { start: new Date(s.getFullYear() - 1, 0, 1), end: s } }
    case 'next_year':     { const s = startOfYear(now); return { start: new Date(s.getFullYear() + 1, 0, 1), end: new Date(s.getFullYear() + 2, 0, 1) } }
    case 'exact_date':    { if (!value.date) return { start: null, end: null }; const d = startOfDay(parseISO(value.date)); return { start: d, end: addDays(d, 1) } }
    case 'before_date':   { if (!value.date) return { start: null, end: null }; return { start: null, end: startOfDay(parseISO(value.date)) } }
    case 'after_date':    { if (!value.date) return { start: null, end: null }; return { start: addDays(startOfDay(parseISO(value.date)), 1), end: null } }
    case 'between':       {
      const s = value.start ? startOfDay(parseISO(value.start)) : null
      const e = value.end   ? addDays(startOfDay(parseISO(value.end)), 1) : null
      return { start: s, end: e }
    }
    default: return { start: null, end: null }
  }
}

/** Rótulo amigável de um DateFilterValue já resolvido (para exibir no botão do filtro). */
export function periodDisplayLabel(value: DateFilterValue): string {
  if (value.period === 'exact_date' && value.date)  return new Date(parseISO(value.date)).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })
  if (value.period === 'before_date' && value.date) return `Antes de ${new Date(parseISO(value.date)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}`
  if (value.period === 'after_date'  && value.date) return `Depois de ${new Date(parseISO(value.date)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}`
  if (value.period === 'between') {
    const s = value.start ? new Date(parseISO(value.start)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '?'
    const e = value.end   ? new Date(parseISO(value.end)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})   : '?'
    return `${s} – ${e}`
  }
  return PERIOD_LABEL[value.period] ?? 'Período'
}

/** Valor de data "efetivo" de uma tarefa para o campo escolhido. */
export function taskDateValue(task: Task, field: DateFieldKey): string | null {
  if (field === 'dueDate')     return task.dueDate ?? null
  if (field === 'createdAt')   return task.createdAt ?? null
  if (field === 'completedAt') return task.status === 'done' ? task.updatedAt : null
  return null
}

/** Verifica se uma tarefa cai dentro do filtro de período para o campo dado. */
export function matchesDateFilter(task: Task, field: DateFieldKey, filter: DateFilterValue | undefined | null): boolean {
  if (!filter) return true
  const raw = taskDateValue(task, field)
  if (!raw) return false
  const { start, end } = resolvePeriodRange(filter)
  const t = parseISO(raw).getTime()
  if (start && t < start.getTime()) return false
  if (end   && t >= end.getTime())  return false
  return true
}
