import React from 'react'
import { Plus, Target, BarChart2 } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { gutTier } from '../types'
import { Button } from '../components/ui'

export function ProjectsListView() {
  const { projects, tasks, openNewProject, openGUT, setView } = useAppStore()

  const sorted = [...projects].sort((a, b) => b.gut.score - a.gut.score)

  const projectStats = (id: string) => {
    const pt = tasks.filter(t => t.projectId === id)
    return {
      total:    pt.length,
      done:     pt.filter(t => t.status === 'done').length,
      active:   pt.filter(t => t.status !== 'done').length,
      overdue:  pt.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date()).length,
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white">
        <BarChart2 size={15} className="text-gray-400" />
        <h1 className="text-sm font-semibold text-gray-900 flex-1">Projetos</h1>
        <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={openNewProject}>
          Novo projeto
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* GUT legend */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <span className="text-xs text-gray-400">Prioridade GUT:</span>
          {[
            { label: 'Crítico ≥80',  color: '#993C1D', bg: '#FAECE7' },
            { label: 'Alto 40–79',   color: '#854F0B', bg: '#FAEEDA' },
            { label: 'Médio 15–39',  color: '#185FA5', bg: '#E6F1FB' },
            { label: 'Baixo <15',    color: '#0F6E56', bg: '#E1F5EE' },
          ].map(t => (
            <span key={t.label} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: t.bg, color: t.color }}>
              {t.label}
            </span>
          ))}
        </div>

        <div className="space-y-2">
          {sorted.map((project, idx) => {
            const tier  = gutTier(project.gut.score)
            const stats = projectStats(project.id)
            const pct   = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

            return (
              <div
                key={project.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Rank */}
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[11px] text-gray-500 font-medium flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </div>

                  {/* Color dot + info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: project.color }} />
                      <button
                        onClick={() => setView('project_detail', project.id)}
                        className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors truncate"
                      >
                        {project.name}
                      </button>
                    </div>
                    {project.description && (
                      <p className="text-xs text-gray-500 mb-2 line-clamp-1">{project.description}</p>
                    )}

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: project.color }} />
                      </div>
                      <span className="text-[11px] text-gray-400">{pct}%</span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                      <span>{stats.active} ativas</span>
                      <span>{stats.done} concluídas</span>
                      {stats.overdue > 0 && (
                        <span className="text-red-500">{stats.overdue} em atraso</span>
                      )}
                    </div>
                  </div>

                  {/* GUT score */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: tier.bg, color: tier.color }}
                    >
                      {tier.label}
                    </span>
                    <div className="text-right">
                      <p className="text-xl font-semibold" style={{ color: tier.color }}>{project.gut.score}</p>
                      <p className="text-[10px] text-gray-400">G{project.gut.g}·U{project.gut.u}·T{project.gut.t}</p>
                    </div>
                    <button
                      onClick={() => openGUT(project.id)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-600 transition-colors"
                    >
                      <Target size={11} /> Editar GUT
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
