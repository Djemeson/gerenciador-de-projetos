// Cálculos do painel de Relatórios. Ficam aqui, fora da view, porque são a parte do
// relatório que precisa ser lida e conferida com calma — a tela só desenha o resultado.
import type { Task, Project, Space, DateFieldKey, DateFilterValue } from '../types'
import { resolvePeriodRange, taskDateValue, parseISO, type Range } from './dateFilter'
import { taskProgress } from './taskProgress'

const DAY = 86_400_000
export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const addDays    = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const daysBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY))

// ── Intervalos ───────────────────────────────────────────────────────────────

/** Intervalo efetivo do relatório; lados abertos caem para as datas das próprias tarefas. */
export function effectiveRange(
  period: DateFilterValue | undefined, tasks: Task[], field: DateFieldKey, now: Date,
): { start: Date; end: Date } {
  const today0 = startOfDay(now)
  if (!period) return { start: addDays(today0, -6), end: addDays(today0, 1) }  // padrão: 7 dias

  const r: Range = resolvePeriodRange(period, now)
  const times = tasks.map(t => taskDateValue(t, field)).filter(Boolean).map(d => parseISO(d as string).getTime())
  const min = times.length ? new Date(Math.min(...times)) : null
  const max = times.length ? new Date(Math.max(...times)) : null
  return {
    start: startOfDay(r.start ?? min ?? addDays(today0, -6)),
    end:   r.end ?? addDays(startOfDay(max ?? today0), 1),
  }
}

/**
 * Janela imediatamente anterior, do mesmo tamanho — é ela que dá sentido ao "+12% vs.
 * período anterior". Um recorte de 1 a 31 de julho compara com 1 a 30 de junho.
 */
export function previousRange(range: { start: Date; end: Date }): { start: Date; end: Date } {
  const span = Math.max(DAY, range.end.getTime() - range.start.getTime())
  return { start: new Date(range.start.getTime() - span), end: new Date(range.start.getTime()) }
}

export function tasksInRange(tasks: Task[], field: DateFieldKey, range: { start: Date; end: Date }): Task[] {
  return tasks.filter(t => {
    const raw = taskDateValue(t, field)
    if (!raw) return false
    const time = parseISO(raw).getTime()
    return time >= range.start.getTime() && time < range.end.getTime()
  })
}

// ── Variação entre períodos ─────────────────────────────────────────────────

export interface Delta { abs: number; pct: number | null; direction: 'up' | 'down' | 'flat' }

/** `pct` é null quando não havia base de comparação (dividir por zero não vira "+100%"). */
export function delta(current: number, previous: number): Delta {
  const abs = current - previous
  return {
    abs,
    pct: previous === 0 ? null : Math.round((abs / previous) * 100),
    direction: abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat',
  }
}

// ── Indicadores ─────────────────────────────────────────────────────────────

export interface Kpis {
  total: number
  done: number
  active: number
  overdue: number
  urgent: number
  completionRate: number
  /** Dias entre criação e conclusão, média das concluídas. */
  leadTimeDays: number | null
  /** Idade média das tarefas ainda abertas, em dias. */
  backlogAgeDays: number | null
  /** Abertas sem nenhuma edição há 14 dias ou mais. */
  stalled: Task[]
}

export const STALLED_DAYS = 14

export function computeKpis(tasks: Task[], now: Date): Kpis {
  const roots   = tasks.filter(t => !t.parentId)
  const active  = roots.filter(t => t.status !== 'done')
  const done    = tasks.filter(t => t.status === 'done')
  const doneRoots = roots.filter(t => t.status === 'done')

  const leads = done
    .map(t => {
      const end = t.completedAt ?? (t.status === 'done' ? t.updatedAt : null)
      return end ? daysBetween(parseISO(t.createdAt), parseISO(end)) : null
    })
    .filter((n): n is number => n !== null)

  const ages = active.map(t => daysBetween(parseISO(t.createdAt), now))

  return {
    total: roots.length,
    done: doneRoots.length,
    active: active.length,
    overdue: active.filter(t => t.dueDate && parseISO(t.dueDate) < now).length,
    urgent: active.filter(t => t.priority === 'urgent').length,
    completionRate: roots.length ? Math.round((doneRoots.length / roots.length) * 100) : 0,
    leadTimeDays:   leads.length ? Math.round(leads.reduce((s, n) => s + n, 0) / leads.length) : null,
    backlogAgeDays: ages.length  ? Math.round(ages.reduce((s, n) => s + n, 0) / ages.length)   : null,
    stalled: active.filter(t => daysBetween(parseISO(t.updatedAt), now) >= STALLED_DAYS),
  }
}

// ── Série do gráfico ────────────────────────────────────────────────────────

export type Granularity = 'day' | 'week' | 'month'
export interface Bucket { label: string; start: Date; end: Date; created: number; completed: number }

const MAX_BUCKETS = 24

export function granularityFor(range: { start: Date; end: Date }): Granularity {
  const days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / DAY))
  return days <= 14 ? 'day' : days <= 92 ? 'week' : 'month'
}

/**
 * Duas séries no mesmo eixo: criadas e concluídas. É a comparação que responde "entra
 * mais do que sai?" — uma série só de concluídas não diz se o backlog está crescendo.
 */
export function buildSeries(tasks: Task[], range: { start: Date; end: Date }): { buckets: Bucket[]; step: Granularity } {
  const step = granularityFor(range)
  const days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / DAY))

  const buckets: Bucket[] = []
  let cursor = step === 'month' ? new Date(range.start.getFullYear(), range.start.getMonth(), 1) : startOfDay(range.start)
  while (cursor < range.end && buckets.length < MAX_BUCKETS) {
    const next = step === 'day'  ? addDays(cursor, 1)
               : step === 'week' ? addDays(cursor, 7)
               : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    buckets.push({
      label: step === 'day'  ? (days <= 7 ? cursor.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                                          : cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))
           : step === 'week' ? cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
           :                   cursor.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      start: cursor, end: next, created: 0, completed: 0,
    })
    cursor = next
  }

  const place = (raw: string | null | undefined, key: 'created' | 'completed') => {
    if (!raw) return
    const time = parseISO(raw).getTime()
    const b = buckets.find(b => time >= b.start.getTime() && time < b.end.getTime())
    if (b) b[key]++
  }
  tasks.forEach(t => {
    place(t.createdAt, 'created')
    place(t.completedAt ?? (t.status === 'done' ? t.updatedAt : null), 'completed')
  })

  return { buckets, step }
}

// ── Agrupamentos ────────────────────────────────────────────────────────────

export interface GroupRow { key: string; label: string; color: string; total: number; done: number; overdue: number; urgent: number; pct: number }

function summarize(key: string, label: string, color: string, rows: Task[], now: Date): GroupRow {
  const roots = rows.filter(t => !t.parentId)
  const done  = roots.filter(t => t.status === 'done').length
  return {
    key, label, color,
    total: roots.length,
    done,
    overdue: roots.filter(t => t.status !== 'done' && t.dueDate && parseISO(t.dueDate) < now).length,
    urgent:  roots.filter(t => t.status !== 'done' && t.priority === 'urgent').length,
    pct: roots.length ? Math.round((done / roots.length) * 100) : 0,
  }
}

export function bySpace(tasks: Task[], projects: Project[], spaces: Space[], now: Date): GroupRow[] {
  const projectSpace = new Map(projects.map(p => [p.id, p.spaceId]))
  return spaces
    .map(s => summarize(s.id, s.name, s.color, tasks.filter(t => projectSpace.get(t.projectId) === s.id), now))
    .concat([summarize('__none', 'Sem espaço', '#888780', tasks.filter(t => !projectSpace.get(t.projectId)), now)])
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
}

export function byTag(tasks: Task[], now: Date): GroupRow[] {
  const tags = [...new Set(tasks.flatMap(t => t.tags))].filter(Boolean)
  return tags
    .map(tag => summarize(tag, tag, '#6366F1', tasks.filter(t => t.tags.includes(tag)), now))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
}

export function byAssignee(tasks: Task[], now: Date): GroupRow[] {
  const people = [...new Set(tasks.map(t => t.assignee))].filter(Boolean)
  return people
    .map(p => summarize(p, p, '#6366F1', tasks.filter(t => t.assignee === p), now))
    .sort((a, b) => b.total - a.total)
}

/** Tarefas abertas com maior pontuação GUT — o "o que atacar primeiro" da metodologia. */
export function topByGut(tasks: Task[], limit = 8): Task[] {
  return tasks
    .filter(t => t.status !== 'done' && t.gut && t.gut.score > 0)
    .sort((a, b) => (b.gut!.score - a.gut!.score))
    .slice(0, limit)
}

/**
 * Progresso real de um conjunto de tarefas: média do progresso de cada raiz, contando
 * subtarefas e checklists (`taskProgress`, seção 4.9). É diferente de "% concluídas" —
 * um projeto com tudo pela metade aparece como 0% no cálculo por status e ~50% aqui.
 */
export function averageProgress(roots: Task[], all: Task[]): number | null {
  if (!roots.length) return null
  const pcts = roots.map(t => taskProgress(t, all.filter(s => s.parentId === t.id))?.pct ?? 0)
  return Math.round(pcts.reduce((s, n) => s + n, 0) / pcts.length)
}
