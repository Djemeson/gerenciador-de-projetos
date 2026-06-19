import React from 'react'
import { ChevronLeft, Plus, FolderOpen } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskPanel } from '../components/tasks/TaskPanel'
import type { Space, Folder } from '../types'

function spaceBadge(s: Space) {
  return s.icon
    ? <span className="w-5 h-5 rounded-md flex items-center justify-center text-[13px] leading-none flex-shrink-0" style={{ background: `${s.color}26` }}>{s.icon}</span>
    : <span className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold text-white leading-none flex-shrink-0" style={{ background: s.color }}>{s.name.charAt(0).toUpperCase() || '#'}</span>
}

// ── Space ────────────────────────────────────────────────────────────────────
export function SpaceDetailView() {
  const { activeSpaceId, spaces, projects, tasks, openNewProject, setView } = useAppStore()
  const space = spaces.find(s => s.id === activeSpaceId)
  if (!space) return null

  const spaceProjects = projects.filter(p => p.spaceId === space.id && !p.archived)
  const ids = new Set(spaceProjects.map(p => p.id))
  const spaceTasks = tasks.filter(t => ids.has(t.projectId))

  const breadcrumb = (
    <div className="flex items-center gap-1 text-gray-400">
      <button onClick={() => setView('projects')} className="hover:text-gray-600 transition-colors"><ChevronLeft size={15}/></button>
      <span className="hover:text-gray-600 cursor-pointer" onClick={() => setView('projects')}>Espaços</span>
      <span className="text-gray-300 mx-0.5">/</span>
    </div>
  )

  const headerRight = (
    <button onClick={() => openNewProject(space.id)}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
      <Plus size={12}/> Novo projeto
    </button>
  )

  return (
    <TaskPanel
      key={'space:'+space.id}
      scopeKey={'space:'+space.id}
      tasks={spaceTasks}
      title={space.name}
      accent={space.color}
      icon={spaceBadge(space)}
      breadcrumb={breadcrumb}
      headerRight={headerRight}
      showProject
      defaultProjectId={spaceProjects[0]?.id}
      groupOptions={['status','priority','dueDate','assignee','project']}
      views={['overview','list','board','table','calendar','dashboard']}
      defaultView="list"
    />
  )
}

// ── Folder ───────────────────────────────────────────────────────────────────
export function FolderDetailView() {
  const { activeFolderId, folders, spaces, projects, tasks, openNewProject, setView, openSpace } = useAppStore()
  const folder = folders.find((f: Folder) => f.id === activeFolderId)
  if (!folder) return null
  const space = spaces.find(s => s.id === folder.spaceId)

  const folderProjects = projects.filter(p => p.folderId === folder.id && !p.archived)
  const ids = new Set(folderProjects.map(p => p.id))
  const folderTasks = tasks.filter(t => ids.has(t.projectId))

  const breadcrumb = (
    <div className="flex items-center gap-1 text-gray-400">
      <button onClick={() => setView('projects')} className="hover:text-gray-600 transition-colors"><ChevronLeft size={15}/></button>
      {space && <>
        <span className="hover:text-gray-600 cursor-pointer flex items-center gap-1" onClick={() => openSpace(space.id)}>
          {space.icon ?? null} {space.name}
        </span>
        <span className="text-gray-300 mx-0.5">/</span>
      </>}
    </div>
  )

  const icon = folder.icon
    ? <span className="text-[14px] leading-none flex-shrink-0">{folder.icon}</span>
    : <FolderOpen size={15} className="text-amber-400 flex-shrink-0"/>

  const headerRight = (
    <button onClick={() => openNewProject(folder.spaceId, folder.id)}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
      <Plus size={12}/> Novo projeto
    </button>
  )

  return (
    <TaskPanel
      key={'folder:'+folder.id}
      scopeKey={'folder:'+folder.id}
      tasks={folderTasks}
      title={folder.name}
      accent={space?.color ?? '#7B68EE'}
      icon={icon}
      breadcrumb={breadcrumb}
      headerRight={headerRight}
      showProject
      defaultProjectId={folderProjects[0]?.id}
      groupOptions={['status','priority','dueDate','assignee','project']}
      views={['overview','list','board','table','calendar','dashboard']}
      defaultView="list"
    />
  )
}
