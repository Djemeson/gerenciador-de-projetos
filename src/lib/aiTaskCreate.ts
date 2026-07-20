import type { AIGeneratedTask } from './aiProjectGen'
import type { Task, TaskStatus } from '../types'
import { nanoid } from './nanoid'

type AddTaskFn = (task: Omit<Task, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>) => Task

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Cria recursivamente um item gerado por IA (e suas subtarefas, em qualquer
 *  profundidade) como tarefas reais do projeto — fonte única usada tanto na
 *  criação de projeto por IA quanto no enriquecimento de projeto existente. */
export function createTaskTree(
  addTask: AddTaskFn,
  projectId: string,
  parentId: string | null,
  item: AIGeneratedTask,
  status: TaskStatus = 'todo',
): Task {
  const created = addTask({
    projectId, parentId, title: item.title,
    description: '',
    blocks: item.description ? [{ id: nanoid(), type: 'text', text: escapeHtml(item.description) }] : [],
    status, priority: item.priority ?? (parentId ? 'low' : 'medium'),
    taskType: item.taskType ?? 'task',
    dueDate: null, assignee: 'DJ', tags: [], checklists: [], customFields: {}, comments: [],
  })
  for (const sub of item.subtasks ?? []) {
    createTaskTree(addTask, projectId, created.id, sub, status)
  }
  return created
}

export function countTaskTree(items: AIGeneratedTask[]): number {
  return items.reduce((acc, t) => acc + 1 + countTaskTree(t.subtasks ?? []), 0)
}
