export type Priority   = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type View       = 'my_tasks' | 'all_tasks' | 'projects' | 'project_detail' | 'space_detail' | 'folder_detail' | 'calendar' | 'reports' | 'inbox' | 'automations' | 'goals'

export const INBOX_PROJECT_ID = '__inbox__'

// ── Workspaces ────────────────────────────────────────────────────────────
export interface Workspace {
  id: string
  name: string
  color: string        // cor do avatar (letra) quando não é o workspace padrão
  icon?: string        // ícone lucide (kebab-case)
  createdAt: string
}

export const DEFAULT_WORKSPACE_ID = 'default'

// ── Metas / Objetivos (OKR-like) ────────────────────────────────────────────
// Uma Meta agrupa alvos mensuráveis (targets). O progresso da meta é a média do
// progresso de seus alvos (ou manual, se não houver alvos).
export type GoalTargetType = 'number' | 'currency' | 'percent' | 'boolean'
export interface GoalTarget {
  id: string
  name: string
  type: GoalTargetType
  start: number      // valor inicial
  current: number    // valor atual
  target: number     // valor-alvo
}
export type GoalStatus = 'on_track' | 'at_risk' | 'off_track' | 'done'
export interface Goal {
  id: string
  workspaceId: string
  name: string
  description: string
  color: string
  status: GoalStatus
  targetDate: string | null   // prazo (ISO date) opcional
  targets: GoalTarget[]
  createdAt: string
  updatedAt: string
}
export const GOAL_STATUS_META: Record<GoalStatus, { label: string; color: string }> = {
  on_track:  { label: 'No caminho', color: '#1D9E75' },
  at_risk:   { label: 'Em risco',   color: '#D89A18' },
  off_track: { label: 'Atrasada',   color: '#E24B4A' },
  done:      { label: 'Concluída',  color: '#378ADD' },
}
// Progresso de um alvo (0–100) considerando início→alvo.
export function goalTargetProgress(t: GoalTarget): number {
  if (t.type === 'boolean') return t.current >= t.target ? 100 : 0
  const span = t.target - t.start
  if (span === 0) return t.current >= t.target ? 100 : 0
  return Math.max(0, Math.min(100, Math.round(((t.current - t.start) / span) * 100)))
}
// Progresso da meta = média dos alvos (0 se não houver alvos).
export function goalProgress(g: Goal): number {
  if (!g.targets.length) return g.status === 'done' ? 100 : 0
  return Math.round(g.targets.reduce((s, t) => s + goalTargetProgress(t), 0) / g.targets.length)
}

// ── Spaces ────────────────────────────────────────────────────────────────
export interface Space {
  id: string
  name: string
  color: string
  icon?: string          // nome do ícone lucide (kebab-case), opcional
  workspaceId: string
  collapsed: boolean
  createdAt: string
  updatedAt: string
}

// ── Folders ───────────────────────────────────────────────────────────────
export interface Folder {
  id: string
  name: string
  spaceId: string
  color?: string        // cor do ícone de pasta (padrão: âmbar)
  collapsed: boolean
  createdAt: string
  updatedAt: string
}

export const DEFAULT_FOLDER_COLOR = '#C9A15A'

// ── Custom columns ────────────────────────────────────────────────────────
export type ColumnType =
  | 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'money' | 'url'
  | 'people' | 'email' | 'phone' | 'website' | 'longtext' | 'labels' | 'rating'
  | 'ai_summary'

// Tipos de coluna gerados por IA — recebem tratamento visual próprio (gradiente
// estilo Gemini) em qualquer lugar que renderize um campo/coluna. Fonte única:
// adicionar aqui basta para o tipo herdar o destaque visual de IA.
export const AI_COLUMN_TYPES: ColumnType[] = ['ai_summary']
export const isAIColumnType = (t: ColumnType): boolean => AI_COLUMN_TYPES.includes(t)

export interface DropdownOption {
  id: string
  label: string
  color: string   // hex
  icon?: string   // nome do ícone lucide (kebab-case), opcional — substitui o círculo de cor
}

export interface ColumnDef {
  id: string
  name: string
  type: ColumnType
  projectId: string
  dropdownOptions: DropdownOption[]   // for dropdown/labels type (with colors)
  width?: number
}

// ── Colunas da lista (sistema + personalizadas) — reordenáveis ──────────────
// tags/assignee/dueDate/priority/project = sempre disponíveis (podem ser ocultadas).
// createdAt/updatedAt/taskType = propriedades extras, ocultas por padrão até serem ligadas
// no painel "Adicionar um existente".
export type SystemColumnKey = 'tags' | 'assignee' | 'dueDate' | 'priority' | 'project' | 'createdAt' | 'updatedAt' | 'taskType' | 'gut' | 'progress'
export interface ListColumn {
  key:    string                 // chave estável (sistema) ou id da coluna personalizada
  label:  string
  width:  number
  kind:   'system' | 'custom'
  system?: SystemColumnKey
  col?:    ColumnDef
}

// ── Views ─────────────────────────────────────────────────────────────────
export type ViewType = 'list' | 'board' | 'table' | 'calendar' | 'overview' | 'whiteboard' | 'activity' | 'dashboard'

// ── Filtro de período (datas) — estilo ClickUp ──────────────────────────────
// Campo de data ao qual o período se aplica.
export type DateFieldKey = 'dueDate' | 'completedAt' | 'createdAt'

// Períodos relativos + modos específicos (data exata / antes / depois / intervalo).
export type PeriodKey =
  | 'today' | 'yesterday' | 'tomorrow'
  | 'this_week' | 'last_week' | 'next_week'
  | 'this_month' | 'last_month'
  | 'this_quarter' | 'last_quarter'
  | 'this_year' | 'next_year' | 'last_year'
  | 'last_7_days' | 'last_30_days'
  | 'exact_date' | 'before_date' | 'after_date' | 'between'

export interface DateFilterValue {
  period: PeriodKey
  date?:  string   // exact_date / before_date / after_date (ISO yyyy-mm-dd)
  start?: string   // between
  end?:   string   // between
}

export interface CustomProjectView {
  id: string
  name: string
  icon: string
  baseType: 'list' | 'board' | 'table' | 'calendar'
  filterStatus?: TaskStatus | 'all'
  dateField?:  DateFieldKey
  datePeriod?: DateFilterValue
  /** @deprecated mantido só para migrar visualizações antigas — usar datePeriod */
  filterDaysBack?: number
}

// ── Task open mode ────────────────────────────────────────────────────────
export type TaskOpenMode = 'side' | 'center' | 'full'

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
  id:          string
  name:        string
  workspaceId: string
  projectId:   string
  trigger:     AutomationTrigger
  action:      AutomationAction
  enabled:     boolean
  createdAt:   string
}

// ── GUT ───────────────────────────────────────────────────────────────────
export interface GUT { g: number; u: number; t: number; score: number }

// ── Checklist / Content blocks ────────────────────────────────────────────
export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Checklist     { id: string; title: string; items: ChecklistItem[] }

// ── Comentários da tarefa ────────────────────────────────────────────────
export interface TaskComment {
  id: string
  author: string
  text: string
  attachment?: { name: string; data: string; mimeType: string }
  audio?: { data: string }
  createdAt: string
  parentId?: string | null   // resposta a outro comentário (thread estilo Slack)
}

export type ContentBlockType = 'text' | 'image' | 'audio' | 'file'
// region: 'body' = intercalado no fluxo do texto (inline) · 'attachment' = seção "Anexos" separada.
// display (só imagem): 'full' = mostra a imagem · 'title' = mostra só o título (estilo Evernote).
export interface ContentBlock {
  id: string; type: ContentBlockType
  text?: string; data?: string; name?: string; mimeType?: string; size?: number
  region?: 'body' | 'attachment'
  display?: 'full' | 'title'
}

// ── Task types ────────────────────────────────────────────────────────────
export type TaskType = 'task' | 'milestone' | 'meeting_note' | 'bug' | 'goal' | 'objective' | 'form_response' | 'request'

export const TASK_TYPE_META: Record<TaskType, { label: string; symbol: string; color: string; bg: string }> = {
  task:          { label: 'Tarefa',                 symbol: '○',  color: '#888780', bg: '#f3f3f2' },
  milestone:     { label: 'Marco',                  symbol: '◆',  color: '#6366F1', bg: '#EEEDFE' },
  meeting_note:  { label: 'Anotação de reunião',    symbol: '🗒',  color: '#378ADD', bg: '#E6F1FB' },
  bug:           { label: 'Erro',                   symbol: '⚙',  color: '#E24B4A', bg: '#FAECE7' },
  goal:          { label: 'Meta',                   symbol: '▲',  color: '#D85A30', bg: '#FAEEDA' },
  objective:     { label: 'Objetivo',               symbol: '◎',  color: '#1D9E75', bg: '#E1F5EE' },
  form_response: { label: 'Resposta de formulário', symbol: '≡',  color: '#BA7517', bg: '#FAEEDA' },
  request:       { label: 'Solicitação',            symbol: '◫',  color: '#D4537E', bg: '#FCEEF4' },
}

// ── Task ──────────────────────────────────────────────────────────────────
export interface Task {
  id: string
  workspaceId: string
  projectId: string
  parentId: string | null
  title: string
  description: string
  blocks: ContentBlock[]
  status: TaskStatus
  priority: Priority
  taskType: TaskType
  dueDate: string | null
  assignee: string
  tags: string[]
  checklists: Checklist[]
  customFields: Record<string, unknown>   // columnId → value
  gut?: GUT                               // matriz GUT opcional por tarefa (independente do GUT de projeto)
  comments: TaskComment[]
  createdAt: string
  updatedAt: string
}

// ── Project ───────────────────────────────────────────────────────────────
export interface Project {
  id: string; name: string; color: string; description: string
  icon?: string                  // nome do ícone lucide (kebab-case), opcional
  workspaceId: string
  spaceId: string | null
  folderId: string | null
  gut: GUT; archived: boolean
  columns: ColumnDef[]           // custom columns for this project
  activeView: ViewType           // which view is selected
  taskOpenMode: TaskOpenMode     // how task detail opens
  customViews: CustomProjectView[]
  createdAt: string; updatedAt: string
}

export const PROJECT_COLORS = ['#6366F1','#1D9E75','#D85A30','#BA7517','#D4537E','#378ADD','#639922','#888780']

export const PRIORITY_LABEL: Record<Priority,   string> = { low:'Baixa', medium:'Média', high:'Alta', urgent:'Urgente' }
export const STATUS_LABEL:   Record<TaskStatus, string> = { todo:'A fazer', in_progress:'Em progresso', done:'Concluído' }

export const GUT_LABEL_G: Record<number,string> = { 1:'Sem gravidade',2:'Pouco grave',3:'Grave',4:'Muito grave',5:'Extremamente grave' }
export const GUT_LABEL_U: Record<number,string> = { 1:'Pode esperar',2:'Pouco urgente',3:'Urgente',4:'Muito urgente',5:'Ação imediata' }
export const GUT_LABEL_T: Record<number,string> = { 1:'Melhora',2:'Estável',3:'Piora levemente',4:'Piora',5:'Piora muito' }

export function calcGUT(g: number, u: number, t: number): GUT { return { g, u, t, score: g * u * t } }

// `bg` é o `color` com alfa (hex + sufixo de 2 dígitos) em vez de pastel sólido —
// assim o selo se mistura com a superfície embaixo (clara ou escura) em vez de
// virar um bloco pastel brilhante e destacado no modo escuro.
export function gutTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label:'Crítico', color:'#E2724A', bg:'#E2724A1F' }
  if (score >= 40) return { label:'Alto',    color:'#C4901C', bg:'#C4901C1F' }
  if (score >= 15) return { label:'Médio',   color:'#3B82D8', bg:'#3B82D81F' }
  return               { label:'Baixo',   color:'#1D9E75', bg:'#1D9E751F' }
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
    id: String(raw.id ?? ''),
    workspaceId: String(raw.workspaceId ?? DEFAULT_WORKSPACE_ID),
    projectId: String(raw.projectId ?? ''),
    parentId: (raw.parentId as string|null) ?? null,
    title: String(raw.title ?? ''), description: String(raw.description ?? ''),
    blocks, status: (raw.status as TaskStatus) ?? 'todo',
    priority: (raw.priority as Priority) ?? 'medium',
    taskType: (raw.taskType as TaskType) ?? 'task',
    dueDate: (raw.dueDate as string|null) ?? null,
    assignee: String(raw.assignee ?? ''),
    tags: (raw.tags as string[]) ?? [],
    checklists: (raw.checklists as Checklist[]) ?? [],
    customFields: (raw.customFields as Record<string,unknown>) ?? {},
    gut: (raw.gut as GUT | undefined) ?? undefined,
    comments: (raw.comments as TaskComment[]) ?? [],
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  }
}

// Views antigas persistidas como 'mindmap' viram 'whiteboard' (quadro branco livre).
export function migrateViewType(v: unknown): ViewType {
  if (v === 'mindmap') return 'whiteboard'
  return (v as ViewType) ?? 'list'
}

export function migrateSpace(raw: Record<string, unknown>): Space {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    color: String(raw.color ?? '#6366F1'),
    icon: (raw.icon as string | undefined) ?? undefined,
    workspaceId: String(raw.workspaceId ?? DEFAULT_WORKSPACE_ID),
    collapsed: (raw.collapsed as boolean) ?? false,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  }
}

export function migrateFolder(raw: Record<string, unknown>): Folder {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    spaceId: String(raw.spaceId ?? ''),
    color: (raw.color as string | undefined) ?? undefined,
    collapsed: (raw.collapsed as boolean) ?? false,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  }
}

export function migrateAutomation(raw: Record<string, unknown>): Automation {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    workspaceId: String(raw.workspaceId ?? DEFAULT_WORKSPACE_ID),
    projectId: String(raw.projectId ?? ''),
    trigger: raw.trigger as AutomationTrigger,
    action: raw.action as AutomationAction,
    enabled: (raw.enabled as boolean) ?? true,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  }
}

export function migrateProject(raw: Record<string, unknown>): Project {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    color: String(raw.color ?? '#6366F1'),
    description: String(raw.description ?? ''),
    icon: (raw.icon as string | undefined) ?? undefined,
    workspaceId: String(raw.workspaceId ?? DEFAULT_WORKSPACE_ID),
    spaceId: (raw.spaceId as string | null) ?? null,
    folderId: (raw.folderId as string | null) ?? null,
    gut: (raw.gut as GUT) ?? calcGUT(1,1,1),
    archived: (raw.archived as boolean) ?? false,
    columns: (raw.columns as ColumnDef[]) ?? [],
    activeView: migrateViewType(raw.activeView),
    taskOpenMode: (raw.taskOpenMode as TaskOpenMode) ?? 'center',
    customViews: (raw.customViews as CustomProjectView[]) ?? [],
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  }
}
