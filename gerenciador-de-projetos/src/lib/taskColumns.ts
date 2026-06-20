import type { ColumnDef, ListColumn, Task, Priority, TaskStatus } from '../types'

// Colunas de sistema padrão (sem "Nome", que fica fixo à esquerda)
const SYSTEM: { key: string; label: string; width: number; system: ListColumn['system'] }[] = [
  { key: 'tags',     label: 'Tags',        width: 112, system: 'tags'     },
  { key: 'assignee', label: 'Responsável', width: 104, system: 'assignee' },
  { key: 'dueDate',  label: 'Prazo',       width: 104, system: 'dueDate'  },
  { key: 'priority', label: 'Prioridade',  width: 100, system: 'priority' },
]
const PROJECT_COL = { key: 'project', label: 'Projeto', width: 112, system: 'project' as const }

export interface ColumnSort { key: string; dir: 'asc' | 'desc' }

const OKEY = (s: string) => `tf_cols_${s}`
const LKEY = (s: string) => `tf_collabels_${s}`
const SKEY = (s: string) => `tf_colsort_${s}`

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}

export const loadOrder  = (scope: string): string[] | null              => read<string[] | null>(OKEY(scope), null)
export const saveOrder  = (scope: string, order: string[])              => { try { localStorage.setItem(OKEY(scope), JSON.stringify(order)) } catch {} }
export const loadLabels = (scope: string): Record<string, string>       => read<Record<string, string>>(LKEY(scope), {})
export const saveLabels = (scope: string, l: Record<string, string>)    => { try { localStorage.setItem(LKEY(scope), JSON.stringify(l)) } catch {} }
export const loadSort   = (scope: string): ColumnSort | null            => read<ColumnSort | null>(SKEY(scope), null)
export const saveSort   = (scope: string, s: ColumnSort | null)         => { try { s ? localStorage.setItem(SKEY(scope), JSON.stringify(s)) : localStorage.removeItem(SKEY(scope)) } catch {} }

// Monta a lista ordenada de colunas, aplicando ordem e rótulos salvos
export function buildColumns(scope: string, custom: ColumnDef[], showProject: boolean): ListColumn[] {
  const base: ListColumn[] = SYSTEM.map(s => ({ key: s.key, label: s.label, width: s.width, kind: 'system', system: s.system }))
  if (showProject) base.push({ key: PROJECT_COL.key, label: PROJECT_COL.label, width: PROJECT_COL.width, kind: 'system', system: 'project' })
  custom.forEach(c => base.push({ key: c.id, label: c.name, width: c.width ?? 100, kind: 'custom', col: c }))

  const order  = loadOrder(scope)
  const labels = loadLabels(scope)

  let cols = base
  if (order) {
    const map = new Map(base.map(c => [c.key, c]))
    const ordered: ListColumn[] = []
    order.forEach(k => { const c = map.get(k); if (c) { ordered.push(c); map.delete(k) } })
    map.forEach(c => ordered.push(c)) // colunas novas (ainda sem ordem salva) vão pro fim
    cols = ordered
  }
  return cols.map(c => (labels[c.key] !== undefined ? { ...c, label: labels[c.key] } : c))
}

const PRIO_ORDER:   Record<Priority, number>   = { urgent: 0, high: 1, medium: 2, low: 3 }
const STATUS_ORDER: Record<TaskStatus, number> = { in_progress: 0, todo: 1, done: 2 }

// Valor comparável de uma tarefa para uma chave de coluna
function cmpValue(t: Task, key: string): string | number {
  switch (key) {
    case 'title':    return t.title.toLowerCase()
    case 'assignee': return (t.assignee || '').toLowerCase()
    case 'priority': return PRIO_ORDER[t.priority]
    case 'status':   return STATUS_ORDER[t.status]
    case 'dueDate':  return t.dueDate ? new Date(t.dueDate).getTime() : Number.POSITIVE_INFINITY
    case 'tags':     return (t.tags[0] || '').toLowerCase()
    default:         return String(t.customFields?.[key] ?? '').toLowerCase()
  }
}

export function sortTasks(tasks: Task[], sort: ColumnSort | null): Task[] {
  if (!sort) return tasks
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...tasks].sort((a, b) => {
    const va = cmpValue(a, sort.key), vb = cmpValue(b, sort.key)
    if (va < vb) return -1 * dir
    if (va > vb) return  1 * dir
    return 0
  })
}
