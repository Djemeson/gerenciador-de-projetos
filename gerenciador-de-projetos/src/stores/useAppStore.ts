import { create } from 'zustand'
import { nanoid } from '../lib/nanoid'
import { localProjects, localTasks } from '../lib/localStore'
import { SEED_PROJECTS, SEED_TASKS } from '../lib/seed'
import type {
  Project, Task, Space, Folder, ColumnDef, Automation, ViewType,
  View, TaskStatus, Priority, Checklist, ChecklistItem, ContentBlock,
  TaskType, TaskOpenMode, CustomProjectView,
} from '../types'
import { calcGUT, migrateTask, migrateProject, INBOX_PROJECT_ID } from '../types'

const SPACES_KEY     = 'tf_spaces'
const FOLDERS_KEY    = 'tf_folders'
const AUTOMATIONS_KEY= 'tf_automations'
const INBOX_COLS_KEY = 'tf_inbox_columns'

function loadJSON<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}
function saveJSON(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)) }

// ── Global filters state ───────────────────────────────────────────────────
export interface FilterState {
  status:    TaskStatus | 'all'
  priority:  Priority   | 'all'
  assignee:  string
  tags:      string[]
  dueBefore: string
  dueAfter:  string
}
const EMPTY_FILTER: FilterState = { status:'all', priority:'all', assignee:'', tags:[], dueBefore:'', dueAfter:'' }

interface AppState {
  projects:    Project[]
  tasks:       Task[]
  spaces:      Space[]
  folders:     Folder[]
  automations: Automation[]
  inboxColumns: ColumnDef[]

  activeView:      View
  activeProjectId: string | null
  activeSpaceId:   string | null
  activeFolderId:  string | null
  selectedTaskId:  string | null
  filterPanelOpen: boolean
  aiPanelOpen:     boolean
  filters:         FilterState

  newProjectModal: boolean
  newProjectCtx:   { spaceId?: string; folderId?: string }
  gutModal:        { open: boolean; projectId: string | null }
  columnsModal:    string | null  // projectId
  newViewModal:    string | null  // projectId

  setView:         (view: View, projectId?: string) => void
  openSpace:       (id: string) => void
  openFolder:      (id: string) => void
  setSelectedTask: (id: string | null) => void
  toggleFilterPanel: () => void
  toggleAIPanel:   () => void
  setFilters:      (f: Partial<FilterState>) => void
  clearFilters:    () => void

  openNewProject:  (spaceId?: string, folderId?: string) => void
  closeNewProject: () => void
  openGUT:         (id: string) => void
  closeGUT:        () => void
  openColumnsModal:(id: string) => void
  closeColumnsModal:() => void
  openNewViewModal:(id: string) => void
  closeNewViewModal:() => void

  // Spaces
  addSpace:    (name: string, color: string, icon?: string) => Space
  updateSpace: (id: string, patch: Partial<Space>) => void
  deleteSpace: (id: string) => void

  // Folders
  addFolder:    (name: string, spaceId: string, icon?: string) => Folder
  updateFolder: (id: string, patch: Partial<Folder>) => void
  deleteFolder: (id: string) => void

  // Projects
  addProject:       (name: string, color: string, desc: string, spaceId?: string, folderId?: string, icon?: string) => void
  moveProject:      (id: string, spaceId: string | null, folderId: string | null) => void
  reorderProject:   (draggedId: string, targetId: string) => void
  updateProject:    (id: string, patch: Partial<Project>) => void
  deleteProject:    (id: string) => void
  archiveProject:   (id: string) => void
  unarchiveProject: (id: string) => void
  saveGUT:          (id: string, g: number, u: number, t: number) => void
  setProjectView:   (id: string, view: ViewType) => void
  setTaskOpenMode:  (id: string, mode: TaskOpenMode) => void
  addColumn:        (projectId: string, col: Omit<ColumnDef,'id'>) => void
  updateColumn:     (projectId: string, colId: string, patch: Partial<ColumnDef>) => void
  deleteColumn:     (projectId: string, colId: string) => void
  addCustomView:    (projectId: string, view: Omit<CustomProjectView,'id'>) => void
  deleteCustomView: (projectId: string, viewId: string) => void

  // Tasks
  addTask:       (task: Omit<Task,'id'|'createdAt'|'updatedAt'>) => Task
  quickAddTask:  (title: string, projectId: string, status: TaskStatus, parentId?: string) => Task
  updateTask:    (id: string, patch: Partial<Task>) => void
  deleteTask:    (id: string) => void
  updateBlocks:  (taskId: string, blocks: ContentBlock[]) => void
  updateCustomField: (taskId: string, colId: string, value: unknown) => void

  // Checklists
  addChecklist:        (taskId: string, title: string) => void
  removeChecklist:     (taskId: string, checklistId: string) => void
  addChecklistItem:    (taskId: string, checklistId: string, text: string) => void
  toggleChecklistItem: (taskId: string, checklistId: string, itemId: string) => void
  removeChecklistItem: (taskId: string, checklistId: string, itemId: string) => void

  // Automations
  addAutomation:    (a: Omit<Automation,'id'|'createdAt'>) => void
  toggleAutomation: (id: string) => void
  deleteAutomation: (id: string) => void
  runAutomations:   (trigger: string, taskId: string, prev?: Partial<Task>) => void

  getAllTags:   () => string[]
  getSubtasks: (parentId: string) => Task[]
  filteredTasks: (tasks: Task[]) => Task[]
  init: () => void
}

function pProjects(p: Project[], t: Task[]) { localProjects.set(p as any); localTasks.set(t as any) }

export const useAppStore = create<AppState>((set, get) => ({
  projects: [], tasks: [], spaces: [], folders: [], automations: [], inboxColumns: [],
  activeView:'my_tasks', activeProjectId:null, activeSpaceId:null, activeFolderId:null, selectedTaskId:null,
  filterPanelOpen:false, aiPanelOpen:false, filters:EMPTY_FILTER,
  newProjectModal:false, newProjectCtx:{}, gutModal:{open:false,projectId:null}, columnsModal:null, newViewModal:null,

  setView: (view, projectId) => set({ activeView:view, activeProjectId:projectId??null, activeSpaceId:null, activeFolderId:null, selectedTaskId:null }),
  openSpace:  (id) => set({ activeView:'space_detail',  activeSpaceId:id, activeFolderId:null, activeProjectId:null, selectedTaskId:null }),
  openFolder: (id) => set({ activeView:'folder_detail', activeFolderId:id, activeSpaceId:null, activeProjectId:null, selectedTaskId:null }),
  setSelectedTask: (id) => set({ selectedTaskId:id }),
  toggleFilterPanel: () => set(s => ({ filterPanelOpen:!s.filterPanelOpen })),
  toggleAIPanel:     () => set(s => ({ aiPanelOpen:!s.aiPanelOpen })),
  setFilters:  (f) => set(s => ({ filters:{ ...s.filters, ...f } })),
  clearFilters:() => set({ filters:EMPTY_FILTER }),

  openNewProject:  (spaceId, folderId) => set({ newProjectModal:true, newProjectCtx:{ spaceId, folderId } }),
  closeNewProject: () => set({ newProjectModal:false, newProjectCtx:{} }),
  openGUT:         (id) => set({ gutModal:{open:true,projectId:id} }),
  closeGUT:        () => set({ gutModal:{open:false,projectId:null} }),
  openColumnsModal: (id) => set({ columnsModal:id }),
  closeColumnsModal:() => set({ columnsModal:null }),
  openNewViewModal: (id) => set({ newViewModal: id }),
  closeNewViewModal:() => set({ newViewModal: null }),

  // ── Spaces ───────────────────────────────────────────────────────────
  addSpace: (name, color, icon) => {
    const s: Space = { id:nanoid(), name, color, icon, collapsed:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
    const spaces = [...get().spaces, s]
    saveJSON(SPACES_KEY, spaces); set({ spaces }); return s
  },
  updateSpace: (id, patch) => {
    const spaces = get().spaces.map(s => s.id===id ? {...s,...patch,updatedAt:new Date().toISOString()} : s)
    saveJSON(SPACES_KEY, spaces); set({ spaces })
  },
  deleteSpace: (id) => {
    const spaces   = get().spaces.filter(s => s.id !== id)
    const folders  = get().folders.filter(f => f.spaceId !== id)
    const projects = get().projects.map(p => p.spaceId===id ? {...p,spaceId:null,folderId:null} : p)
    saveJSON(SPACES_KEY, spaces); saveJSON(FOLDERS_KEY, folders)
    pProjects(projects, get().tasks); set({ spaces, folders, projects })
  },

  // ── Folders ──────────────────────────────────────────────────────────
  addFolder: (name, spaceId, icon) => {
    const f: Folder = { id:nanoid(), name, spaceId, icon, collapsed:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
    const folders = [...get().folders, f]
    saveJSON(FOLDERS_KEY, folders); set({ folders }); return f
  },
  updateFolder: (id, patch) => {
    const folders = get().folders.map(f => f.id===id ? {...f,...patch,updatedAt:new Date().toISOString()} : f)
    saveJSON(FOLDERS_KEY, folders); set({ folders })
  },
  deleteFolder: (id) => {
    const folders  = get().folders.filter(f => f.id !== id)
    const projects = get().projects.map(p => p.folderId===id ? {...p,folderId:null} : p)
    saveJSON(FOLDERS_KEY, folders); pProjects(projects, get().tasks); set({ folders, projects })
  },

  // ── Projects ─────────────────────────────────────────────────────────
  addProject: (name, color, description, spaceId, folderId, icon) => {
    const p: Project = {
      id:nanoid(), name, color, description, icon,
      spaceId:spaceId??null, folderId:folderId??null,
      gut:calcGUT(1,1,1), archived:false, columns:[], activeView:'list',
      taskOpenMode:'side', customViews:[],
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
    }
    const projects = [...get().projects, p]
    pProjects(projects, get().tasks); set({ projects })
  },
  moveProject: (id, spaceId, folderId) => {
    const projects = get().projects.map(p => p.id===id ? {...p, spaceId, folderId, updatedAt:new Date().toISOString()} : p)
    pProjects(projects, get().tasks); set({ projects })
  },
  reorderProject: (draggedId, targetId) => {
    if (draggedId === targetId) return
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
    const projects = get().projects.filter(p => p.id !== id)
    const tasks    = get().tasks.filter(t => t.projectId !== id)
    pProjects(projects, tasks); set({ projects, tasks })
  },
  archiveProject: (id) => {
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
  addCustomView: (projectId, view) => {
    const newView: CustomProjectView = { ...view, id: nanoid() }
    const projects = get().projects.map(p => p.id!==projectId ? p : { ...p, customViews:[...(p.customViews??[]),newView] })
    pProjects(projects, get().tasks); set({ projects })
  },
  deleteCustomView: (projectId, viewId) => {
    const projects = get().projects.map(p => p.id!==projectId ? p : { ...p, customViews:(p.customViews??[]).filter(v => v.id!==viewId) })
    pProjects(projects, get().tasks); set({ projects })
  },

  // ── Tasks ─────────────────────────────────────────────────────────────
  addTask: (task) => {
    const t: Task = { ...task, id:nanoid(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
    const tasks = [...get().tasks, t]
    pProjects(get().projects, tasks); set({ tasks })
    get().runAutomations('task_created', t.id)
    return t
  },
  quickAddTask: (title, projectId, status, parentId) => {
    const t: Task = {
      id:nanoid(), projectId, parentId:parentId??null, title:title.trim(), description:'', blocks:[],
      status, priority:'medium', taskType:'task', dueDate:null, assignee:'DJ', tags:[], checklists:[], customFields:{},
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
    }
    const tasks = [...get().tasks, t]
    pProjects(get().projects, tasks); set({ tasks })
    get().runAutomations('task_created', t.id)
    return t
  },
  updateTask: (id, patch) => {
    const prev = get().tasks.find(t => t.id===id)
    const tasks = get().tasks.map(t => t.id===id ? {...t,...patch,updatedAt:new Date().toISOString()} : t)
    pProjects(get().projects, tasks); set({ tasks })
    if (patch.status && prev?.status !== patch.status) get().runAutomations('status_changed', id, prev)
    if (patch.priority && prev?.priority !== patch.priority) get().runAutomations('priority_changed', id, prev)
    if (patch.assignee && prev?.assignee !== patch.assignee) get().runAutomations('assignee_changed', id, prev)
  },
  deleteTask: (id) => {
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

  // ── Checklists ────────────────────────────────────────────────────────
  addChecklist: (taskId, title) => {
    const cl: Checklist = { id:nanoid(), title, items:[] }
    const tasks = get().tasks.map(t => t.id===taskId ? {...t,checklists:[...t.checklists,cl],updatedAt:new Date().toISOString()} : t)
    pProjects(get().projects,tasks); set({tasks})
  },
  removeChecklist: (taskId, clId) => {
    const tasks = get().tasks.map(t => t.id===taskId ? {...t,checklists:t.checklists.filter(c=>c.id!==clId),updatedAt:new Date().toISOString()} : t)
    pProjects(get().projects,tasks); set({tasks})
  },
  addChecklistItem: (taskId, clId, text) => {
    const item: ChecklistItem = { id:nanoid(), text, done:false }
    const tasks = get().tasks.map(t => t.id!==taskId ? t : { ...t, updatedAt:new Date().toISOString(), checklists:t.checklists.map(c => c.id!==clId ? c : {...c,items:[...c.items,item]}) })
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

  // ── Automations ───────────────────────────────────────────────────────
  addAutomation: (a) => {
    const automation: Automation = { ...a, id:nanoid(), createdAt:new Date().toISOString() }
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
      .filter(a => a.enabled && a.trigger.type===triggerType && (a.projectId===task.projectId || a.projectId==='*'))
      .forEach(a => {
        if (a.action.type==='change_status')   updateTask(taskId, { status:   a.action.value as TaskStatus })
        if (a.action.type==='change_priority') updateTask(taskId, { priority: a.action.value as Priority  })
        if (a.action.type==='assign')          updateTask(taskId, { assignee: a.action.value as string    })
      })
  },

  getAllTags:   () => [...new Set(get().tasks.flatMap(t => t.tags))].sort(),
  getSubtasks: (parentId) => get().tasks.filter(t => t.parentId===parentId),
  filteredTasks: (tasks) => {
    const f = get().filters
    return tasks.filter(t => {
      if (f.status   !== 'all' && t.status   !== f.status)   return false
      if (f.priority !== 'all' && t.priority !== f.priority) return false
      if (f.assignee && !t.assignee.toLowerCase().includes(f.assignee.toLowerCase())) return false
      if (f.tags.length > 0 && !f.tags.every(tag => t.tags.includes(tag))) return false
      if (f.dueBefore && t.dueDate && t.dueDate > f.dueBefore) return false
      if (f.dueAfter  && t.dueDate && t.dueDate < f.dueAfter)  return false
      return true
    })
  },

  init: () => {
    const rawProjects = localProjects.getAll() as unknown as Record<string, unknown>[]
    const projects    = rawProjects.map(migrateProject)
    const tasks       = (localTasks.getAll() as unknown as Record<string,unknown>[]).map(migrateTask)
    const spaces      = loadJSON<Space[]>(SPACES_KEY, [])
    const folders     = loadJSON<Folder[]>(FOLDERS_KEY, [])
    const automations = loadJSON<Automation[]>(AUTOMATIONS_KEY, [])
    const inboxColumns= loadJSON<ColumnDef[]>(INBOX_COLS_KEY, [])
    if (projects.length===0) {
      const seeded = SEED_PROJECTS.map(p => ({ ...p, folderId:null, taskOpenMode:'side' as const, customViews:[] }))
      const seededTasks = SEED_TASKS.map(t => ({ ...t, taskType:'task' as const }))
      pProjects(seeded as any, seededTasks as any)
      set({ projects: seeded as any, tasks: seededTasks as any, spaces, folders, automations, inboxColumns })
    } else {
      set({ projects, tasks, spaces, folders, automations, inboxColumns })
    }
  },
}))
