import React, { useState } from 'react'
import { Layers, Plus } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskPanel } from '../components/tasks/TaskPanel'
import { Select } from '../components/ui/Select'
import { INBOX_PROJECT_ID } from '../types'

export function AllTasksView() {
  const { tasks, projects: allProjects, activeWorkspaceId, openQuickCapture } = useAppStore()
  const [filterProject, setFilterProject] = useState<string>('all')

  const projects = allProjects.filter(p => p.workspaceId === activeWorkspaceId)

  const filtered = tasks.filter(t =>
    t.workspaceId === activeWorkspaceId &&
    t.projectId !== INBOX_PROJECT_ID &&
    (filterProject === 'all' || t.projectId === filterProject)
  )

  const defaultProject = filterProject !== 'all' ? filterProject : projects[0]?.id

  const headerRight = (
    <>
      <Select value={filterProject} onChange={setFilterProject} align="right" ariaLabel="Filtrar por projeto"
        options={[{ value:'all', label:'Todos os projetos' }, ...projects.map(p => ({ value:p.id, label:p.name, color:p.color }))]}/>
      <button onClick={openQuickCapture}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-brand-600/30 transition-colors flex-shrink-0">
        <Plus size={13}/> Nova tarefa
      </button>
    </>
  )

  return (
    <TaskPanel
      scopeKey="alltasks"
      tasks={filtered}
      title="Todas as tarefas"
      icon={<Layers size={15} className="text-gray-400 flex-shrink-0" />}
      headerRight={headerRight}
      showProject
      defaultProjectId={defaultProject}
      groupOptions={['status','priority','dueDate','assignee','project']}
      views={['overview','list','board','table','calendar','dashboard']}
      defaultView="list"
    />
  )
}
