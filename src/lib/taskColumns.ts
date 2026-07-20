import type { ColumnDef, ListColumn, Task, Priority, TaskStatus } from '../types'

// Colunas de sistema padrão (sem "Nome", que fica fixo à esquerda) — sempre disponíveis,
// visíveis por padrão (podem ser ocultadas em "Adicionar um existente").
const SYSTEM: { key: string; label: string; width: number; system: ListColumn['system'] }[] = [
  { key: 'tags',     label: 'Tags',        width: 88,  system: 'tags'     },
  { key: 'assignee', label: 'Responsável', width: 72,  system: 'assignee' },
  { key: 'dueDate',  label: 'Prazo',       width: 116, system: 'dueDate'  },
  { key: 'priority', label: 'Prioridade',  width: 104, system: 'priority' },
]
const PROJECT_COL = { key: 'project', label: 'Projeto', width: 168, system: 'project' as const }

// Propriedades extras do sistema — ocultas por padrão, ligadas em "Adicionar um existente" → Propriedades.
export const EXTRA_SYSTEM: { key: string; label: string; width: number; system: ListColumn['system'] }[] = [
  { key: 'createdAt', label: 'Data de criação',     width: 116, system: 'createdAt' },
  { key: 'updatedAt', label: 'Data de atualização', width: 116, system: 'updatedAt' },
  { key: 'taskType',  label: 'Tipo de tarefa',       width: 132, system: 'taskType'  },
  { key: 'gut',       label: 'GUT',                  width: 100, system: 'gut'       },
  { key: 'progress',  label: 'Progresso',             width: 120, system: 'progress'  },
]
export const BASE_SYSTEM_TOGGLEABLE = SYSTEM

export interface ColumnSort { key: string; dir: 'asc' | 'desc' }

const OKEY = (s: string) => `tf_cols_${s}`
const LKEY = (s: string) => `tf_collabels_${s}`
const SKEY = (s: string) => `tf_colsort_${s}`
const HKEY = (s: string) => `tf_colhidden_${s}`   // colunas de sistema/personalizadas ocultadas
const EKEY = (s: string) => `tf_colextra_${s}`    // propriedades extras ligadas
const WKEY = (s: string) => `tf_colwidths_${s}`   // larguras personalizadas das colunas

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}

export const loadOrder  = (scope: string): string[] | null              => read<string[] | null>(OKEY(scope), null)
export const saveOrder  = (scope: string, order: string[])              => { try { localStorage.setItem(OKEY(scope), JSON.stringify(order)) } catch {} }
export const loadLabels = (scope: string): Record<string, string>       => read<Record<string, string>>(LKEY(scope), {})
export const saveLabels = (scope: string, l: Record<string, string>)    => { try { localStorage.setItem(LKEY(scope), JSON.stringify(l)) } catch {} }
export const loadSort   = (scope: string): ColumnSort | null            => read<ColumnSort | null>(SKEY(scope), null)
export const saveSort   = (scope: string, s: ColumnSort | null)         => { try { s ? localStorage.setItem(SKEY(scope), JSON.stringify(s)) : localStorage.removeItem(SKEY(scope)) } catch {} }
export const loadWidths = (scope: string): Record<string, number>       => read<Record<string, number>>(WKEY(scope), {})
export const saveWidths = (scope: string, w: Record<string, number>)    => { try { localStorage.setItem(WKEY(scope), JSON.stringify(w)) } catch {} }

export const loadHidden = (scope: string): string[]                     => read<string[]>(HKEY(scope), [])
export const saveHidden = (scope: string, keys: string[])               => { try { localStorage.setItem(HKEY(scope), JSON.stringify(keys)) } catch {} }
// "Todas as tarefas" nasce com GUT + Progresso já visíveis (padrão do redesign); as
// demais telas continuam opt-in, como as outras propriedades extras do sistema.
export const loadExtra  = (scope: string): string[]                     => read<string[]>(EKEY(scope), scope === 'alltasks' ? ['gut','progress'] : [])
export const saveExtra  = (scope: string, keys: string[])               => { try { localStorage.setItem(EKEY(scope), JSON.stringify(keys)) } catch {} }

/** Alterna a visibilidade de uma coluna de sistema (base) ou personalizada. */
export function toggleColumnHidden(scope: string, key: string): string[] {
  const cur = loadHidden(scope)
  const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
  saveHidden(scope, next)
  return next
}
/** Liga/desliga uma propriedade extra do sistema (Data de criação, atualização, Tipo de tarefa). */
export function toggleExtraColumn(scope: string, key: string): string[] {
  const cur = loadExtra(scope)
  const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
  saveExtra(scope, next)
  return next
}

// Monta a lista ordenada de colunas, aplicando ordem, rótulos e visibilidade salvos
export function buildColumns(scope: string, custom: ColumnDef[], showProject: boolean): ListColumn[] {
  const hidden = loadHidden(scope)
  const extra  = loadExtra(scope)
  const widths = loadWidths(scope)

  const base: ListColumn[] = SYSTEM.map(s => ({ key: s.key, label: s.label, width: widths[s.key] ?? s.width, kind: 'system', system: s.system }))
  if (showProject) base.push({ key: PROJECT_COL.key, label: PROJECT_COL.label, width: widths[PROJECT_COL.key] ?? PROJECT_COL.width, kind: 'system', system: 'project' })
  EXTRA_SYSTEM.forEach(s => { if (extra.includes(s.key)) base.push({ key: s.key, label: s.label, width: widths[s.key] ?? s.width, kind: 'system', system: s.system }) })
  custom.forEach(c => base.push({ key: c.id, label: c.name, width: widths[c.id] ?? c.width ?? 100, kind: 'custom', col: c }))

  const visible = base.filter(c => !hidden.includes(c.key))

  const order  = loadOrder(scope)
  const labels = loadLabels(scope)

  let cols = visible
  if (order) {
    const map = new Map(visible.map(c => [c.key, c]))
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
    case 'title':     return t.title.toLowerCase()
    case 'assignee':  return (t.assignee || '').toLowerCase()
    case 'priority':  return PRIO_ORDER[t.priority]
    case 'status':    return STATUS_ORDER[t.status]
    case 'dueDate':   return t.dueDate ? new Date(t.dueDate).getTime() : Number.POSITIVE_INFINITY
    case 'tags':      return (t.tags[0] || '').toLowerCase()
    case 'createdAt': return new Date(t.createdAt).getTime()
    case 'updatedAt': return new Date(t.updatedAt).getTime()
    case 'taskType':  return (t.taskType || 'task').toLowerCase()
    case 'gut':       return t.gut?.score ?? -1
    default:          return String(t.customFields?.[key] ?? '').toLowerCase()
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
