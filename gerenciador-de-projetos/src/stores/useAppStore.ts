import { create } from 'zustand'
import { nanoid } from '../lib/nanoid'
import { localProjects, localTasks } from '../lib/localStore'
import { SEED_PROJECTS, SEED_TASKS } from '../lib/seed'
import type { Project, Task, View, TaskStatus, Priority, Checklist, ChecklistItem, ContentBlock } from '../types'
import { calcGUT, migrateTask } from '../types'

interface AppState {
  projects: Project[]
  tasks:    Task[]
  activeView:       View
  activeProjectId:  string | null
  selectedTaskId:   string | null
  newProjectModal:  boolean
  gutModal:         { open: boolean; projectId: string | null }

  setView:         (view: View, projectId?: string) => void
  setSelectedTask: (id: string | null) => void
  openNewProject:  () => void
  closeNewProject: () => void
  openGUT:         (projectId: string) => void
  closeGUT:        () => void

  addProject:      (name: string, color: string, desc: string) => void
  updateProject:   (id: string, patch: Partial<Project>) => void
  deleteProject:   (id: string) => void
  archiveProject:  (id: string) => void
  unarchiveProject:(id: string) => void
  saveGUT:         (projectId: string, g: number, u: number, t: number) => void

  addTask:      (task: Omit<Task, 'id'|'createdAt'|'updatedAt'>) => Task
  quickAddTask: (title: string, projectId: string, status: TaskStatus, parentId?: string) => Task
  updateTask:   (id: string, patch: Partial<Task>) => void
  deleteTask:   (id: string) => void

  // Blocks
  updateBlocks: (taskId: string, blocks: ContentBlock[]) => void

  // Checklists
  addChecklist:        (taskId: string, title: string) => void
  removeChecklist:     (taskId: string, checklistId: string) => void
  addChecklistItem:    (taskId: string, checklistId: string, text: string) => void
  toggleChecklistItem: (taskId: string, checklistId: string, itemId: string) => void
  removeChecklistItem: (taskId: string, checklistId: string, itemId: string) => void

  getAllTags:   () => string[]
  getSubtasks: (parentId: string) => Task[]
  init:        () => void
}

function persist(projects: Project[], tasks: Task[]) {
  localProjects.set(projects)
  localTasks.set(tasks)
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [], tasks: [],
  activeView: 'my_tasks', activeProjectId: null, selectedTaskId: null,
  newProjectModal: false, gutModal: { open: false, projectId: null },

  setView:         (view, projectId) => set({ activeView: view, activeProjectId: projectId ?? null, selectedTaskId: null }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  openNewProject:  () => set({ newProjectModal: true }),
  closeNewProject: () => set({ newProjectModal: false }),
  openGUT:         (projectId) => set({ gutModal: { open: true, projectId } }),
  closeGUT:        () => set({ gutModal: { open: false, projectId: null } }),

  addProject: (name, color, description) => {
    const p: Project = { id: nanoid(), name, color, description, gut: calcGUT(1,1,1), archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const projects = [...get().projects, p]
    persist(projects, get().tasks); set({ projects })
  },
  updateProject: (id, patch) => {
    const projects = get().projects.map(p => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)
    persist(projects, get().tasks); set({ projects })
  },
  deleteProject: (id) => {
    const projects = get().projects.filter(p => p.id !== id)
    const tasks    = get().tasks.filter(t => t.projectId !== id)
    persist(projects, tasks); set({ projects, tasks })
  },
  archiveProject: (id) => {
    const projects = get().projects.map(p => p.id === id ? { ...p, archived: true, updatedAt: new Date().toISOString() } : p)
    persist(projects, get().tasks)
    set({ projects, activeView: get().activeProjectId === id ? 'projects' : get().activeView, activeProjectId: get().activeProjectId === id ? null : get().activeProjectId })
  },
  unarchiveProject: (id) => {
    const projects = get().projects.map(p => p.id === id ? { ...p, archived: false, updatedAt: new Date().toISOString() } : p)
    persist(projects, get().tasks); set({ projects })
  },
  saveGUT: (projectId, g, u, t) => {
    const gut = calcGUT(g, u, t)
    const projects = get().projects.map(p => p.id === projectId ? { ...p, gut, updatedAt: new Date().toISOString() } : p)
    persist(projects, get().tasks); set({ projects })
  },

  addTask: (task) => {
    const newTask: Task = { ...task, id: nanoid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const tasks = [...get().tasks, newTask]
    persist(get().projects, tasks); set({ tasks })
    return newTask
  },

  quickAddTask: (title, projectId, status, parentId) => {
    const newTask: Task = {
      id: nanoid(), projectId, parentId: parentId ?? null,
      title: title.trim(), description: '', blocks: [],
      status, priority: 'medium', dueDate: null,
      assignee: 'DJ', tags: [], checklists: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    const tasks = [...get().tasks, newTask]
    persist(get().projects, tasks); set({ tasks })
    return newTask
  },

  updateTask: (id, patch) => {
    const tasks = get().tasks.map(t => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)
    persist(get().projects, tasks); set({ tasks })
  },

  deleteTask: (id) => {
    const toDelete = new Set<string>()
    const collect = (tid: string) => { toDelete.add(tid); get().tasks.filter(t => t.parentId === tid).forEach(t => collect(t.id)) }
    collect(id)
    const tasks = get().tasks.filter(t => !toDelete.has(t.id))
    persist(get().projects, tasks)
    set({ tasks, selectedTaskId: toDelete.has(get().selectedTaskId ?? '') ? null : get().selectedTaskId })
  },

  updateBlocks: (taskId, blocks) => {
    const tasks = get().tasks.map(t => t.id === taskId ? { ...t, blocks, updatedAt: new Date().toISOString() } : t)
    persist(get().projects, tasks); set({ tasks })
  },

  addChecklist: (taskId, title) => {
    const cl: Checklist = { id: nanoid(), title, items: [] }
    const tasks = get().tasks.map(t => t.id === taskId ? { ...t, checklists: [...t.checklists, cl], updatedAt: new Date().toISOString() } : t)
    persist(get().projects, tasks); set({ tasks })
  },
  removeChecklist: (taskId, checklistId) => {
    const tasks = get().tasks.map(t => t.id === taskId ? { ...t, checklists: t.checklists.filter(c => c.id !== checklistId), updatedAt: new Date().toISOString() } : t)
    persist(get().projects, tasks); set({ tasks })
  },
  addChecklistItem: (taskId, checklistId, text) => {
    const item: ChecklistItem = { id: nanoid(), text, done: false }
    const tasks = get().tasks.map(t => t.id !== taskId ? t : { ...t, updatedAt: new Date().toISOString(), checklists: t.checklists.map(c => c.id !== checklistId ? c : { ...c, items: [...c.items, item] }) })
    persist(get().projects, tasks); set({ tasks })
  },
  toggleChecklistItem: (taskId, checklistId, itemId) => {
    const tasks = get().tasks.map(t => t.id !== taskId ? t : { ...t, updatedAt: new Date().toISOString(), checklists: t.checklists.map(c => c.id !== checklistId ? c : { ...c, items: c.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) }) })
    persist(get().projects, tasks); set({ tasks })
  },
  removeChecklistItem: (taskId, checklistId, itemId) => {
    const tasks = get().tasks.map(t => t.id !== taskId ? t : { ...t, updatedAt: new Date().toISOString(), checklists: t.checklists.map(c => c.id !== checklistId ? c : { ...c, items: c.items.filter(i => i.id !== itemId) }) })
    persist(get().projects, tasks); set({ tasks })
  },

  getAllTags:   () => [...new Set(get().tasks.flatMap(t => t.tags))].sort(),
  getSubtasks: (parentId) => get().tasks.filter(t => t.parentId === parentId),

  init: () => {
    let projects = localProjects.getAll().map(p => ({ ...p, archived: (p as any).archived ?? false }))
    let tasks    = (localTasks.getAll() as unknown as Record<string, unknown>[]).map(migrateTask)
    if (projects.length === 0) { projects = SEED_PROJECTS; tasks = SEED_TASKS; persist(projects, tasks) }
    set({ projects, tasks })
  },
}))
