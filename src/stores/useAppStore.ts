import { create } from 'zustand'
import { nanoid } from '../lib/nanoid'
import { localProjects, localTasks } from '../lib/localStore'
import { SEED_PROJECTS, SEED_TASKS } from '../lib/seed'
import { db, doc, setDoc, getDoc, onSnapshot } from '../lib/firebase'
import { stripAndUploadAttachments, hydrateAttachments, deleteAttachmentsOf } from '../lib/cloudAttachments'
import type {
  Project, Task, Space, Folder, ColumnDef, Automation, AutomationRun, ViewType,
  View, TaskStatus, Priority, Checklist, ChecklistItem, ContentBlock, TriggerType,
  TaskType, TaskOpenMode, CustomProjectView, DateFieldKey, DateFilterValue,
  Workspace, TaskComment, Goal, GoalTarget, Note,
} from '../types'
import {
  calcGUT, migrateTask, migrateProject, migrateSpace, migrateFolder, migrateAutomation,
  INBOX_PROJECT_ID, DEFAULT_WORKSPACE_ID, ANY, STATUS_LABEL, PRIORITY_LABEL,
  migrateNote,
} from '../types'
import { matchesTrigger } from '../lib/automationEngine'
import { useNotificationStore } from './useNotificationStore'
import { matchesDateFilter } from '../lib/dateFilter'
import { generateCompletionSummary } from '../lib/aiSummary'
import { useSettingsStore, lerSettings, registrarObservadorDeSettings } from './useSettingsStore'

const SPACES_KEY      = 'tf_spaces'
const FOLDERS_KEY     = 'tf_folders'
const WORKSPACES_KEY  = 'tf_workspaces'
const ACTIVE_WS_KEY   = 'tf_active_workspace'
const AUTOMATIONS_KEY = 'tf_automations'
const AUTOMATION_RUNS_KEY = 'tf_automation_runs'
const MAX_AUTOMATION_RUNS  = 200   // histórico recente; o doc de sincronização tem limite de 1 MiB
const MAX_AUTOMATION_DEPTH = 5     // profundidade da cadeia automação → tarefa → automação
let automationDepth = 0
/**
 * Só liberamos escrita na nuvem depois de saber o que existe lá. Sem isto, um navegador
 * novo criava os projetos de exemplo no `init()`, o debounce disparava em 1,5s e o push
 * levava o **seed** por cima dos dados reais da conta. Agora o push espera o primeiro
 * snapshot (ou a decisão explícita de semear um grupo vazio).
 */
let cloudReady = false
const GOALS_KEY       = 'tf_goals'
const NOTES_KEY       = 'tf_notes'
const VIEW_PREFS_KEY  = 'tf_view_prefs'   // visualização/agrupamento por escopo (era 'tf_v_*' solto)
const INBOX_COLS_KEY  = 'tf_inbox_columns'
const CUSTOM_VIEWS_KEY= 'tf_custom_views'   // Record<scopeKey, CustomProjectView[]> — todas as visualizações personalizadas, de qualquer escopo (projeto, espaço, pasta, minhas/todas tarefas)
export const scopeKeyForProject = (id: string) => `project:${id}`

function loadJSON<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}
function saveJSON(key: string, val: unknown) { 
  localStorage.setItem(key, JSON.stringify(val));
  triggerSyncPush();
}

// ── Global filters state ───────────────────────────────────────────────────
export interface FilterState {
  status:     TaskStatus | 'all'
  priority:   Priority   | 'all'
  assignee:   string
  tags:       string[]
  dateField:  DateFieldKey
  datePeriod: DateFilterValue | null
}
const EMPTY_FILTER: FilterState = { status:'all', priority:'all', assignee:'', tags:[], dateField:'dueDate', datePeriod:null }

// Snapshot para desfazer (mover/excluir/reordenar)
interface Snapshot { projects: Project[]; tasks: Task[]; spaces: Space[]; folders: Folder[] }

interface AppState {
  projects:    Project[]
  tasks:       Task[]
  spaces:      Space[]
  folders:     Folder[]
  workspaces:  Workspace[]
  activeWorkspaceId: string
  automations: Automation[]
  goals:       Goal[]
  inboxColumns: ColumnDef[]
  undoStack:   Snapshot[]
  customViewsByScope: Record<string, CustomProjectView[]>   // visualizações personalizadas por escopo (projeto/espaço/pasta/minhas/todas)
  aiGeneratingKeys: string[]   // chaves `${taskId}:${colId}` de campos de IA em geração no momento

  activeView:      View
  activeProjectId: string | null
  activeSpaceId:   string | null
  activeFolderId:  string | null
  selectedTaskId:  string | null
  filterPanelOpen: boolean
  aiPanelOpen:     boolean
  notesPanelOpen:  boolean
  quickCaptureOpen: boolean
  mobileSidebarOpen: boolean
  filters:         FilterState

  newProjectModal: boolean
  newProjectCtx:   { spaceId?: string; folderId?: string }
  aiProjectModal: boolean
  aiProjectCtx:   { spaceId?: string; folderId?: string }
  enrichProjectModal: string | null   // projectId
  gutModal:        { open: boolean; projectId: string | null }
  columnsModal:      string | null  // projectId (ou INBOX_PROJECT_ID) — dono das colunas personalizadas (CRUD)
  columnsModalScope: string | null  // scopeKey — dono das preferências de visibilidade (ocultar/mostrar)
  columnsVersion:    number          // incrementado a cada alteração de visibilidade, p/ recalcular listas abertas
  newViewModal:    string | null  // scopeKey (ex.: "project:<id>", "space:<id>", "alltasks", "mytasks")

  pushUndo:        () => void
  undo:            () => void
  setView:         (view: View, projectId?: string) => void
  openSpace:       (id: string) => void
  openFolder:      (id: string) => void
  setSelectedTask: (id: string | null) => void
  toggleFilterPanel: () => void
  toggleAIPanel:   () => void
  toggleNotesPanel: () => void
  toggleQuickCapture: () => void
  openQuickCapture:   () => void
  closeQuickCapture:  () => void
  toggleMobileSidebar:() => void
  setMobileSidebarOpen:(open: boolean) => void
  setFilters:      (f: Partial<FilterState>) => void
  clearFilters:    () => void

  openNewProject:  (spaceId?: string, folderId?: string) => void
  closeNewProject: () => void
  openAIProject:   (spaceId?: string, folderId?: string) => void
  closeAIProject:  () => void
  openEnrichProject:  (projectId: string) => void
  closeEnrichProject: () => void
  openGUT:         (id: string) => void
  closeGUT:        () => void
  openColumnsModal:(id: string, scope?: string) => void
  closeColumnsModal:() => void
  bumpColumnsVersion:() => void
  openNewViewModal:(id: string) => void
  closeNewViewModal:() => void

  // Workspaces
  addWorkspace:    (name: string, color: string) => Workspace
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void
  switchWorkspace: (id: string) => void

  // Spaces
  addSpace:    (name: string, color: string) => Space
  updateSpace: (id: string, patch: Partial<Space>) => void
  deleteSpace: (id: string) => void
  reorderSpace: (draggedId: string, targetId: string) => void
  duplicateSpace: (id: string) => void

  // Folders
  addFolder:    (name: string, spaceId: string) => Folder
  updateFolder: (id: string, patch: Partial<Folder>) => void
  deleteFolder: (id: string) => void
  reorderFolder: (draggedId: string, targetId: string) => void
  duplicateFolder: (id: string) => void

  // Projects
  addProject:       (name: string, color: string, desc: string, spaceId?: string, folderId?: string, icon?: string) => Project
  moveProject:      (id: string, spaceId: string | null, folderId: string | null) => void
  reorderProject:   (draggedId: string, targetId: string) => void
  updateProject:    (id: string, patch: Partial<Project>) => void
  deleteProject:    (id: string) => void
  duplicateProject: (id: string) => void
  archiveProject:   (id: string) => void
  unarchiveProject: (id: string) => void
  saveGUT:          (id: string, g: number, u: number, t: number) => void
  setProjectView:   (id: string, view: ViewType) => void
  setTaskOpenMode:  (id: string, mode: TaskOpenMode) => void
  addColumn:        (projectId: string, col: Omit<ColumnDef,'id'>) => void
  updateColumn:     (projectId: string, colId: string, patch: Partial<ColumnDef>) => void
  deleteColumn:     (projectId: string, colId: string) => void

  // Visualizações personalizadas (por escopo — projeto, espaço, pasta, minhas/todas tarefas)
  getCustomViews:   (scopeKey: string) => CustomProjectView[]
  addCustomView:    (scopeKey: string, view: Omit<CustomProjectView,'id'>) => void
  deleteCustomView: (scopeKey: string, viewId: string) => void

  // Tasks
  addTask:       (task: Omit<Task,'id'|'workspaceId'|'createdAt'|'updatedAt'>) => Task
  quickAddTask:  (title: string, projectId: string, status: TaskStatus, parentId?: string) => Task
  reorderTask:   (draggedId: string, targetId: string) => void
  updateTask:    (id: string, patch: Partial<Task>) => void
  deleteTask:    (id: string) => void
  updateBlocks:  (taskId: string, blocks: ContentBlock[]) => void
  updateCustomField: (taskId: string, colId: string, value: unknown) => void

  // Campos de IA (ex.: resumo de conclusão) — geração automática ao concluir + manual
  generateAISummaries: (taskId: string) => void
  regenerateAISummary: (taskId: string, colId: string) => Promise<void>
  isAIGenerating: (taskId: string, colId: string) => boolean

  // Checklists
  addChecklist:        (taskId: string, title: string, customId?: string) => void
  renameChecklist:     (taskId: string, checklistId: string, title: string) => void
  removeChecklist:     (taskId: string, checklistId: string) => void
  addChecklistItem:    (taskId: string, checklistId: string, text: string, customId?: string) => void
  renameChecklistItem: (taskId: string, checklistId: string, itemId: string, text: string) => void
  toggleChecklistItem: (taskId: string, checklistId: string, itemId: string) => void
  removeChecklistItem: (taskId: string, checklistId: string, itemId: string) => void

  // Comentários
  addComment:    (taskId: string, patch: Partial<Omit<TaskComment,'id'|'author'|'createdAt'>>) => void
  removeComment: (taskId: string, commentId: string) => void

  // Automations
  addAutomation:    (a: Omit<Automation,'id'|'workspaceId'|'createdAt'>) => void
  updateAutomation: (id: string, patch: Partial<Automation>) => void
  duplicateAutomation: (id: string) => void
  toggleAutomation: (id: string) => void
  deleteAutomation: (id: string) => void
  runAutomations:   (trigger: string, taskId: string, prev?: Partial<Task>) => void
  applyAutomation:  (automation: Automation, taskId: string) => void
  runDueDateAutomations: () => void

  // Histórico de execuções (ver types/index.ts → AutomationRun)
  automationRuns:      AutomationRun[]
  logAutomationRun:    (automation: Automation, task: Task, result: AutomationRun['result'], detail: string) => void
  clearAutomationRuns: () => void

  /**
   * Visualização e agrupamento escolhidos por escopo (`project:<id>_view`, `_group`…).
   * Vivia em chaves `tf_v_*` soltas no navegador, então arrumar a lista no computador não
   * refletia no celular. Largura de painel continua local (é do dispositivo, não do
   * trabalho).
   */
  viewPrefs:    Record<string, string>
  setViewPref:  (key: string, value: string) => void

  // Notas (bloco de notas) — sincronizadas junto com o resto do estado
  notes:        Note[]
  addNote:      (patch?: Partial<Note>) => Note
  updateNote:   (id: string, patch: Partial<Note>) => void
  deleteNote:   (id: string) => void
  toggleNotePin:(id: string) => void
  /** Converte a nota numa tarefa (primeira linha = título, resto = descrição). */
  noteToTask:   (id: string, projectId: string) => Task | null

  // Metas / Objetivos
  addGoal:      (g: Omit<Goal,'id'|'workspaceId'|'createdAt'|'updatedAt'>) => Goal
  updateGoal:   (id: string, patch: Partial<Goal>) => void
  deleteGoal:   (id: string) => void
  /** Atualiza um alvo direto do card — o gesto mais frequente exigia abrir o editor todo. */
  updateGoalTarget: (goalId: string, targetId: string, patch: Partial<GoalTarget>) => void

  getAllTags:   () => string[]
  getAllAssignees: () => string[]
  getSubtasks: (parentId: string) => Task[]
  filteredTasks: (tasks: Task[]) => Task[]
  init: () => void

  // Sincronização entre dispositivos (Firestore, um documento por conta Google —
  // o uid do usuário logado é a chave do grupo, ver DIRETRIZES.md seção 15)
  syncUid: string | null
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  lastSyncedAt: string | null

  startCloudSync: (uid: string) => void
  stopCloudSync: () => void
  pushToCloud: (opts?: { force?: boolean }) => Promise<void>
}

// Chave do modelo antigo (grupo por código compartilhado TF-XXXXXX). Continua sendo lida
// uma única vez para migrar os dados daquele grupo para a conta Google — ver
// `migrateLegacySyncCode`. Nenhum código novo é gerado.
const LEGACY_SYNC_CODE_KEY = 'tf_sync_code'
const LEGACY_MIGRATED_KEY  = 'tf_sync_code_migrated'

let syncDebounceTimeout: any = null;
function triggerSyncPush() {
  if (syncDebounceTimeout) clearTimeout(syncDebounceTimeout);
  syncDebounceTimeout = setTimeout(() => {
    try {
      const store = useAppStore.getState();
      if (store && store.syncUid) {
        store.pushToCloud();
      }
    } catch (e) {
      console.error("Error triggerSyncPush:", e);
    }
  }, 1500);
}

let unsubscribeCloud: (() => void) | null = null

// Aplica um documento vindo do Firestore (de um onSnapshot ou de um getDoc avulso) ao
// estado local — usado tanto pela assinatura em tempo real quanto por "vincular dispositivo".
async function applyRemoteSnapshot(set: (partial: any) => void, get: () => AppState, groupId: string, data: any) {
  set({ cloudSyncStatus: 'syncing' });
  try {
    const projects = (data.projects ?? []).map(migrateProject);
    const migratedTasks = await hydrateAttachments(groupId, (data.tasks ?? []).map(migrateTask));

    // Um documento remoto sem tarefas NÃO apaga as tarefas locais. `projects` já tinha
    // essa proteção e `tasks` não: bastava um snapshot com a lista vazia (dispositivo
    // recém-aberto, escrita parcial, campo ausente) para o app zerar o trabalho todo.
    const tarefasSeguras = migratedTasks.length ? migratedTasks : get().tasks;

    localProjects.set(projects as any);
    localTasks.set(tarefasSeguras as any);
    if (data.spaces) localStorage.setItem(SPACES_KEY, JSON.stringify(data.spaces));
    if (data.folders) localStorage.setItem(FOLDERS_KEY, JSON.stringify(data.folders));
    if (data.workspaces) localStorage.setItem(WORKSPACES_KEY, JSON.stringify(data.workspaces));
    if (data.activeWorkspaceId) localStorage.setItem(ACTIVE_WS_KEY, data.activeWorkspaceId);
    if (data.automations) localStorage.setItem(AUTOMATIONS_KEY, JSON.stringify(data.automations));
    if (data.goals) localStorage.setItem(GOALS_KEY, JSON.stringify(data.goals));
    if (data.notes) localStorage.setItem(NOTES_KEY, JSON.stringify(data.notes));
    if (data.viewPrefs) localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(data.viewPrefs));
    if (data.automationRuns) localStorage.setItem(AUTOMATION_RUNS_KEY, JSON.stringify(data.automationRuns));
    if (data.inboxColumns) localStorage.setItem(INBOX_COLS_KEY, JSON.stringify(data.inboxColumns));
    if (data.customViewsByScope) localStorage.setItem(CUSTOM_VIEWS_KEY, JSON.stringify(data.customViewsByScope));
    // Documento antigo (gravado antes de a configuração sincronizar) não tem `settings` —
    // nesse caso o aparelho mantém a sua e o próximo push é que semeia a nuvem.
    if (data.settings) useSettingsStore.getState().aplicarSettingsRemotas(data.settings);

    set({
      projects: projects.length ? projects : get().projects,
      tasks: tarefasSeguras,
      spaces: data.spaces ?? get().spaces,
      folders: data.folders ?? get().folders,
      workspaces: data.workspaces ?? get().workspaces,
      activeWorkspaceId: data.activeWorkspaceId ?? get().activeWorkspaceId,
      automations: (data.automations ?? []).map(migrateAutomation),
      goals: data.goals ?? get().goals,
      notes: (data.notes ?? get().notes).map(migrateNote),
      viewPrefs: data.viewPrefs ?? get().viewPrefs,
      automationRuns: data.automationRuns ?? get().automationRuns,
      inboxColumns: data.inboxColumns ?? get().inboxColumns,
      customViewsByScope: data.customViewsByScope ?? get().customViewsByScope,
      cloudSyncStatus: 'synced',
      lastSyncedAt: new Date().toLocaleTimeString('pt-BR'),
    });
  } catch (e) {
    console.error('Erro ao aplicar dados da nuvem:', e);
    set({ cloudSyncStatus: 'error' });
  }
}

/**
 * Migração única do modelo antigo (grupo por código compartilhado `TF-XXXXXX`) para o
 * modelo por conta Google: se este navegador ainda tem um código salvo e aquele grupo
 * existe na nuvem, o conteúdo dele é carregado e reenviado sob o uid da conta — incluindo
 * os anexos, que são reidratados do grupo antigo e resubidos para o novo.
 * Retorna true se trouxe dados do grupo antigo.
 */
async function migrateLegacySyncCode(set: (partial: any) => void, get: () => AppState, uid: string): Promise<boolean> {
  if (!db) return false
  if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return false
  const legacyCode = localStorage.getItem(LEGACY_SYNC_CODE_KEY)
  if (!legacyCode) return false
  try {
    const snap = await getDoc(doc(db, 'syncGroups', legacyCode))
    localStorage.setItem(LEGACY_MIGRATED_KEY, new Date().toISOString())
    if (!snap.exists()) return false
    await applyRemoteSnapshot(set, get, legacyCode, snap.data())
    await get().pushToCloud()
    console.info(`Dados do código de sincronização ${legacyCode} migrados para a conta ${uid}.`)
    return true
  } catch (e) {
    console.error('Não foi possível migrar os dados do código de sincronização antigo:', e)
    return false
  }
}

// Mudou a configuração (chave de IA, atalho) → entra na mesma fila de push das tarefas.
registrarObservadorDeSettings(triggerSyncPush)

function pProjects(p: Project[], t: Task[]) {
  localProjects.set(p as any); 
  localTasks.set(t as any);
  triggerSyncPush();
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [], tasks: [], spaces: [], folders: [],
  workspaces: [], activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  automations: [], automationRuns: [], goals: [], notes: [], viewPrefs: {}, inboxColumns: [], undoStack: [],
  customViewsByScope: {},
  aiGeneratingKeys: [],
  activeView:'my_tasks', activeProjectId:null, activeSpaceId:null, activeFolderId:null, selectedTaskId:null,
  filterPanelOpen:false, aiPanelOpen:false, notesPanelOpen:false, quickCaptureOpen:false, mobileSidebarOpen:false, filters:EMPTY_FILTER,
  newProjectModal:false, newProjectCtx:{}, aiProjectModal:false, aiProjectCtx:{}, enrichProjectModal:null, gutModal:{open:false,projectId:null},
  columnsModal:null, columnsModalScope:null, columnsVersion:0, newViewModal:null,

  // Sincronização
  syncUid: null,
  cloudSyncStatus: 'idle',
  lastSyncedAt: null,

  pushUndo: () => {
    const { projects, tasks, spaces, folders, undoStack } = get()
    set({ undoStack: [...undoStack.slice(-29), { projects, tasks, spaces, folders }] })
  },
  undo: () => {
    const { undoStack } = get()
    if (!undoStack.length) return
    const snap = undoStack[undoStack.length - 1]
    pProjects(snap.projects, snap.tasks)
    saveJSON(SPACES_KEY, snap.spaces); saveJSON(FOLDERS_KEY, snap.folders)
    set({ projects: snap.projects, tasks: snap.tasks, spaces: snap.spaces, folders: snap.folders, undoStack: undoStack.slice(0, -1) })
  },
  setView: (view, projectId) => set({ activeView:view, activeProjectId:projectId??null, activeSpaceId:null, activeFolderId:null, selectedTaskId:null, mobileSidebarOpen:false }),
  openSpace:  (id) => set({ activeView:'space_detail',  activeSpaceId:id, activeFolderId:null, activeProjectId:null, selectedTaskId:null, mobileSidebarOpen:false }),
  openFolder: (id) => set({ activeView:'folder_detail', activeFolderId:id, activeSpaceId:null, activeProjectId:null, selectedTaskId:null, mobileSidebarOpen:false }),
  setSelectedTask: (id) => set({ selectedTaskId:id }),
  toggleFilterPanel: () => set(s => ({ filterPanelOpen:!s.filterPanelOpen })),
  toggleAIPanel:     () => set(s => ({ aiPanelOpen:!s.aiPanelOpen })),
  toggleNotesPanel:  () => set(s => ({ notesPanelOpen:!s.notesPanelOpen })),
  toggleQuickCapture: () => set(s => ({ quickCaptureOpen:!s.quickCaptureOpen })),
  openQuickCapture:   () => set({ quickCaptureOpen:true }),
  closeQuickCapture:  () => set({ quickCaptureOpen:false }),
  toggleMobileSidebar:() => set(s => ({ mobileSidebarOpen:!s.mobileSidebarOpen })),
  setMobileSidebarOpen:(open) => set({ mobileSidebarOpen:open }),
  setFilters:  (f) => set(s => ({ filters:{ ...s.filters, ...f } })),
  clearFilters:() => set({ filters:EMPTY_FILTER }),

  openNewProject:  (spaceId, folderId) => set({ newProjectModal:true, newProjectCtx:{ spaceId, folderId } }),
  closeNewProject: () => set({ newProjectModal:false, newProjectCtx:{} }),
  openAIProject:   (spaceId, folderId) => set({ aiProjectModal:true, aiProjectCtx:{ spaceId, folderId } }),
  closeAIProject:  () => set({ aiProjectModal:false, aiProjectCtx:{} }),
  openEnrichProject:  (projectId) => set({ enrichProjectModal: projectId }),
  closeEnrichProject: () => set({ enrichProjectModal: null }),
  openGUT:         (id) => set({ gutModal:{open:true,projectId:id} }),
  closeGUT:        () => set({ gutModal:{open:false,projectId:null} }),
  openColumnsModal: (id, scope) => set({ columnsModal:id, columnsModalScope: scope ?? id }),
  closeColumnsModal:() => set({ columnsModal:null, columnsModalScope:null }),
  bumpColumnsVersion:() => set(s => ({ columnsVersion: s.columnsVersion + 1 })),
  openNewViewModal: (id) => set({ newViewModal: id }),
  closeNewViewModal:() => set({ newViewModal: null }),

  // ── Workspaces ───────────────────────────────────────────────────────
  addWorkspace: (name, color) => {
    const w: Workspace = { id:nanoid(), name, color, createdAt:new Date().toISOString() }
    const workspaces = [...get().workspaces, w]
    saveJSON(WORKSPACES_KEY, workspaces); set({ workspaces })
    get().switchWorkspace(w.id)
    return w
  },
  updateWorkspace: (id, patch) => {
    const workspaces = get().workspaces.map(w => w.id===id ? {...w,...patch} : w)
    saveJSON(WORKSPACES_KEY, workspaces); set({ workspaces })
  },
  switchWorkspace: (id) => {
    saveJSON(ACTIVE_WS_KEY, id)
    set({ activeWorkspaceId: id, activeView:'my_tasks', activeProjectId:null, activeSpaceId:null, activeFolderId:null, selectedTaskId:null, mobileSidebarOpen:false })
  },

  // ── Spaces ───────────────────────────────────────────────────────────
  addSpace: (name, color) => {
    const s: Space = { id:nanoid(), name, color, workspaceId:get().activeWorkspaceId, collapsed:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
    const spaces = [...get().spaces, s]
    saveJSON(SPACES_KEY, spaces); set({ spaces }); return s
  },
  updateSpace: (id, patch) => {
    const spaces = get().spaces.map(s => s.id===id ? {...s,...patch,updatedAt:new Date().toISOString()} : s)
    saveJSON(SPACES_KEY, spaces); set({ spaces })
  },
  deleteSpace: (id) => {
    get().pushUndo()
    const spaces   = get().spaces.filter(s => s.id !== id)
    const folders  = get().folders.filter(f => f.spaceId !== id)
    const projects = get().projects.map(p => p.spaceId===id ? {...p,spaceId:null,folderId:null} : p)
    saveJSON(SPACES_KEY, spaces); saveJSON(FOLDERS_KEY, folders)
    pProjects(projects, get().tasks); set({ spaces, folders, projects })
  },
  reorderSpace: (draggedId, targetId) => {
    if (draggedId === targetId) return
    get().pushUndo()
    const spaces = [...get().spaces]
    const from = spaces.findIndex(s => s.id===draggedId)
    const to   = spaces.findIndex(s => s.id===targetId)
    if (from < 0 || to < 0) return
    const [moved] = spaces.splice(from, 1)
    spaces.splice(spaces.findIndex(s => s.id===targetId), 0, moved)
    saveJSON(SPACES_KEY, spaces); set({ spaces })
  },
  duplicateSpace: (id) => {
    const original = get().spaces.find(s => s.id===id); if (!original) return
    const now = new Date().toISOString()
    const newSpace: Space = { ...original, id:nanoid(), name:`${original.name} (cópia)`, createdAt:now, updatedAt:now }
    const origFolders = get().folders.filter(f => f.spaceId===id)
    const folderIdMap = new Map<string,string>()
    const newFolders = origFolders.map(f => {
      const nf: Folder = { ...f, id:nanoid(), spaceId:newSpace.id, createdAt:now, updatedAt:now }
      folderIdMap.set(f.id, nf.id); return nf
    })
    const origProjects = get().projects.filter(p => p.spaceId===id)
    const newProjects = origProjects.map(p => ({
      ...p, id:nanoid(), spaceId:newSpace.id,
      folderId: p.folderId ? (folderIdMap.get(p.folderId) ?? null) : null,
      createdAt:now, updatedAt:now,
    }))
    const spaces   = [...get().spaces, newSpace]
    const folders  = [...get().folders, ...newFolders]
    const projects = [...get().projects, ...newProjects]
    saveJSON(SPACES_KEY, spaces); saveJSON(FOLDERS_KEY, folders)
    pProjects(projects, get().tasks); set({ spaces, folders, projects })
  },

  // ── Folders ──────────────────────────────────────────────────────────
  addFolder: (name, spaceId) => {
    const f: Folder = { id:nanoid(), name, spaceId, collapsed:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
    const folders = [...get().folders, f]
    saveJSON(FOLDERS_KEY, folders); set({ folders }); return f
  },
  updateFolder: (id, patch) => {
    const folders = get().folders.map(f => f.id===id ? {...f,...patch,updatedAt:new Date().toISOString()} : f)
    saveJSON(FOLDERS_KEY, folders); set({ folders })
  },
  deleteFolder: (id) => {
    get().pushUndo()
    const folders  = get().folders.filter(f => f.id !== id)
    const projects = get().projects.map(p => p.folderId===id ? {...p,folderId:null} : p)
    saveJSON(FOLDERS_KEY, folders); pProjects(projects, get().tasks); set({ folders, projects })
  },
  reorderFolder: (draggedId, targetId) => {
    if (draggedId === targetId) return
    get().pushUndo()
    const folders = [...get().folders]
    const from = folders.findIndex(f => f.id===draggedId)
    const to   = folders.findIndex(f => f.id===targetId)
    if (from < 0 || to < 0) return
    // Mantém a pasta no mesmo espaço do alvo
    const moved = { ...folders[from], spaceId: folders[to].spaceId }
    folders.splice(from, 1)
    folders.splice(folders.findIndex(f => f.id===targetId), 0, moved)
    saveJSON(FOLDERS_KEY, folders); set({ folders })
  },
  duplicateFolder: (id) => {
    const original = get().folders.find(f => f.id===id); if (!original) return
    const now = new Date().toISOString()
    const newFolder: Folder = { ...original, id:nanoid(), name:`${original.name} (cópia)`, createdAt:now, updatedAt:now }
    const origProjects = get().projects.filter(p => p.folderId===id)
    const newProjects = origProjects.map(p => ({ ...p, id:nanoid(), folderId:newFolder.id, createdAt:now, updatedAt:now }))
    const idx = get().folders.findIndex(f => f.id===id)
    const folders = [...get().folders]; folders.splice(idx + 1, 0, newFolder)
    const projects = [...get().projects, ...newProjects]
    saveJSON(FOLDERS_KEY, folders); pProjects(projects, get().tasks); set({ folders, projects })
  },

  // ── Projects ─────────────────────────────────────────────────────────
  addProject: (name, color, description, spaceId, folderId, icon) => {
    const p: Project = {
      id:nanoid(), name, color, description, icon,
      workspaceId:get().activeWorkspaceId,
      spaceId:spaceId??null, folderId:folderId??null,
      gut:calcGUT(1,1,1), archived:false, columns:[], activeView:'list',
      taskOpenMode:'center', customViews:[],
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
    }
    const projects = [...get().projects, p]
    pProjects(projects, get().tasks); set({ projects })
    return p
  },
  moveProject: (id, spaceId, folderId) => {
    get().pushUndo()
    const projects = get().projects.map(p => p.id===id ? {...p, spaceId, folderId, updatedAt:new Date().toISOString()} : p)
    pProjects(projects, get().tasks); set({ projects })
  },
  reorderProject: (draggedId, targetId) => {
    if (draggedId === targetId) return
    get().pushUndo()
    const projects = [...get().projects]
    const from = projects.findIndex(p => p.id===draggedId)
    const to   = projects.findIndex(p => p.id===targetId)
    if (from < 0 || to < 0) return
    const [moved] = projects.splice(from, 1)
    const insertAt = projects.findIndex(p => p.id===targetId)
    projects.splice(insertAt, 0, moved)
    pProjects(projects, get().tasks); set({ projects })
  },
  updateProject: (id, patch) => {
    const projects = get().projects.map(p => p.id===id ? {...p,...patch,updatedAt:new Date().toISOString()} : p)
    pProjects(projects, get().tasks); set({ projects })
  },
  deleteProject: (id) => {
    get().pushUndo()
    const projects = get().projects.filter(p => p.id !== id)
    const removidas = get().tasks.filter(t => t.projectId === id)
    const tasks    = get().tasks.filter(t => t.projectId !== id)
    pProjects(projects, tasks); set({ projects, tasks })
    const uid = get().syncUid
    if (uid) deleteAttachmentsOf(uid, removidas)   // anexos das tarefas do projeto
  },
  duplicateProject: (id) => {
    const original = get().projects.find(p => p.id===id); if (!original) return
    const now = new Date().toISOString()
    const clone: Project = { ...original, id:nanoid(), name:`${original.name} (cópia)`, createdAt:now, updatedAt:now }
    const idx = get().projects.findIndex(p => p.id===id)
    const projects = [...get().projects]; projects.splice(idx + 1, 0, clone)
    pProjects(projects, get().tasks); set({ projects })
  },
  archiveProject: (id) => {
    get().pushUndo()
    const projects = get().projects.map(p => p.id===id ? {...p,archived:true,updatedAt:new Date().toISOString()} : p)
    pProjects(projects, get().tasks)
    set({ projects, activeView: get().activeProjectId===id ? 'projects' : get().activeView, activeProjectId: get().activeProjectId===id ? null : get().activeProjectId })
  },
  unarchiveProject: (id) => {
    const projects = get().projects.map(p => p.id===id ? {...p,archived:false,updatedAt:new Date().toISOString()} : p)
    pProjects(projects, get().tasks); set({ projects })
  },
  saveGUT: (id, g, u, t) => {
    const gut = calcGUT(g,u,t)
    const projects = get().projects.map(p => p.id===id ? {...p,gut,updatedAt:new Date().toISOString()} : p)
    pProjects(projects, get().tasks); set({ projects })
  },
  setProjectView: (id, view) => {
    const projects = get().projects.map(p => p.id===id ? {...p,activeView:view} : p)
    pProjects(projects, get().tasks); set({ projects })
  },
  setTaskOpenMode: (id, mode) => {
    const projects = get().projects.map(p => p.id===id ? {...p,taskOpenMode:mode} : p)
    pProjects(projects, get().tasks); set({ projects })
  },
  addColumn: (projectId, col) => {
    const newCol: ColumnDef = { ...col, id:nanoid() }
    if (projectId === INBOX_PROJECT_ID) {
      const inboxColumns = [...get().inboxColumns, newCol]
      saveJSON(INBOX_COLS_KEY, inboxColumns); set({ inboxColumns }); return
    }
    const projects = get().projects.map(p => p.id===projectId ? {...p,columns:[...p.columns,newCol]} : p)
    pProjects(projects, get().tasks); set({ projects })
  },
  updateColumn: (projectId, colId, patch) => {
    if (projectId === INBOX_PROJECT_ID) {
      const inboxColumns = get().inboxColumns.map(c => c.id===colId ? {...c,...patch} : c)
      saveJSON(INBOX_COLS_KEY, inboxColumns); set({ inboxColumns }); return
    }
    const projects = get().projects.map(p => p.id!==projectId ? p : { ...p, columns:p.columns.map(c => c.id===colId ? {...c,...patch} : c) })
    pProjects(projects, get().tasks); set({ projects })
  },
  deleteColumn: (projectId, colId) => {
    if (projectId === INBOX_PROJECT_ID) {
      const inboxColumns = get().inboxColumns.filter(c => c.id!==colId)
      saveJSON(INBOX_COLS_KEY, inboxColumns); set({ inboxColumns }); return
    }
    const projects = get().projects.map(p => p.id!==projectId ? p : { ...p, columns:p.columns.filter(c => c.id!==colId) })
    pProjects(projects, get().tasks); set({ projects })
  },
  getCustomViews: (scopeKey) => get().customViewsByScope[scopeKey] ?? [],
  addCustomView: (scopeKey, view) => {
    const newView: CustomProjectView = { ...view, id: nanoid() }
    const customViewsByScope = { ...get().customViewsByScope, [scopeKey]: [...(get().customViewsByScope[scopeKey] ?? []), newView] }
    saveJSON(CUSTOM_VIEWS_KEY, customViewsByScope); set({ customViewsByScope })
  },
  deleteCustomView: (scopeKey, viewId) => {
    const customViewsByScope = { ...get().customViewsByScope, [scopeKey]: (get().customViewsByScope[scopeKey] ?? []).filter(v => v.id!==viewId) }
    saveJSON(CUSTOM_VIEWS_KEY, customViewsByScope); set({ customViewsByScope })
  },

  // ── Tasks ─────────────────────────────────────────────────────────────
  addTask: (task) => {
    const t: Task = { ...task, id:nanoid(), workspaceId:get().activeWorkspaceId, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
    const tasks = [...get().tasks, t]
    pProjects(get().projects, tasks); set({ tasks })
    get().runAutomations('task_created', t.id)
    return t
  },
  quickAddTask: (title, projectId, status, parentId) => {
    // Subtarefa criada dentro do modal da tarefa-mãe nasce com prioridade "Baixa" por
    // padrão (pedido explícito); tarefa-raiz continua "Média".
    const t: Task = {
      id:nanoid(), workspaceId:get().activeWorkspaceId, projectId, parentId:parentId??null, title:title.trim(), description:'', blocks:[],
      status, priority: parentId ? 'low' : 'medium', taskType:'task', dueDate:null, assignee:'DJ', tags:[], checklists:[], customFields:{}, comments:[],
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
    }
    const tasks = [...get().tasks, t]
    pProjects(get().projects, tasks); set({ tasks })
    get().runAutomations('task_created', t.id)
    return t
  },
  reorderTask: (draggedId, targetId) => {
    if (draggedId === targetId) return
    get().pushUndo()
    const tasks = [...get().tasks]
    const from = tasks.findIndex(t => t.id===draggedId)
    const to   = tasks.findIndex(t => t.id===targetId)
    if (from < 0 || to < 0) return
    const [moved] = tasks.splice(from, 1)
    tasks.splice(tasks.findIndex(t => t.id===targetId), 0, moved)
    pProjects(get().projects, tasks); set({ tasks })
  },
  updateTask: (id, patch) => {
    const prev = get().tasks.find(t => t.id===id)
    const now = new Date().toISOString()
    // `completedAt` é gravado aqui, na transição de status, e só aqui: é o que permite ao
    // relatório dizer "concluídas em julho" sem que uma edição posterior mova a tarefa de
    // período (ver types/index.ts). Reabrir a tarefa limpa o campo.
    const completionPatch: Partial<Task> =
      patch.status && patch.status !== prev?.status
        ? { completedAt: patch.status === 'done' ? (patch.completedAt ?? now) : null }
        : {}
    const tasks = get().tasks.map(t => t.id===id ? {...t,...patch,...completionPatch,updatedAt:now} : t)
    pProjects(get().projects, tasks); set({ tasks })
    if (patch.status && prev?.status !== patch.status) {
      get().runAutomations('status_changed', id, prev)
      
      // Auto-complete parent if all subtasks done
      const task = tasks.find(t => t.id === id)
      if (task?.parentId) {
        const parent = tasks.find(t => t.id === task.parentId)
        if (parent) {
          const siblings = tasks.filter(t => t.parentId === task.parentId)
          const allDone = siblings.every(t => t.status === 'done')
          if (allDone && parent.status !== 'done') {
            get().updateTask(parent.id, { status: 'done' })
          } else if (!allDone && parent.status === 'done') {
            get().updateTask(parent.id, { status: 'in_progress' })
          }
        }
      }
    }
    if (patch.priority && prev?.priority !== patch.priority) get().runAutomations('priority_changed', id, prev)
    if (patch.assignee && prev?.assignee !== patch.assignee) get().runAutomations('assignee_changed', id, prev)
    if (patch.status === 'done' && prev?.status !== 'done') get().generateAISummaries(id)
  },
  deleteTask: (id) => {
    get().pushUndo()
    const toDelete = new Set<string>()
    const collect = (tid: string) => { toDelete.add(tid); get().tasks.filter(t => t.parentId===tid).forEach(t => collect(t.id)) }
    collect(id)
    const removidas = get().tasks.filter(t => toDelete.has(t.id))
    const tasks = get().tasks.filter(t => !toDelete.has(t.id))
    pProjects(get().projects, tasks)
    set({ tasks, selectedTaskId: toDelete.has(get().selectedTaskId??'') ? null : get().selectedTaskId })
    // Limpa os anexos na nuvem — antes eles ficavam órfãos para sempre.
    const uid = get().syncUid
    if (uid) deleteAttachmentsOf(uid, removidas)
  },
  updateBlocks: (taskId, blocks) => {
    const tasks = get().tasks.map(t => t.id===taskId ? {...t,blocks,updatedAt:new Date().toISOString()} : t)
    pProjects(get().projects, tasks); set({ tasks })
  },
  updateCustomField: (taskId, colId, value) => {
    const tasks = get().tasks.map(t => t.id===taskId ? {...t, customFields:{...t.customFields,[colId]:value}, updatedAt:new Date().toISOString()} : t)
    pProjects(get().projects, tasks); set({ tasks })
  },

  // ── Campos de IA ──────────────────────────────────────────────────────
  isAIGenerating: (taskId, colId) => get().aiGeneratingKeys.includes(`${taskId}:${colId}`),
  generateAISummaries: (taskId) => {
    const task = get().tasks.find(t => t.id===taskId); if (!task) return
    const isInbox = task.projectId === INBOX_PROJECT_ID
    const cols = isInbox ? get().inboxColumns : (get().projects.find(p => p.id===task.projectId)?.columns ?? [])
    cols.filter(c => c.type === 'ai_summary').forEach(c => { get().regenerateAISummary(taskId, c.id) })
  },
  regenerateAISummary: async (taskId, colId) => {
    const key = `${taskId}:${colId}`
    if (get().aiGeneratingKeys.includes(key)) return
    set({ aiGeneratingKeys: [...get().aiGeneratingKeys, key] })
    try {
      const task = get().tasks.find(t => t.id===taskId); if (!task) return
      const subtasks = get().getSubtasks(taskId)
      const geminiApiKey = useSettingsStore.getState().geminiApiKey
      const summary = await generateCompletionSummary(task, subtasks, geminiApiKey)
      get().updateCustomField(taskId, colId, summary)
    } finally {
      set({ aiGeneratingKeys: get().aiGeneratingKeys.filter(k => k !== key) })
    }
  },

  // ── Checklists ────────────────────────────────────────────────────────
  addChecklist: (taskId, title, clId) => {
    const cl: Checklist = { id:clId || nanoid(), title, items:[] }
    const tasks = get().tasks.map(t => t.id===taskId ? {...t,checklists:[...t.checklists,cl],updatedAt:new Date().toISOString()} : t)
    pProjects(get().projects,tasks); set({tasks})
  },
  renameChecklist: (taskId, clId, title) => {
    const tasks = get().tasks.map(t => t.id!==taskId ? t : { ...t, updatedAt:new Date().toISOString(), checklists:t.checklists.map(c => c.id!==clId ? c : {...c,title}) })
    pProjects(get().projects,tasks); set({tasks})
  },
  removeChecklist: (taskId, clId) => {
    const tasks = get().tasks.map(t => t.id===taskId ? {...t,checklists:t.checklists.filter(c=>c.id!==clId),updatedAt:new Date().toISOString()} : t)
    pProjects(get().projects,tasks); set({tasks})
  },
  addChecklistItem: (taskId, clId, text, itemId) => {
    const item: ChecklistItem = { id:itemId || nanoid(), text, done:false }
    const tasks = get().tasks.map(t => t.id!==taskId ? t : { ...t, updatedAt:new Date().toISOString(), checklists:t.checklists.map(c => c.id!==clId ? c : {...c,items:[...c.items,item]}) })
    pProjects(get().projects,tasks); set({tasks})
  },
  renameChecklistItem: (taskId, clId, itemId, text) => {
    const tasks = get().tasks.map(t => t.id!==taskId ? t : { ...t, updatedAt:new Date().toISOString(), checklists:t.checklists.map(c => c.id!==clId ? c : { ...c, items: c.items.map(i => i.id!==itemId ? i : { ...i, text }) }) })
    pProjects(get().projects,tasks); set({tasks})
  },
  toggleChecklistItem: (taskId, clId, itemId) => {
    const tasks = get().tasks.map(t => t.id!==taskId ? t : { ...t, updatedAt:new Date().toISOString(), checklists:t.checklists.map(c => c.id!==clId ? c : {...c,items:c.items.map(i => i.id===itemId ? {...i,done:!i.done} : i)}) })
    pProjects(get().projects,tasks); set({tasks})
  },
  removeChecklistItem: (taskId, clId, itemId) => {
    const tasks = get().tasks.map(t => t.id!==taskId ? t : { ...t, updatedAt:new Date().toISOString(), checklists:t.checklists.map(c => c.id!==clId ? c : {...c,items:c.items.filter(i=>i.id!==itemId)}) })
    pProjects(get().projects,tasks); set({tasks})
  },

  // ── Comentários ───────────────────────────────────────────────────────
  addComment: (taskId, patch) => {
    if (!patch.text?.trim() && !patch.attachment && !patch.audio) return
    const now = new Date()
    const comment: TaskComment = {
      id:nanoid(), author:'Djemeson', text:patch.text?.trim() ?? '',
      attachment:patch.attachment, audio:patch.audio, createdAt:now.toISOString(),
      parentId: patch.parentId ?? null,
    }
    const tasks = get().tasks.map(t => t.id===taskId ? {...t,comments:[...t.comments,comment],updatedAt:now.toISOString()} : t)
    pProjects(get().projects,tasks); set({tasks})
  },
  removeComment: (taskId, commentId) => {
    // Remove o comentário e também suas respostas (thread), evitando respostas órfãs.
    const tasks = get().tasks.map(t => t.id===taskId
      ? {...t, comments:t.comments.filter(c=>c.id!==commentId && c.parentId!==commentId), updatedAt:new Date().toISOString()}
      : t)
    pProjects(get().projects,tasks); set({tasks})
  },

  // ── Automations ───────────────────────────────────────────────────────
  addAutomation: (a) => {
    const automation: Automation = { ...a, id:nanoid(), workspaceId:get().activeWorkspaceId, createdAt:new Date().toISOString() }
    const automations = [...get().automations, automation]
    saveJSON(AUTOMATIONS_KEY, automations); set({ automations })
  },
  updateAutomation: (id, patch) => {
    const automations = get().automations.map(a => a.id===id ? {...a,...patch,updatedAt:new Date().toISOString()} : a)
    saveJSON(AUTOMATIONS_KEY, automations); set({ automations })
  },
  duplicateAutomation: (id) => {
    const original = get().automations.find(a => a.id===id); if (!original) return
    // Nasce desligada: duplicar costuma ser o começo de uma variação, e uma cópia ativa
    // por engano faz a mesma coisa duas vezes na mesma tarefa.
    const copia: Automation = {
      ...original, id: nanoid(), name: `${original.name} (cópia)`,
      enabled: false, createdAt: new Date().toISOString(), updatedAt: undefined,
    }
    const automations = [...get().automations, copia]
    saveJSON(AUTOMATIONS_KEY, automations); set({ automations })
  },
  toggleAutomation: (id) => {
    const automations = get().automations.map(a => a.id===id ? {...a,enabled:!a.enabled} : a)
    saveJSON(AUTOMATIONS_KEY, automations); set({ automations })
  },
  deleteAutomation: (id) => {
    const automations = get().automations.filter(a => a.id!==id)
    saveJSON(AUTOMATIONS_KEY, automations); set({ automations })
  },
  runAutomations: (triggerType, taskId, prev) => {
    const { tasks, automations } = get()
    const task = tasks.find(t => t.id===taskId); if (!task) return

    const candidatas = automations.filter(a =>
      a.enabled && a.workspaceId===task.workspaceId &&
      matchesTrigger(a, triggerType as TriggerType, { task, prev }))
    if (candidatas.length === 0) return

    // Guarda de cadeia: uma automação que altera a tarefa dispara o gatilho de novo, e
    // duas regras cruzadas (A: a fazer→em progresso, B: em progresso→a fazer) travariam o
    // app num laço infinito. Acima do limite a execução é registrada como ignorada, para
    // o usuário ver no histórico em vez de ficar sem entender por que parou.
    if (automationDepth >= MAX_AUTOMATION_DEPTH) {
      candidatas.forEach(a => get().logAutomationRun(a, task, 'skipped', 'Interrompida: automações disparando umas às outras'))
      return
    }

    automationDepth++
    try {
      candidatas.forEach(a => get().applyAutomation(a, task.id))
    } finally {
      automationDepth--
    }
  },

  /** Executa a ação de uma automação sobre uma tarefa e registra o resultado. */
  applyAutomation: (automation, taskId) => {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task) return
    const { type, value } = automation.action

    try {
      switch (type) {
        case 'change_status': {
          const novo = value as TaskStatus
          if (task.status === novo) return get().logAutomationRun(automation, task, 'skipped', 'Status já era esse')
          get().updateTask(taskId, { status: novo })
          return get().logAutomationRun(automation, task, 'ok', `Status → ${STATUS_LABEL[novo] ?? novo}`)
        }
        case 'change_priority': {
          const nova = value as Priority
          if (task.priority === nova) return get().logAutomationRun(automation, task, 'skipped', 'Prioridade já era essa')
          get().updateTask(taskId, { priority: nova })
          return get().logAutomationRun(automation, task, 'ok', `Prioridade → ${PRIORITY_LABEL[nova] ?? nova}`)
        }
        case 'assign': {
          const quem = String(value ?? '')
          if (task.assignee === quem) return get().logAutomationRun(automation, task, 'skipped', 'Responsável já era esse')
          get().updateTask(taskId, { assignee: quem })
          return get().logAutomationRun(automation, task, 'ok', `Atribuída a ${quem}`)
        }
        case 'add_tag': {
          const tag = String(value ?? '').trim()
          if (!tag) return get().logAutomationRun(automation, task, 'error', 'Etiqueta não definida na automação')
          if (task.tags.includes(tag)) return get().logAutomationRun(automation, task, 'skipped', `Já tinha a etiqueta "${tag}"`)
          get().updateTask(taskId, { tags: [...task.tags, tag] })
          return get().logAutomationRun(automation, task, 'ok', `Etiqueta "${tag}" aplicada`)
        }
        case 'set_due_date': {
          const dias = Number(value ?? 0)
          const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + dias)
          const iso = d.toISOString().slice(0, 10)
          if (task.dueDate) return get().logAutomationRun(automation, task, 'skipped', 'A tarefa já tinha prazo')
          get().updateTask(taskId, { dueDate: iso })
          return get().logAutomationRun(automation, task, 'ok', `Prazo definido para ${iso}`)
        }
        case 'move_project': {
          const destino = String(value ?? '')
          const proj = get().projects.find(p => p.id === destino)
          if (!proj) return get().logAutomationRun(automation, task, 'error', 'Projeto de destino não existe mais')
          if (task.projectId === destino) return get().logAutomationRun(automation, task, 'skipped', 'Já estava neste projeto')
          get().updateTask(taskId, { projectId: destino })
          return get().logAutomationRun(automation, task, 'ok', `Movida para ${proj.name}`)
        }
        case 'add_comment': {
          const texto = String(value ?? '').trim()
          if (!texto) return get().logAutomationRun(automation, task, 'error', 'Comentário vazio na automação')
          // `addComment` já define o autor; a automação entra como um comentário normal.
          get().addComment(taskId, { text: texto })
          return get().logAutomationRun(automation, task, 'ok', 'Comentário adicionado')
        }
        case 'notify': {
          // Antes esta ação não fazia nada: existia no formulário e era descartada.
          useNotificationStore.getState().push({
            title: String(value || automation.name),
            body: task.title,
            taskId,
          })
          return get().logAutomationRun(automation, task, 'ok', 'Notificação enviada')
        }
        case 'ai_enrich': {
          get().generateAISummaries(taskId)
          return get().logAutomationRun(automation, task, 'ok', 'Resumo de conclusão solicitado')
        }
      }
    } catch (e) {
      get().logAutomationRun(automation, task, 'error', e instanceof Error ? e.message : 'Falha ao executar')
    }
  },

  logAutomationRun: (automation, task, result, detail) => {
    const run: AutomationRun = {
      id: nanoid(), automationId: automation.id, automationName: automation.name,
      taskId: task.id, taskTitle: task.title,
      at: new Date().toISOString(), result, detail,
    }
    // Mantém só as últimas execuções: o histórico é para conferência do dia a dia, e o
    // documento de sincronização do Firestore tem limite de 1 MiB.
    const automationRuns = [run, ...get().automationRuns].slice(0, MAX_AUTOMATION_RUNS)
    saveJSON(AUTOMATION_RUNS_KEY, automationRuns)
    set({ automationRuns })
  },

  clearAutomationRuns: () => { saveJSON(AUTOMATION_RUNS_KEY, []); set({ automationRuns: [] }) },

  /**
   * Gatilho de prazo. Não existia executor: quem criasse "Prazo chegou" via a regra na
   * lista e ela nunca rodava. É chamado no carregamento e a cada minuto pelo App, junto
   * com a geração de notificações.
   */
  runDueDateAutomations: () => {
    const { tasks, automations, automationRuns } = get()
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    const hojeISO = hoje.toISOString().slice(0, 10)

    automations.filter(a => a.enabled && a.trigger.type === 'due_date_reached').forEach(a => {
      const dias = a.trigger.daysBefore ?? 0
      tasks.filter(t => {
        if (t.workspaceId !== a.workspaceId || t.status === 'done' || !t.dueDate) return false
        if (a.projectId !== ANY && a.projectId !== t.projectId) return false
        if (a.trigger.tag && !t.tags.includes(a.trigger.tag)) return false
        if (a.trigger.priority && t.priority !== a.trigger.priority) return false
        const prazo = new Date(t.dueDate + 'T00:00:00'); prazo.setHours(0,0,0,0)
        const faltam = Math.round((prazo.getTime() - hoje.getTime()) / 86_400_000)
        return faltam === dias
      }).forEach(t => {
        // Uma vez por tarefa por dia — senão o ciclo de 1 minuto repetiria o disparo.
        const jaRodouHoje = automationRuns.some(r =>
          r.automationId === a.id && r.taskId === t.id && r.at.slice(0, 10) === hojeISO)
        if (jaRodouHoje) return
        get().applyAutomation(a, t.id)
      })
    })
  },

  setViewPref: (key, value) => {
    const viewPrefs = { ...get().viewPrefs, [key]: value }
    saveJSON(VIEW_PREFS_KEY, viewPrefs); set({ viewPrefs })
  },

  // ── Notas ─────────────────────────────────────────────────────────────
  addNote: (patch) => {
    const agora = new Date().toISOString()
    const note: Note = {
      id: nanoid(), workspaceId: get().activeWorkspaceId,
      title: '', body: '', pinned: false, projectId: null,
      createdAt: agora, updatedAt: agora, ...patch,
    }
    const notes = [note, ...get().notes]
    saveJSON(NOTES_KEY, notes); set({ notes })
    return note
  },
  updateNote: (id, patch) => {
    const notes = get().notes.map(n => n.id===id ? {...n,...patch,updatedAt:new Date().toISOString()} : n)
    saveJSON(NOTES_KEY, notes); set({ notes })
  },
  deleteNote: (id) => {
    const notes = get().notes.filter(n => n.id!==id)
    saveJSON(NOTES_KEY, notes); set({ notes })
  },
  toggleNotePin: (id) => {
    const notes = get().notes.map(n => n.id===id ? {...n,pinned:!n.pinned} : n)
    saveJSON(NOTES_KEY, notes); set({ notes })
  },
  noteToTask: (id, projectId) => {
    const note = get().notes.find(n => n.id===id)
    if (!note) return null
    // Primeira linha vira título; o resto do texto vai para a descrição. É o caminho que
    // faltava: anotação sem destino não vira trabalho.
    const linhas = note.body.split('\n')
    const titulo = (note.title.trim() || linhas[0]?.trim() || 'Nota').slice(0, 120)
    const corpo  = note.title.trim() ? note.body : linhas.slice(1).join('\n')
    const tarefa = get().addTask({
      projectId, parentId: null, title: titulo, description: corpo.trim(),
      blocks: corpo.trim() ? [{ id: nanoid(), type: 'text', text: corpo.trim(), region: 'body' }] : [],
      status: 'todo', priority: 'medium', taskType: 'task',
      dueDate: null, assignee: '', tags: [], checklists: [], customFields: {}, comments: [],
    } as any)
    get().deleteNote(id)
    return tarefa
  },

  // ── Metas / Objetivos ─────────────────────────────────────────────────
  addGoal: (g) => {
    const goal: Goal = { ...g, id:nanoid(), workspaceId:get().activeWorkspaceId, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
    const goals = [...get().goals, goal]
    saveJSON(GOALS_KEY, goals); set({ goals })
    return goal
  },
  updateGoal: (id, patch) => {
    const goals = get().goals.map(g => g.id===id ? {...g,...patch,updatedAt:new Date().toISOString()} : g)
    saveJSON(GOALS_KEY, goals); set({ goals })
  },
  updateGoalTarget: (goalId, targetId, patch) => {
    const agora = new Date().toISOString()
    const goals = get().goals.map(g => g.id!==goalId ? g : {
      ...g,
      targets: g.targets.map(t => t.id===targetId ? { ...t, ...patch, updatedAt: agora } : t),
      updatedAt: agora,
    })
    saveJSON(GOALS_KEY, goals); set({ goals })
  },
  deleteGoal: (id) => {
    const goals = get().goals.filter(g => g.id!==id)
    saveJSON(GOALS_KEY, goals); set({ goals })
  },

  getAllTags:   () => [...new Set(get().tasks.filter(t => t.workspaceId===get().activeWorkspaceId).flatMap(t => t.tags))].sort(),
  getAllAssignees: () => [...new Set(get().tasks.filter(t => t.workspaceId===get().activeWorkspaceId && t.assignee).map(t => t.assignee))].sort(),
  getSubtasks: (parentId) => get().tasks.filter(t => t.parentId===parentId),
  filteredTasks: (tasks) => {
    const f = get().filters
    return tasks.filter(t => {
      if (f.status   !== 'all' && t.status   !== f.status)   return false
      if (f.priority !== 'all' && t.priority !== f.priority) return false
      if (f.assignee && !t.assignee.toLowerCase().includes(f.assignee.toLowerCase())) return false
      if (f.tags.length > 0 && !f.tags.every(tag => t.tags.includes(tag))) return false
      if (f.datePeriod && !matchesDateFilter(t, f.dateField, f.datePeriod)) return false
      return true
    })
  },

  pushToCloud: async ({ force = false } = {}) => {
    const uid = get().syncUid;
    if (!uid || !db) return;
    if (!cloudReady && !force) return;   // ver `cloudReady`: nada sobe antes de ler a nuvem
    set({ cloudSyncStatus: 'syncing' });
    try {
      const tasks = await stripAndUploadAttachments(uid, get().tasks);
      const stateToSync = {
        projects: get().projects,
        tasks,
        spaces: get().spaces,
        folders: get().folders,
        workspaces: get().workspaces,
        activeWorkspaceId: get().activeWorkspaceId,
        automations: get().automations,
        goals: get().goals,
        notes: get().notes,
        viewPrefs: get().viewPrefs,
        automationRuns: get().automationRuns,
        inboxColumns: get().inboxColumns,
        customViewsByScope: get().customViewsByScope,
        // Chaves de IA e atalho viajam junto (ver DIRETRIZES, seção 13.8). Ficam sob o uid
        // do dono, que é o único a ler o documento pelas regras do Firestore.
        settings: lerSettings(),
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'syncGroups', uid), stateToSync);
      set({ cloudSyncStatus: 'synced', lastSyncedAt: new Date().toLocaleTimeString('pt-BR') });
    } catch (e) {
      console.error('Erro ao sincronizar com a nuvem:', e);
      set({ cloudSyncStatus: 'error' });
    }
  },

  startCloudSync: (uid: string) => {
    if (!db || !uid) return;
    if (unsubscribeCloud) { unsubscribeCloud(); unsubscribeCloud = null; }
    set({ syncUid: uid });

    unsubscribeCloud = onSnapshot(doc(db, 'syncGroups', uid), async (snap) => {
      // Ignora o "eco" da própria escrita local (evita loop push→pull→push)
      if (snap.metadata.hasPendingWrites) return;

      if (!snap.exists()) {
        // Conta sem documento: aqui a decisão de semear é explícita, então o push é
        // forçado (a trava existe para o caso oposto — sobrescrever dados que existem).
        const migrated = await migrateLegacySyncCode(set, get, uid);
        cloudReady = true;
        if (!migrated) get().pushToCloud({ force: true });
        return;
      }

      await applyRemoteSnapshot(set, get, uid, snap.data());
      cloudReady = true;   // a partir daqui o estado local já reflete a nuvem
    }, (err) => {
      console.error('Erro na assinatura em tempo real:', err);
      set({ cloudSyncStatus: 'error' });
    });
  },

  stopCloudSync: () => {
    if (unsubscribeCloud) { unsubscribeCloud(); unsubscribeCloud = null; }
    cloudReady = false;
    set({ cloudSyncStatus: 'idle', syncUid: null });
  },

  init: () => {
    const rawProjects = localProjects.getAll() as unknown as Record<string, unknown>[]
    const projects    = rawProjects.map(migrateProject)
    const rawTasks    = localTasks.getAll() as unknown as Record<string,unknown>[]
    const tasks       = rawTasks.map(migrateTask)

    // `completedAt` derivado precisa ser **gravado** na primeira carga: migrar só em
    // memória faria o valor ser recalculado do `updatedAt` a cada abertura do app, que é
    // exatamente o problema que o campo veio resolver (tarefa antiga "pulando" de período
    // ao ser editada). Grava uma vez e congela.
    const needsCompletionBackfill = rawTasks.some(t => t.status === 'done' && t.completedAt === undefined)
    if (needsCompletionBackfill) localTasks.set(tasks as any)
    const spaces      = loadJSON<Record<string,unknown>[]>(SPACES_KEY, []).map(migrateSpace)
    const folders     = loadJSON<Record<string,unknown>[]>(FOLDERS_KEY, []).map(migrateFolder)
    const automations = loadJSON<Record<string,unknown>[]>(AUTOMATIONS_KEY, []).map(migrateAutomation)
    const automationRuns = loadJSON<AutomationRun[]>(AUTOMATION_RUNS_KEY, [])
    const viewPrefs   = loadJSON<Record<string,string>>(VIEW_PREFS_KEY, {})
    const goals       = loadJSON<Goal[]>(GOALS_KEY, [])
    // Notas do formato antigo (só id/title/body/updatedAt) ganham workspace, pinned e
    // projectId aqui; a partir de agora elas viajam no documento de sincronização.
    const notes       = loadJSON<Record<string,unknown>[]>(NOTES_KEY, []).map(migrateNote)
    const inboxColumns= loadJSON<ColumnDef[]>(INBOX_COLS_KEY, [])

    let workspaces = loadJSON<Workspace[]>(WORKSPACES_KEY, [])
    if (workspaces.length === 0) {
      workspaces = [{ id: DEFAULT_WORKSPACE_ID, name: "Djemeson's Workspace", color: '#4F46E5', createdAt: new Date().toISOString() }]
      saveJSON(WORKSPACES_KEY, workspaces)
    }
    const activeWorkspaceId = loadJSON<string>(ACTIVE_WS_KEY, DEFAULT_WORKSPACE_ID)

    // Migra visualizações personalizadas antigas (guardadas em project.customViews) para o
    // armazenamento genérico por escopo, na primeira vez que essa versão roda.
    let customViewsByScope = loadJSON<Record<string, CustomProjectView[]>>(CUSTOM_VIEWS_KEY, {})
    let migrated = false
    projects.forEach(p => {
      const scope = scopeKeyForProject(p.id)
      if (!customViewsByScope[scope] && p.customViews && p.customViews.length > 0) {
        customViewsByScope = { ...customViewsByScope, [scope]: p.customViews }
        migrated = true
      }
    })
    if (migrated) saveJSON(CUSTOM_VIEWS_KEY, customViewsByScope)

    if (projects.length===0) {
      const seeded = SEED_PROJECTS.map(p => ({ ...p, folderId:null, taskOpenMode:'center' as const, customViews:[] }))
      const seededTasks = SEED_TASKS.map(t => ({ ...t, taskType:'task' as const }))
      pProjects(seeded as any, seededTasks as any)
      set({
        projects: seeded as any, tasks: seededTasks as any, spaces, folders, workspaces, activeWorkspaceId, automations, automationRuns, goals, notes, viewPrefs, inboxColumns, customViewsByScope,
      })
    } else {
      set({
        projects, tasks, spaces, folders, workspaces, activeWorkspaceId, automations, automationRuns, goals, notes, viewPrefs, inboxColumns, customViewsByScope,
      })
    }
  },
}))
