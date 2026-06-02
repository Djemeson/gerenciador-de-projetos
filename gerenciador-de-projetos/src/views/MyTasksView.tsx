import React, { useState } from 'react'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetail } from '../components/tasks/TaskDetail'
import { Button } from '../components/ui'

type SortBy = 'status' | 'priority' | 'dueDate'

export function MyTasksView() {
  const { tasks, selectedTaskId, openNewTask } = useAppStore()
  const [sortBy, setSortBy] = useState<SortBy>('status')
  const [search, setSearch] = useState('')

  const filtered = tasks.filter(t =>
    t.assignee === 'DJ' &&
    (search === '' || t.title.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white">
          <h1 className="text-sm font-semibold text-gray-900 flex-1">Minhas tarefas</h1>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 transition-all w-44"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['status', 'priority', 'dueDate'] as SortBy[]).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors
                  ${sortBy === s ? 'bg-white text-gray-800 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {{ status: 'Status', priority: 'Prioridade', dueDate: 'Prazo' }[s]}
              </button>
            ))}
          </div>

          <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => openNewTask()}>
            Tarefa
          </Button>
        </div>

        <TaskList tasks={filtered} sortBy={sortBy} />
      </div>

      {selectedTaskId && <TaskDetail />}
    </div>
  )
}
