export type Priority   = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type View       = 'my_tasks' | 'all_tasks' | 'projects' | 'project_detail' | 'calendar' | 'reports' | 'inbox' | 'automations'

export const INBOX_PROJECT_ID = '__inbox__'

// ── Spaces ────────────────────────────────────────────────────────────────
export interface Space {
  id: string
  name: string
  color: string
  collapsed: boolean
  createdAt: string
  updatedAt: string
}

// ── Custom columns ────────────────────────────────────────────────────────
export type ColumnType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'money' | 'url'

export interface DropdownOption {
  id: string
  label: string
  color: string   // hex
}

export interface ColumnDef {
  id: string
  name: string
  type: ColumnType
  projectId: string
  dropdownOptions: DropdownOption[]   // for dropdown type (with colors)
  width?: number
}

// ── Views ─────────────────────────────────────────────────────────────────
export type ViewType = 'list' | 'board' | 'table' | 'calendar'

// ── Automations ───────────────────────────────────────────────────────────
export type TriggerType = 'status_changed' | 'priority_changed' | 'task_created' | 'due_date_reached' | 'assignee_changed'
export type ActionType  = 'change_status' | 'change_priority' | 'assign' | 'notify' | 'ai_enrich'

export interface AutomationTrigger {
  type:    TriggerType
  filter?: Record<string, unknown>
}

export interface AutomationAction {
  type:  ActionType
  value?: unknown
}

export interface Automation {
  id:        string
  name:      string
  projectId: string
  trigger:   AutomationTrigger
  action:    AutomationAction
  enabled:   boolean
  createdAt: string
}

// ── GUT ───────────────────────────────────────────────────────────────────
export interface GUT { g: number; u: number; t: number; score: number }

// ── Checklist / Content blocks ────────────────────────────────────────────
export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Checklist     { id: string; title: string; items: ChecklistItem[] }

export type ContentBlockType = 'text' | 'image' | 'audio'
export interface ContentBlock {
  id: string; type: ContentBlockType
  text?: string; data?: string; name?: string; mimeType?: string
}

// ── Task ──────────────────────────────────────────────────────────────────
export interface Task {
  id: string
  projectId: string
  parentId: string | null
  title: string
  description: string
  blocks: ContentBlock[]
  status: TaskStatus
  priority: Priority
  dueDate: string | null
  assignee: string
  tags: string[]
  checklists: Checklist[]
  customFields: Record<string, unknown>   // columnId → value
  createdAt: string
  updatedAt: string
}

// ── Project ───────────────────────────────────────────────────────────────
export interface Project {
  id: string; name: string; color: string; description: string
  spaceId: string | null
  gut: GUT; archived: boolean
  columns: ColumnDef[]           // custom columns for this project
  activeView: ViewType           // which view is selected
  createdAt: string; updatedAt: string
}

export const PROJECT_COLORS = ['#6B5EE8','#1D9E75','#D85A30','#BA7517','#D4537E','#378ADD','#639922','#888780']

export const PRIORITY_LABEL: Record<Priority,   string> = { low:'Baixa', medium:'Média', high:'Alta', urgent:'Urgente' }
export const STATUS_LABEL:   Record<TaskStatus, string> = { todo:'A fazer', in_progress:'Em progresso', done:'Concluído' }

export const GUT_LABEL_G: Record<number,string> = { 1:'Sem gravidade',2:'Pouco grave',3:'Grave',4:'Muito grave',5:'Extremamente grave' }
export const GUT_LABEL_U: Record<number,string> = { 1:'Pode esperar',2:'Pouco urgente',3:'Urgente',4:'Muito urgente',5:'Ação imediata' }
export const GUT_LABEL_T: Record<number,string> = { 1:'Melhora',2:'Estável',3:'Piora levemente',4:'Piora',5:'Piora muito' }

export function calcGUT(g: number, u: number, t: number): GUT { return { g, u, t, score: g * u * t } }

export function gutTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label:'Crítico', color:'#993C1D', bg:'#FAECE7' }
  if (score >= 40) return { label:'Alto',    color:'#854F0B', bg:'#FAEEDA' }
  if (score >= 15) return { label:'Médio',   color:'#185FA5', bg:'#E6F1FB' }
  return               { label:'Baixo',   color:'#0F6E56', bg:'#E1F5EE' }
}

export function migrateTask(raw: Record<string, unknown>): Task {
  const blocks: ContentBlock[] = (raw.blocks as ContentBlock[] | undefined) ?? []
  if (blocks.length === 0) {
    if (raw.content && typeof raw.content === 'string' && raw.content.trim())
      blocks.push({ id: '_text', type: 'text', text: raw.content })
    const atts = raw.attachments as Array<{id:string;type:string;data:string;name:string;mimeType:string}> | undefined
    atts?.forEach(a => blocks.push({ id: a.id, type: a.type as ContentBlockType, data: a.data, name: a.name, mimeType: a.mimeType }))
  }
  return {
    id: String(raw.id ?? ''), projectId: String(raw.projectId ?? ''),
    parentId: (raw.parentId as string|null) ?? null,
    title: String(raw.title ?? ''), description: String(raw.description ?? ''),
    blocks, status: (raw.status as TaskStatus) ?? 'todo',
    priority: (raw.priority as Priority) ?? 'medium',
    dueDate: (raw.dueDate as string|null) ?? null,
    assignee: String(raw.assignee ?? ''),
    tags: (raw.tags as string[]) ?? [],
    checklists: (raw.checklists as Checklist[]) ?? [],
    customFields: (raw.customFields as Record<string,unknown>) ?? {},
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  }
}
