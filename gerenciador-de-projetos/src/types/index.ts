export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type View = 'my_tasks' | 'all_tasks' | 'projects' | 'project_detail' | 'calendar'

export interface GUT {
  g: number  // Gravidade  1-5
  u: number  // Urgência   1-5
  t: number  // Tendência  1-5
  score: number  // G × U × T (1–125)
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  dueDate: string | null   // ISO date string
  assignee: string
  tags: string[]
  subtasks: Subtask[]
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  color: string
  description: string
  gut: GUT
  createdAt: string
  updatedAt: string
}

export const PROJECT_COLORS = [
  '#6B5EE8', // brand purple
  '#1D9E75', // teal
  '#D85A30', // coral
  '#BA7517', // amber
  '#D4537E', // pink
  '#378ADD', // blue
  '#639922', // green
  '#888780', // gray
]

export const PRIORITY_LABEL: Record<Priority, string> = {
  low:    'Baixa',
  medium: 'Média',
  high:   'Alta',
  urgent: 'Urgente',
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'A fazer',
  in_progress: 'Em progresso',
  done:        'Concluído',
}

export const GUT_LABEL_G: Record<number, string> = {
  1: 'Sem gravidade',
  2: 'Pouco grave',
  3: 'Grave',
  4: 'Muito grave',
  5: 'Extremamente grave',
}

export const GUT_LABEL_U: Record<number, string> = {
  1: 'Pode esperar',
  2: 'Pouco urgente',
  3: 'Urgente',
  4: 'Muito urgente',
  5: 'Ação imediata',
}

export const GUT_LABEL_T: Record<number, string> = {
  1: 'Melhora',
  2: 'Estável',
  3: 'Piora levemente',
  4: 'Piora',
  5: 'Piora muito',
}

export function calcGUT(g: number, u: number, t: number): GUT {
  return { g, u, t, score: g * u * t }
}

export function gutTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Crítico',  color: '#993C1D', bg: '#FAECE7' }
  if (score >= 40) return { label: 'Alto',     color: '#854F0B', bg: '#FAEEDA' }
  if (score >= 15) return { label: 'Médio',    color: '#185FA5', bg: '#E6F1FB' }
  return               { label: 'Baixo',    color: '#0F6E56', bg: '#E1F5EE' }
}
