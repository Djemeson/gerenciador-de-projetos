import type { CustomProjectView, Task } from '../types'
import { matchesDateFilter } from './dateFilter'

/**
 * Aplica os filtros de uma visualização personalizada a uma lista de tarefas:
 * status (incluindo o pseudo-status 'open' = não concluídas), prioridade,
 * responsável, tags (qualquer uma) e período de data.
 */
export function applyCustomViewFilter(tasks: Task[], view: CustomProjectView): Task[] {
  let result = tasks
  if (view.filterStatus && view.filterStatus !== 'all') {
    result = view.filterStatus === 'open'
      ? result.filter(t => t.status !== 'done')
      : result.filter(t => t.status === view.filterStatus)
  }
  if (view.filterPriority && view.filterPriority !== 'all') {
    result = result.filter(t => t.priority === view.filterPriority)
  }
  if (view.filterAssignee) {
    result = result.filter(t => t.assignee === view.filterAssignee)
  }
  if (view.filterTags && view.filterTags.length > 0) {
    result = result.filter(t => (t.tags ?? []).some(tag => view.filterTags!.includes(tag)))
  }
  if (view.datePeriod) {
    result = result.filter(t => matchesDateFilter(t, view.dateField ?? 'dueDate', view.datePeriod))
  } else if (view.filterDaysBack) {
    // Compatibilidade com visualizações antigas ("últimos N dias")
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - view.filterDaysBack)
    result = result.filter(t => new Date(t.updatedAt) >= cutoff)
  }
  return result
}
