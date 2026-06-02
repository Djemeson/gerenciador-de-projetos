import React, { useState } from 'react'
import { Plus, Target, ChevronLeft } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetail } from '../components/tasks/TaskDetail'
import { Button } from '../components/ui'
import { gutTier } from '../types'

type SortBy = 'status' | 'priority' | 'dueDate'

export function ProjectDetailView() {
  const { activeProjectId, projects, tasks, selectedTaskId, openNewTask, openGUT, setView } = useAppStore()
  const [sortBy, setSortBy] = useState<SortBy>('status')

  const project = projects.find(p => p.id === activeProjectId)
  if (!project) return null

  const projectTasks = tasks.filter(t => t.projectId === project.id)
  const done  = projectTasks.filter(t => t.status === 'done').length
  const total = projectTasks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const tier  = gutTier(project.gut.score)

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setView('projects')}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="w-3 h-3 rounded-full" style={{ background: project.color }} />
            <h1 className="text-sm font-semibold text-gray-900 flex-1">{project.name}</h1>

            {/* GUT badge */}
            <button
              onClick={() => openGUT(project.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors hover:border-gray-300"
              style={{ background: tier.bg, color: tier.color, borderColor: tier.color + '33' }}
            >
              <Target size={11} />
              GUT {project.gut.score} — {tier.label}
            </button>

            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
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

            <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => openNewTask(project.id)}>
              Tarefa
            </Button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: project.color }} />
            </div>
            <span className="text-xs text-gray-400">{done}/{total} concluídas · {pct}%</span>
          </div>

          {/* GUT breakdown */}
          <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-400">
            <span>G·Gravidade <strong className="text-gray-600">{project.gut.g}</strong></span>
            <span>U·Urgência <strong className="text-gray-600">{project.gut.u}</strong></span>
            <span>T·Tendência <strong className="text-gray-600">{project.gut.t}</strong></span>
          </div>
        </div>

        <TaskList tasks={projectTasks} sortBy={sortBy} />
      </div>

      {selectedTaskId && <TaskDetail />}
    </div>
  )
}
