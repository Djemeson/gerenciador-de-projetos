import React, { useState } from 'react'
import { Target, ChevronLeft, Archive, Trash2, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetail } from '../components/tasks/TaskDetail'
import { gutTier } from '../types'

type SortBy = 'status' | 'priority' | 'dueDate'

export function ProjectDetailView() {
  const { activeProjectId, projects, tasks, selectedTaskId, openGUT, setView, archiveProject, deleteProject } = useAppStore()
  const [sortBy, setSortBy]       = useState<SortBy>('status')
  const [confirmDel, setConfirmDel] = useState(false)

  const project = projects.find(p => p.id === activeProjectId)
  if (!project) return null

  const projectTasks = tasks.filter(t => t.projectId === project.id)
  const rootTasks    = projectTasks.filter(t => !t.parentId)
  const done  = rootTasks.filter(t => t.status === 'done').length
  const total = rootTasks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const tier  = gutTier(project.gut.score)

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setView('projects')} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="w-3 h-3 rounded-full" style={{ background: project.color }} />
            <h1 className="text-sm font-semibold text-gray-900 flex-1">{project.name}</h1>

            {/* Archive */}
            <button onClick={() => { archiveProject(project.id); setView('projects') }}
              className="flex items-center gap-1 text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
              <Archive size={12} /> Arquivar
            </button>

            {/* Delete with confirm */}
            {confirmDel ? (
              <button onClick={() => { deleteProject(project.id); setView('projects') }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-red-500 text-white rounded-lg animate-pulse">
                <AlertTriangle size={12} /> Confirmar exclusão
              </button>
            ) : (
              <button onClick={() => { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000) }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={12} /> Deletar
              </button>
            )}

            <button onClick={() => openGUT(project.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors hover:border-gray-300"
              style={{ background: tier.bg, color: tier.color, borderColor: tier.color + '33' }}>
              <Target size={11} /> GUT {project.gut.score} — {tier.label}
            </button>

            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {(['status','priority','dueDate'] as SortBy[]).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${sortBy === s ? 'bg-white text-gray-800 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {{ status:'Status', priority:'Prioridade', dueDate:'Prazo' }[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background: project.color }} />
            </div>
            <span className="text-xs text-gray-400">{done}/{total} · {pct}%</span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-[11px] text-gray-400">
            <span>G·Gravidade <strong className="text-gray-600">{project.gut.g}</strong></span>
            <span>U·Urgência <strong className="text-gray-600">{project.gut.u}</strong></span>
            <span>T·Tendência <strong className="text-gray-600">{project.gut.t}</strong></span>
          </div>
        </div>

        <TaskList tasks={projectTasks} projectId={project.id} sortBy={sortBy} />
      </div>
      {selectedTaskId && <TaskDetail />}
    </div>
  )
}
