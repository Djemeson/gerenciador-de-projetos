import type { Task } from '../types'

// Progresso de uma tarefa: baseado em subtarefas quando existem; se não houver
// subtarefas mas houver checklist(s), cai para a conclusão dos itens de checklist
// (soma de todas as checklists da tarefa). Sem subtarefas nem checklist -> baseado no status da própria tarefa.
export function taskProgress(task: Task, subtasks: Task[]): { pct: number; done: number; total: number } | null {
  if (subtasks.length > 0) {
    const done = subtasks.filter(s => s.status === 'done').length
    return { pct: Math.round((done / subtasks.length) * 100), done, total: subtasks.length }
  }

  const items = task.checklists.flatMap(c => c.items)
  if (items.length > 0) {
    const done = items.filter(i => i.done).length
    return { pct: Math.round((done / items.length) * 100), done, total: items.length }
  }

  // Se não houver nem subtarefas nem checklist, o progresso é determinado pelo status da própria tarefa
  const isDone = task.status === 'done'
  return { pct: isDone ? 100 : 0, done: isDone ? 1 : 0, total: 1 }
}

