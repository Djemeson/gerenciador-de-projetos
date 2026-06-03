import { create } from 'zustand'
import { nanoid } from '../lib/nanoid'
import { localProjects, localTasks } from '../lib/localStore'
import { SEED_PROJECTS, SEED_TASKS } from '../lib/seed'
import type {
  Project, Task, View, TaskStatus, Priority, GUT,
  Checklist, ChecklistItem, Attachment,
} from '../types'
import { calcGUT, migrateTask } from '../types'

interface AppState {
  projects: Project[]
  tasks: Task[]

  activeView: View
  activeProjectId: string | null
  selectedTaskId: string | null
  searchQuery: string

  newProjectModal: boolean
  gutModal: { open: boolean; projectId: string | null }

  // Actions — nav
  setView: (view: View, projectId?: string) => void
  setSelectedTask: (id: string | null) => void
  setSearchQuery: (q: string) => void

  // Actions — modals
  openNewProject:  () => void
  closeNewProject: () => void
  openGUT:         (projectId: string) => void
  closeGUT:        () => void

  // Actions — projects
  addProject:    (name: string, color: string, description: string) => void
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  saveGUT:       (projectId: string, g: number, u: number, t: number) => void

  // Actions — tasks
  addTask:       (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task
  quickAddTask:  (title: string, projectId: string, status: TaskStatus, parentId?: string) => Task
  updateTask:    (id: string, patch: Partial<Task>) => void
  deleteTask:    (id: string) => void

  // Actions — checklists
  addChecklist:        (taskId: string, title: string) => void
  removeChecklist:     (taskId: string, checklistId: string) => void
  addChecklistItem:    (taskId: string, checklistId: string, text: string) => void
  toggleChecklistItem: (taskId: string, checklistId: string, itemId: string) => void
  removeChecklistItem: (taskId: string, checklistId: string, itemId: string) => void

  // Actions — attachments
  addAttachment:    (taskId: string, attachment: Omit<Attachment, 'id'>) => void
  removeAttachment: (taskId: string, attachmentId: string) => void

  // Helpers
  getAllTags: () => string[]
  getSubtasks: (parentId: string) => Task[]

  init: () => void
}

function persist(projects: Project[], tasks: Task[]) {
  localProjects.set(projects)
  localTasks.set(tasks)
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  tasks: [],
  activeView: 'my_tasks',
  activeProjectId: null,
  selectedTaskId: null,
  searchQuery: '',
  newProjectModal: false,
  gutModal: { open: false, projectId: null },

  setView: (view, projectId) => set({ activeView: view, activeProjectId: projectId ?? null, selectedTaskId: null }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  openNewProject:  () => set({ newProjectModal: true }),
  closeNewProject: () => set({ newProjectModal: false }),
  openGUT:         (projectId) => set({ gutModal: { open: true, projectId } }),
  closeGUT:        () => set({ gutModal: { open: false, projectId: null } }),

  addProject: (name, color, description) => {
    const project: Project = {
      id: nanoid(), name, color, description,
      gut: calcGUT(1, 1, 1),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const projects = [...get().projects, project]
    persist(projects, get().tasks)
    set({ projects })
  },

  updateProject: (id, patch) => {
    const projects = get().projects.map(p =>
      p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
    )
    persist(projects, get().tasks)
    set({ projects })
  },

  deleteProject: (id) => {
    const projects = get().projects.filter(p => p.id !== id)
    const tasks    = get().tasks.filter(t => t.projectId !== id)
    persist(projects, tasks)
    set({ projects, tasks })
  },

  saveGUT: (projectId, g, u, t) => {
    const gut = calcGUT(g, u, t)
    const projects = get().projects.map(p =>
      p.id === projectId ? { ...p, gut, updatedAt: new Date().toISOString() } : p
    )
    persist(projects, get().tasks)
    set({ projects })
  },

  addTask: (task) => {
    const newTask: Task = {
      ...task,
      id: nanoid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const tasks = [...get().tasks, newTask]
    persist(get().projects, tasks)
    set({ tasks })
    return newTask
  },

  quickAddTask: (title, projectId, status, parentId) => {
    const newTask: Task = {
      id: nanoid(),
      projectId,
      parentId: parentId ?? null,
      title: title.trim(),
      description: '',
      content: '',
      attachments: [],
      status,
      priority: 'medium',
      dueDate: null,
      assignee: 'DJ',
      tags: [],
      checklists: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const tasks = [...get().tasks, newTask]
    persist(get().projects, tasks)
    set({ tasks })
    return newTask
  },

  updateTask: (id, patch) => {
    const tasks = get().tasks.map(t =>
      t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
    )
    persist(get().projects, tasks)
    set({ tasks })
  },

  deleteTask: (id) => {
    // Remove tarefa e suas subtarefas recursivamente
    const toDelete = new Set<string>()
    const collect = (tid: string) => {
      toDelete.add(tid)
      get().tasks.filter(t => t.parentId === tid).forEach(t => collect(t.id))
    }
    collect(id)
    const tasks = get().tasks.filter(t => !toDelete.has(t.id))
    persist(get().projects, tasks)
    set({ tasks, selectedTaskId: toDelete.has(get().selectedTaskId ?? '') ? null : get().selectedTaskId })
  },

  addChecklist: (taskId, title) => {
    const checklist: Checklist = { id: nanoid(), title, items: [] }
    const tasks = get().tasks.map(t =>
      t.id === taskId ? { ...t, checklists: [...t.checklists, checklist], updatedAt: new Date().toISOString() } : t
    )
    persist(get().projects, tasks)
    set({ tasks })
  },

  removeChecklist: (taskId, checklistId) => {
    const tasks = get().tasks.map(t =>
      t.id === taskId ? { ...t, checklists: t.checklists.filter(c => c.id !== checklistId), updatedAt: new Date().toISOString() } : t
    )
    persist(get().projects, tasks)
    set({ tasks })
  },

  addChecklistItem: (taskId, checklistId, text) => {
    const item: ChecklistItem = { id: nanoid(), text, done: false }
    const tasks = get().tasks.map(t =>
      t.id !== taskId ? t : {
        ...t,
        updatedAt: new Date().toISOString(),
        checklists: t.checklists.map(c =>
          c.id !== checklistId ? c : { ...c, items: [...c.items, item] }
        ),
      }
    )
    persist(get().projects, tasks)
    set({ tasks })
  },

  toggleChecklistItem: (taskId, checklistId, itemId) => {
    const tasks = get().tasks.map(t =>
      t.id !== taskId ? t : {
        ...t,
        updatedAt: new Date().toISOString(),
        checklists: t.checklists.map(c =>
          c.id !== checklistId ? c : {
            ...c,
            items: c.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i),
          }
        ),
      }
    )
    persist(get().projects, tasks)
    set({ tasks })
  },

  removeChecklistItem: (taskId, checklistId, itemId) => {
    const tasks = get().tasks.map(t =>
      t.id !== taskId ? t : {
        ...t,
        updatedAt: new Date().toISOString(),
        checklists: t.checklists.map(c =>
          c.id !== checklistId ? c : { ...c, items: c.items.filter(i => i.id !== itemId) }
        ),
      }
    )
    persist(get().projects, tasks)
    set({ tasks })
  },

  addAttachment: (taskId, attachment) => {
    const att: Attachment = { ...attachment, id: nanoid() }
    const tasks = get().tasks.map(t =>
      t.id === taskId ? { ...t, attachments: [...t.attachments, att], updatedAt: new Date().toISOString() } : t
    )
    persist(get().projects, tasks)
    set({ tasks })
  },

  removeAttachment: (taskId, attachmentId) => {
    const tasks = get().tasks.map(t =>
      t.id === taskId ? { ...t, attachments: t.attachments.filter(a => a.id !== attachmentId), updatedAt: new Date().toISOString() } : t
    )
    persist(get().projects, tasks)
    set({ tasks })
  },

  getAllTags: () => {
    const all = get().tasks.flatMap(t => t.tags)
    return [...new Set(all)].sort()
  },

  getSubtasks: (parentId) => get().tasks.filter(t => t.parentId === parentId),

  init: () => {
    let projects = localProjects.getAll()
    let tasks    = localTasks.getAll().map(migrateTask)
    if (projects.length === 0) {
      projects = SEED_PROJECTS
      tasks    = SEED_TASKS
      persist(projects, tasks)
    }
    set({ projects, tasks })
  },
}))
