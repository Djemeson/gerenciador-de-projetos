import React, { useState } from 'react'
import { Search, CheckSquare } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskPanel } from '../components/tasks/TaskPanel'
import { INBOX_PROJECT_ID } from '../types'

export function MyTasksView() {
  const { tasks, projects } = useAppStore()
  const [search, setSearch] = useState('')

  const filtered = tasks.filter(t =>
    t.assignee === 'DJ' &&
    t.projectId !== INBOX_PROJECT_ID &&
    (search === '' || t.title.toLowerCase().includes(search.toLowerCase()))
  )

  const headerRight = (
    <div className="relative">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
        className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 transition-all w-44" />
    </div>
  )

  return (
    <TaskPanel
      scopeKey="mytasks"
      tasks={filtered}
      title="Minhas tarefas"
      icon={<CheckSquare size={15} className="text-brand-500 flex-shrink-0" />}
      headerRight={headerRight}
      showProject
      defaultProjectId={projects[0]?.id}
      groupOptions={['status','priority','dueDate','project']}
      views={['overview','list','board','table','calendar','dashboard']}
      defaultView="list"
    />
  )
}
