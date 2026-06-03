import React, { useState } from 'react'
import { Plus, Target, BarChart2, Archive, Trash2, ArchiveRestore, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { gutTier } from '../types'
import { Button } from '../components/ui'

export function ProjectsListView() {
  const { projects, tasks, openNewProject, openGUT, setView, deleteProject, archiveProject, unarchiveProject } = useAppStore()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showArchived,  setShowArchived]  = useState(false)

  const active   = [...projects].filter(p => !p.archived).sort((a,b) => b.gut.score - a.gut.score)
  const archived = projects.filter(p => p.archived)

  const projectStats = (id: string) => {
    const pt = tasks.filter(t => t.projectId === id && !t.parentId)
    return {
      total:   pt.length,
      done:    pt.filter(t => t.status === 'done').length,
      active:  pt.filter(t => t.status !== 'done').length,
      overdue: pt.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date()).length,
    }
  }

  const handleDelete = (id: string) => {
    if (confirmDelete === id) { deleteProject(id); setConfirmDelete(null) }
    else { setConfirmDelete(id); setTimeout(() => setConfirmDelete(c => c === id ? null : c), 3000) }
  }

  const ProjectCard = ({ p, isArchived = false }: { p: typeof projects[0]; isArchived?: boolean }) => {
    const tier  = gutTier(p.gut.score)
    const stats = projectStats(p.id)
    const pct   = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
    const isConfirming = confirmDelete === p.id

    return (
      <div className={`bg-white border rounded-xl p-4 transition-colors ${isArchived ? 'opacity-60 border-gray-100' : 'border-gray-200 hover:border-gray-300'}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <button onClick={() => !isArchived && setView('project_detail', p.id)}
                className={`text-sm font-medium truncate ${isArchived ? 'text-gray-500 cursor-default' : 'text-gray-900 hover:text-brand-600 transition-colors'}`}>
                {p.name}
              </button>
              {isArchived && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Arquivado</span>}
            </div>
            {p.description && <p className="text-xs text-gray-500 mb-2 line-clamp-1">{p.description}</p>}

            {!isArchived && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${pct}%`, background: p.color }} />
                  </div>
                  <span className="text-[11px] text-gray-400">{pct}%</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <span>{stats.active} ativas</span>
                  <span>{stats.done} concluídas</span>
                  {stats.overdue > 0 && <span className="text-red-500">{stats.overdue} atrasadas</span>}
                </div>
              </>
            )}
          </div>

          {/* GUT + actions */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {!isArchived && (
              <>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: tier.bg, color: tier.color }}>
                  {tier.label}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-semibold" style={{ color: tier.color }}>{p.gut.score}</span>
                  <span className="text-[10px] text-gray-400">G{p.gut.g}·U{p.gut.u}·T{p.gut.t}</span>
                </div>
                <button onClick={() => openGUT(p.id)} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-600 transition-colors">
                  <Target size={11} /> Editar GUT
                </button>
              </>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-1 mt-1">
              {isArchived ? (
                <button onClick={() => unarchiveProject(p.id)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  <ArchiveRestore size={11} /> Restaurar
                </button>
              ) : (
                <button onClick={() => archiveProject(p.id)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
                  <Archive size={11} /> Arquivar
                </button>
              )}

              {isConfirming ? (
                <button onClick={() => handleDelete(p.id)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 bg-red-500 text-white rounded-lg transition-colors animate-pulse">
                  <AlertTriangle size={11} /> Confirmar
                </button>
              ) : (
                <button onClick={() => handleDelete(p.id)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 size={11} /> Deletar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
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

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* GUT legend */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400">Prioridade GUT:</span>
          {[{ label:'Crítico ≥80', color:'#993C1D', bg:'#FAECE7' },{ label:'Alto 40–79', color:'#854F0B', bg:'#FAEEDA' },{ label:'Médio 15–39', color:'#185FA5', bg:'#E6F1FB' },{ label:'Baixo <15', color:'#0F6E56', bg:'#E1F5EE' }].map(t => (
            <span key={t.label} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: t.bg, color: t.color }}>{t.label}</span>
          ))}
        </div>

        {/* Active projects */}
        <div className="space-y-2">
          {active.map((p, idx) => (
            <div key={p.id} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[11px] text-gray-500 font-medium flex-shrink-0 mt-4">{idx + 1}</div>
              <div className="flex-1"><ProjectCard p={p} /></div>
            </div>
          ))}
          {active.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum projeto ativo. <button onClick={openNewProject} className="text-brand-600 hover:underline">Criar um</button></p>
          )}
        </div>

        {/* Archived section */}
        {archived.length > 0 && (
          <div>
            <button onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors mb-3">
              {showArchived ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Archive size={13} />
              Arquivados ({archived.length})
            </button>
            {showArchived && (
              <div className="space-y-2">
                {archived.map(p => (
                  <div key={p.id}><ProjectCard p={p} isArchived /></div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
