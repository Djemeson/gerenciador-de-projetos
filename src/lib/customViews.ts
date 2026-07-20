import type { CustomProjectView, Task } from '../types'
import { matchesDateFilter } from './dateFilter'

/** Aplica os filtros de uma visualização personalizada (status + período de data) a uma lista de tarefas. */
export function applyCustomViewFilter(tasks: Task[], view: CustomProjectView): Task[] {
  let result = tasks
  if (view.filterStatus && view.filterStatus !== 'all') {
    result = result.filter(t => t.status === view.filterStatus)
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
