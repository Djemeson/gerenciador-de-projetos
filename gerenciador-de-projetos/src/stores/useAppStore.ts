import { create } from 'zustand'
import { nanoid } from '../lib/nanoid'
import { localProjects, localTasks } from '../lib/localStore'
import { SEED_PROJECTS, SEED_TASKS } from '../lib/seed'
import type { Project, Task, View, TaskStatus, Priority, GUT } from '../types'
import { calcGUT } from '../types'

interface AppState {
  // Data
  projects: Project[]
  tasks: Task[]

  // UI state
  activeView: View
  activeProjectId: string | null
  selectedTaskId: string | null
  searchQuery: string
  taskFilter: { status: TaskStatus | 'all'; priority: Priority | 'all'; projectId: string | 'all' }

  // Modal state
  newTaskModal: { open: boolean; projectId?: string }
  newProjectModal: boolean
  gutModal: { open: boolean; projectId: string | null }

  // Actions — navigation
  setView: (view: View, projectId?: string) => void
  setSelectedTask: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setTaskFilter: (filter: Partial<AppState['taskFilter']>) => void

  // Actions — modals
  openNewTask:    (projectId?: string) => void
  closeNewTask:   () => void
  openNewProject: () => void
  closeNewProject:() => void
  openGUT:        (projectId: string) => void
  closeGUT:       () => void

  // Actions — CRUD
  addProject:    (name: string, color: string, description: string) => void
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  saveGUT:       (projectId: string, g: number, u: number, t: number) => void

  addTask:       (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTask:    (id: string, patch: Partial<Task>) => void
  deleteTask:    (id: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void

  // Init
  init: () => void
}

function persistProjects(projects: Project[]) { localProjects.set(projects) }
function persistTasks(tasks: Task[])           { localTasks.set(tasks) }

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  tasks: [],
  activeView: 'my_tasks',
  activeProjectId: null,
  selectedTaskId: null,
  searchQuery: '',
  taskFilter: { status: 'all', priority: 'all', projectId: 'all' },
  newTaskModal: { open: false },
  newProjectModal: false,
  gutModal: { open: false, projectId: null },

  setView: (view, projectId) => set({ activeView: view, activeProjectId: projectId ?? null, selectedTaskId: null }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setTaskFilter: (filter) => set(s => ({ taskFilter: { ...s.taskFilter, ...filter } })),

  openNewTask:     (projectId) => set({ newTaskModal: { open: true, projectId } }),
  closeNewTask:    ()          => set({ newTaskModal: { open: false } }),
  openNewProject:  ()          => set({ newProjectModal: true }),
  closeNewProject: ()          => set({ newProjectModal: false }),
  openGUT:         (projectId) => set({ gutModal: { open: true, projectId } }),
  closeGUT:        ()          => set({ gutModal: { open: false, projectId: null } }),

  addProject: (name, color, description) => {
    const project: Project = {
      id: nanoid(),
      name, color, description,
      gut: calcGUT(1, 1, 1),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const projects = [...get().projects, project]
    persistProjects(projects)
    set({ projects })
  },

  updateProject: (id, patch) => {
    const projects = get().projects.map(p => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)
    persistProjects(projects)
    set({ projects })
  },

  deleteProject: (id) => {
    const projects = get().projects.filter(p => p.id !== id)
    const tasks    = get().tasks.filter(t => t.projectId !== id)
    persistProjects(projects)
    persistTasks(tasks)
    set({ projects, tasks })
  },

  saveGUT: (projectId, g, u, t) => {
    const gut = calcGUT(g, u, t)
    const projects = get().projects.map(p =>
      p.id === projectId ? { ...p, gut, updatedAt: new Date().toISOString() } : p
    )
    persistProjects(projects)
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
    persistTasks(tasks)
    set({ tasks })
  },

  updateTask: (id, patch) => {
    const tasks = get().tasks.map(t => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)
    persistTasks(tasks)
    set({ tasks })
  },

  deleteTask: (id) => {
    const tasks = get().tasks.filter(t => t.id !== id)
    persistTasks(tasks)
    set({ tasks, selectedTaskId: get().selectedTaskId === id ? null : get().selectedTaskId })
  },

  toggleSubtask: (taskId, subtaskId) => {
    const tasks = get().tasks.map(t => {
      if (t.id !== taskId) return t
      return {
        ...t,
        updatedAt: new Date().toISOString(),
        subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s),
      }
    })
    persistTasks(tasks)
    set({ tasks })
  },

  init: () => {
    let projects = localProjects.getAll()
    let tasks    = localTasks.getAll()
    if (projects.length === 0) {
      projects = SEED_PROJECTS
      tasks    = SEED_TASKS
      persistProjects(projects)
      persistTasks(tasks)
    }
    set({ projects, tasks })
  },
}))
