import React, { useState } from 'react'
import { Search, Layers } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetail } from '../components/tasks/TaskDetail'
import { gutTier } from '../types'

type SortBy = 'status' | 'priority' | 'project' | 'dueDate'

export function AllTasksView() {
  const { tasks, projects, selectedTaskId } = useAppStore()
  const [sortBy, setSortBy]           = useState<SortBy>('priority')
  const [search, setSearch]           = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')

  const filtered = tasks.filter(t =>
    (filterProject === 'all' || t.projectId === filterProject) &&
    (search === '' || t.title.toLowerCase().includes(search.toLowerCase()))
  )

  const total   = filtered.filter(t => t.status !== 'done' && !t.parentId).length
  const urgent  = filtered.filter(t => t.priority === 'urgent' && t.status !== 'done' && !t.parentId).length
  const overdue = filtered.filter(t => t.dueDate && t.status !== 'done' && !t.parentId && new Date(t.dueDate) < new Date()).length

  const defaultProject = filterProject !== 'all' ? filterProject : projects[0]?.id ?? ''

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white flex-wrap">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-gray-400" />
            <h1 className="text-sm font-semibold text-gray-900">Todas as tarefas</h1>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />{total} ativas</span>
            {urgent > 0  && <span className="flex items-center gap-1 text-red-500"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{urgent} urgentes</span>}
            {overdue > 0 && <span className="flex items-center gap-1 text-orange-500"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />{overdue} em atraso</span>}
          </div>

          <div className="flex-1" />

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 transition-all w-44" />
          </div>

          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 outline-none cursor-pointer">
            <option value="all">Todos os projetos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {([['status','Status'],['priority','Prioridade'],['project','Projeto'],['dueDate','Prazo']] as [SortBy,string][]).map(([s, label]) => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${sortBy === s ? 'bg-white text-gray-800 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {filterProject === 'all' && sortBy === 'project' && (
          <div className="flex gap-2 px-5 py-2 overflow-x-auto scrollbar-none border-b border-gray-100 bg-gray-50/80">
            {[...projects].sort((a, b) => b.gut.score - a.gut.score).map(p => {
              const tier = gutTier(p.gut.score)
              return (
                <button key={p.id} onClick={() => setFilterProject(p.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors flex-shrink-0">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                  <span className="text-xs text-gray-700">{p.name}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: tier.bg, color: tier.color }}>
                    GUT {p.gut.score}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <TaskList tasks={filtered} projectId={defaultProject} showProject sortBy={sortBy} />
      </div>

      {selectedTaskId && <TaskDetail />}
    </div>
  )
}
