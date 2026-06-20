import React, { useState } from 'react'
import { Search, Layers } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskPanel } from '../components/tasks/TaskPanel'
import { INBOX_PROJECT_ID } from '../types'

export function AllTasksView() {
  const { tasks, projects } = useAppStore()
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')

  const filtered = tasks.filter(t =>
    t.projectId !== INBOX_PROJECT_ID &&
    (filterProject === 'all' || t.projectId === filterProject) &&
    (search === '' || t.title.toLowerCase().includes(search.toLowerCase()))
  )

  const defaultProject = filterProject !== 'all' ? filterProject : projects[0]?.id

  const headerRight = (
    <>
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
          className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 transition-all w-40" />
      </div>
      <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
        className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 outline-none cursor-pointer">
        <option value="all">Todos os projetos</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
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
