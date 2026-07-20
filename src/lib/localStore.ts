// Persistência local via localStorage — ativo quando Firebase não está configurado
import type { Project, Task } from '../types'

const PROJECTS_KEY = 'tf_projects'
const TASKS_KEY    = 'tf_tasks'

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}

export const localProjects = {
  getAll: (): Project[]           => load<Project>(PROJECTS_KEY),
  set:    (data: Project[]) => save(PROJECTS_KEY, data),
}

export const localTasks = {
  getAll: (): Task[]         => load<Task>(TASKS_KEY),
  set:    (data: Task[]) => save(TASKS_KEY, data),
}
