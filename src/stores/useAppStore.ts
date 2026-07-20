import { create } from 'zustand'
import { nanoid } from '../lib/nanoid'
import { localProjects, localTasks } from '../lib/localStore'
import { SEED_PROJECTS, SEED_TASKS } from '../lib/seed'
import type {
  Project, Task, Space, Folder, ColumnDef, Automation, ViewType,
  View, TaskStatus, Priority, Checklist, ChecklistItem, ContentBlock,
  TaskType, TaskOpenMode, CustomProjectView, DateFieldKey, DateFilterValue,
  Workspace, TaskComment,
} from '../types'
import {
  calcGUT, migrateTask, migrateProject, migrateSpace, migrateFolder, migrateAutomation,
  INBOX_PROJECT_ID, DEFAULT_WORKSPACE_ID,
} from '../types'
import { matchesDateFilter } from '../lib/dateFilter'
import { generateCompletionSummary } from '../lib/aiSummary'
import { useSettingsStore } from './useSettingsStore'

const SPACES_KEY      = 'tf_spaces'
const FOLDERS_KEY     = 'tf_folders'
const WORKSPACES_KEY  = 'tf_workspaces'
const ACTIVE_WS_KEY   = 'tf_active_workspace'
const AUTOMATIONS_KEY = 'tf_automations'
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
  toggleAutomation: (id: string) => void
  deleteAutomation: (id: string) => void
  runAutomations:   (trigger: string, taskId: string, prev?: Partial<Task>) => void

  getAllTags:   () => string[]
  getAllAssignees: () => string[]
  getSubtasks: (parentId: string) => Task[]
  filteredTasks: (tasks: Task[]) => Task[]
  init: () => void

  // Sincronização entre Dispositivos
  syncCode: string | null
  syncStatus: 'idle' | 'syncing' | 'error' | 'success'
  lastSyncedAt: string | null
  isSyncActive: boolean

  setSyncCode: (code: string | null) => void
  activateSync: (code: string, forceUpload?: boolean) => Promise<boolean>
  disableSync: () => void
  pushStateToServer: () => Promise<void>
  pullStateFromServer: (codeToUse?: string) => Promise<boolean>
  generateSyncCode: () => Promise<string>
}

let syncDebounceTimeout: any = null;
function triggerSyncPush() {
  if (syncDebounceTimeout) clearTimeout(syncDebounceTimeout);
  syncDebounceTimeout = setTimeout(() => {
    try {
      const store = useAppStore.getState();
      if (store && store.isSyncActive && store.syncCode) {
        store.pushStateToServer();
      }
    } catch (e) {
      console.error("Error triggerSyncPush:", e);
    }
  }, 1500);
}

function pProjects(p: Project[], t: Task[]) { 
  localProjects.set(p as any); 
  localTasks.set(t as any);
  triggerSyncPush();
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [], tasks: [], spaces: [], folders: [],
  workspaces: [], activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  automations: [], inboxColumns: [], undoStack: [],
  customViewsByScope: {},
  aiGeneratingKeys: [],
  activeView:'my_tasks', activeProjectId:null, activeSpaceId:null, activeFolderId:null, selectedTaskId:null,
  filterPanelOpen:false, aiPanelOpen:false, quickCaptureOpen:false, mobileSidebarOpen:false, filters:EMPTY_FILTER,
  newProjectModal:false, newProjectCtx:{}, aiProjectModal:false, aiProjectCtx:{}, enrichProjectModal:null, gutModal:{open:false,projectId:null},
  columnsModal:null, columnsModalScope:null, columnsVersion:0, newViewModal:null,

  // Sincronização
  syncCode: null,
  syncStatus: 'idle',
  lastSyncedAt: null,
  isSyncActive: false,

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
    const tasks    = get().tasks.filter(t => t.projectId !== id)
    pProjects(projects, tasks); set({ projects, tasks })
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
    const tasks = get().tasks.map(t => t.id===id ? {...t,...patch,updatedAt:new Date().toISOString()} : t)
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
    const tasks = get().tasks.filter(t => !toDelete.has(t.id))
    pProjects(get().projects, tasks)
    set({ tasks, selectedTaskId: toDelete.has(get().selectedTaskId??'') ? null : get().selectedTaskId })
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
    }
    const tasks = get().tasks.map(t => t.id===taskId ? {...t,comments:[...t.comments,comment],updatedAt:now.toISOString()} : t)
    pProjects(get().projects,tasks); set({tasks})
  },
  removeComment: (taskId, commentId) => {
    const tasks = get().tasks.map(t => t.id===taskId ? {...t,comments:t.comments.filter(c=>c.id!==commentId),updatedAt:new Date().toISOString()} : t)
    pProjects(get().projects,tasks); set({tasks})
  },

  // ── Automations ───────────────────────────────────────────────────────
  addAutomation: (a) => {
    const automation: Automation = { ...a, id:nanoid(), workspaceId:get().activeWorkspaceId, createdAt:new Date().toISOString() }
    const automations = [...get().automations, automation]
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
  runAutomations: (triggerType, taskId, _prev) => {
    const { tasks, automations, updateTask } = get()
    const task = tasks.find(t => t.id===taskId); if (!task) return
    automations
      .filter(a => a.enabled && a.workspaceId===task.workspaceId && a.trigger.type===triggerType && (a.projectId===task.projectId || a.projectId==='*'))
      .forEach(a => {
        if (a.action.type==='change_status')   updateTask(taskId, { status:   a.action.value as TaskStatus })
        if (a.action.type==='change_priority') updateTask(taskId, { priority: a.action.value as Priority  })
        if (a.action.type==='assign')          updateTask(taskId, { assignee: a.action.value as string    })
      })
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

  setSyncCode: (code) => {
    if (code) {
      localStorage.setItem('tf_sync_code', code);
    } else {
      localStorage.removeItem('tf_sync_code');
    }
    set({ syncCode: code });
  },

  generateSyncCode: async () => {
    set({ syncStatus: 'syncing' });
    try {
      const stateToSync = {
        projects: get().projects,
        tasks: get().tasks,
        spaces: get().spaces,
        folders: get().folders,
        workspaces: get().workspaces,
        activeWorkspaceId: get().activeWorkspaceId,
        automations: get().automations,
        inboxColumns: get().inboxColumns,
        customViewsByScope: get().customViewsByScope,
      };

      const res = await fetch('/api/sync/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateToSync })
      });
      const data = await res.json();
      if (data.success && data.syncCode) {
        localStorage.setItem('tf_sync_code', data.syncCode);
        localStorage.setItem('tf_is_sync_active', 'true');
        localStorage.setItem('tf_last_synced_at', new Date().toISOString());
        set({
          syncCode: data.syncCode,
          isSyncActive: true,
          syncStatus: 'success',
          lastSyncedAt: new Date().toLocaleTimeString('pt-BR')
        });
        return data.syncCode;
      }
    } catch (e) {
      console.error(e);
    }
    set({ syncStatus: 'error' });
    throw new Error("Erro ao gerar o código de sincronização no servidor.");
  },

  activateSync: async (code, forceUpload) => {
    const formattedCode = code.trim().toUpperCase();
    set({ syncStatus: 'syncing' });
    try {
      if (forceUpload) {
        const stateToSync = {
          projects: get().projects,
          tasks: get().tasks,
          spaces: get().spaces,
          folders: get().folders,
          workspaces: get().workspaces,
          activeWorkspaceId: get().activeWorkspaceId,
          automations: get().automations,
          inboxColumns: get().inboxColumns,
          customViewsByScope: get().customViewsByScope,
        };

        const res = await fetch('/api/sync/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syncCode: formattedCode, state: stateToSync })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('tf_sync_code', formattedCode);
          localStorage.setItem('tf_is_sync_active', 'true');
          localStorage.setItem('tf_last_synced_at', new Date().toISOString());
          set({
            syncCode: formattedCode,
            isSyncActive: true,
            syncStatus: 'success',
            lastSyncedAt: new Date().toLocaleTimeString('pt-BR')
          });
          return true;
        }
      } else {
        const success = await get().pullStateFromServer(formattedCode);
        if (success) {
          localStorage.setItem('tf_sync_code', formattedCode);
          localStorage.setItem('tf_is_sync_active', 'true');
          set({
            syncCode: formattedCode,
            isSyncActive: true
          });
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }
    set({ syncStatus: 'error' });
    return false;
  },

  disableSync: () => {
    localStorage.removeItem('tf_sync_code');
    localStorage.removeItem('tf_is_sync_active');
    localStorage.removeItem('tf_last_synced_at');
    set({
      syncCode: null,
      isSyncActive: false,
      syncStatus: 'idle',
      lastSyncedAt: null
    });
  },

  pushStateToServer: async () => {
    const code = get().syncCode;
    if (!code || !get().isSyncActive) return;

    set({ syncStatus: 'syncing' });
    try {
      const stateToSync = {
        projects: get().projects,
        tasks: get().tasks,
        spaces: get().spaces,
        folders: get().folders,
        workspaces: get().workspaces,
        activeWorkspaceId: get().activeWorkspaceId,
        automations: get().automations,
        inboxColumns: get().inboxColumns,
        customViewsByScope: get().customViewsByScope,
      };

      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode: code, state: stateToSync })
      });
      const data = await res.json();
      if (data.success) {
        set({
          syncStatus: 'success',
          lastSyncedAt: new Date().toLocaleTimeString('pt-BR')
        });
        localStorage.setItem('tf_last_synced_at', new Date().toISOString());
      } else {
        set({ syncStatus: 'error' });
      }
    } catch (e) {
      console.error("Error pushing state to server:", e);
      set({ syncStatus: 'error' });
    }
  },

  pullStateFromServer: async (codeToUse) => {
    const code = codeToUse || get().syncCode;
    if (!code) return false;

    set({ syncStatus: 'syncing' });
    try {
      const res = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode: code })
      });
      if (res.status === 404) {
        set({ syncStatus: 'error' });
        return false;
      }
      const data = await res.json();
      if (data.success && data.state) {
        const { projects, tasks, spaces, folders, workspaces, activeWorkspaceId, automations, inboxColumns, customViewsByScope } = data.state;

        // Save locally to storage
        if (projects) {
          localProjects.set(projects);
          localTasks.set(tasks || []);
        }
        if (spaces) localStorage.setItem(SPACES_KEY, JSON.stringify(spaces));
        if (folders) localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
        if (workspaces) localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
        if (activeWorkspaceId) localStorage.setItem(ACTIVE_WS_KEY, activeWorkspaceId);
        if (automations) localStorage.setItem(AUTOMATIONS_KEY, JSON.stringify(automations));
        if (inboxColumns) localStorage.setItem(INBOX_COLS_KEY, JSON.stringify(inboxColumns));
        if (customViewsByScope) localStorage.setItem(CUSTOM_VIEWS_KEY, JSON.stringify(customViewsByScope));

        // Update Zustand state (bypassing triggers)
        set({
          projects: projects || get().projects,
          tasks: tasks || get().tasks,
          spaces: spaces || get().spaces,
          folders: folders || get().folders,
          workspaces: workspaces || get().workspaces,
          activeWorkspaceId: activeWorkspaceId || get().activeWorkspaceId,
          automations: automations || get().automations,
          inboxColumns: inboxColumns || get().inboxColumns,
          customViewsByScope: customViewsByScope || get().customViewsByScope,
          syncStatus: 'success',
          lastSyncedAt: new Date().toLocaleTimeString('pt-BR')
        });

        localStorage.setItem('tf_last_synced_at', new Date().toISOString());
        return true;
      }
    } catch (e) {
      console.error("Error pulling state from server:", e);
    }
    set({ syncStatus: 'error' });
    return false;
  },

  init: () => {
    const rawProjects = localProjects.getAll() as unknown as Record<string, unknown>[]
    const projects    = rawProjects.map(migrateProject)
    const tasks       = (localTasks.getAll() as unknown as Record<string,unknown>[]).map(migrateTask)
    const spaces      = loadJSON<Record<string,unknown>[]>(SPACES_KEY, []).map(migrateSpace)
    const folders     = loadJSON<Record<string,unknown>[]>(FOLDERS_KEY, []).map(migrateFolder)
    const automations = loadJSON<Record<string,unknown>[]>(AUTOMATIONS_KEY, []).map(migrateAutomation)
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

    const syncCode = localStorage.getItem('tf_sync_code') || null;
    const isSyncActive = localStorage.getItem('tf_is_sync_active') === 'true';
    const lastSyncedAtRaw = localStorage.getItem('tf_last_synced_at');
    const lastSyncedAt = lastSyncedAtRaw ? new Date(lastSyncedAtRaw).toLocaleTimeString('pt-BR') : null;

    if (projects.length===0) {
      const seeded = SEED_PROJECTS.map(p => ({ ...p, folderId:null, taskOpenMode:'center' as const, customViews:[] }))
      const seededTasks = SEED_TASKS.map(t => ({ ...t, taskType:'task' as const }))
      pProjects(seeded as any, seededTasks as any)
      set({ 
        projects: seeded as any, tasks: seededTasks as any, spaces, folders, workspaces, activeWorkspaceId, automations, inboxColumns, customViewsByScope,
        syncCode, isSyncActive, lastSyncedAt, syncStatus: 'idle'
      })
    } else {
      set({ 
        projects, tasks, spaces, folders, workspaces, activeWorkspaceId, automations, inboxColumns, customViewsByScope,
        syncCode, isSyncActive, lastSyncedAt, syncStatus: 'idle'
      })
    }

    // Pull inicial se sincronização estiver ativa
    if (isSyncActive && syncCode) {
      setTimeout(() => {
        get().pullStateFromServer();
      }, 500);
    }

    // Polling em background a cada 30 segundos se sincronização estiver ativa
    setInterval(() => {
      if (document.visibilityState === 'visible' && get().isSyncActive && get().syncCode) {
        get().pullStateFromServer();
      }
    }, 30000);
  },
}))
