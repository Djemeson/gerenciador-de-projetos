export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type View = 'my_tasks' | 'all_tasks' | 'projects' | 'project_detail' | 'calendar' | 'reports'

export interface GUT {
  g: number
  u: number
  t: number
  score: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Checklist {
  id: string
  title: string
  items: ChecklistItem[]
}

export interface Attachment {
  id: string
  type: 'image' | 'audio'
  name: string
  data: string   // base64
  mimeType: string
}

export interface Task {
  id: string
  projectId: string
  parentId: string | null   // null = tarefa raiz; string = subtarefa
  title: string
  description: string
  content: string           // corpo rico (texto longo)
  attachments: Attachment[]
  status: TaskStatus
  priority: Priority
  dueDate: string | null
  assignee: string
  tags: string[]
  checklists: Checklist[]
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
  '#6B5EE8','#1D9E75','#D85A30','#BA7517',
  '#D4537E','#378ADD','#639922','#888780',
]

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'A fazer', in_progress: 'Em progresso', done: 'Concluído',
}

export const GUT_LABEL_G: Record<number, string> = {
  1:'Sem gravidade', 2:'Pouco grave', 3:'Grave', 4:'Muito grave', 5:'Extremamente grave',
}
export const GUT_LABEL_U: Record<number, string> = {
  1:'Pode esperar', 2:'Pouco urgente', 3:'Urgente', 4:'Muito urgente', 5:'Ação imediata',
}
export const GUT_LABEL_T: Record<number, string> = {
  1:'Melhora', 2:'Estável', 3:'Piora levemente', 4:'Piora', 5:'Piora muito',
}

export function calcGUT(g: number, u: number, t: number): GUT {
  return { g, u, t, score: g * u * t }
}

export function gutTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Crítico', color: '#993C1D', bg: '#FAECE7' }
  if (score >= 40) return { label: 'Alto',    color: '#854F0B', bg: '#FAEEDA' }
  if (score >= 15) return { label: 'Médio',   color: '#185FA5', bg: '#E6F1FB' }
  return               { label: 'Baixo',   color: '#0F6E56', bg: '#E1F5EE' }
}

// Migração: garante que tarefas antigas têm os campos novos
export function migrateTask(t: Partial<Task> & { id: string; title: string }): Task {
  return {
    projectId: '', parentId: null, description: '', content: '',
    attachments: [], status: 'todo', priority: 'medium',
    dueDate: null, assignee: '', tags: [], checklists: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...t,
  }
}
