import React, { useState } from 'react'
import { Plus, Target, LayoutGrid, Archive, Trash2, ArchiveRestore, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { gutTier } from '../types'
import { Button } from '../components/ui'
import { ProjectIcon } from '../components/ui/EntityBadges'

export function ProjectsListView() {
  const { projects: allProjects, tasks, openNewProject, openAIProject, openGUT, setView, deleteProject, archiveProject, unarchiveProject, activeWorkspaceId } = useAppStore()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showArchived,  setShowArchived]  = useState(false)

  const projects = allProjects.filter(p => p.workspaceId === activeWorkspaceId)
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
      <div className={`group relative bg-white border rounded-2xl p-4 flex flex-col transition-all duration-200
        ${isArchived ? 'opacity-70 border-gray-100' : 'border-gray-200/70 hover:border-gray-300 hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.12)]'}`}>
        {/* Cabeçalho: ícone + nome + GUT */}
        <div className="flex items-start gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: p.color + '18' }}>
            <ProjectIcon project={p} size={18}/>
          </span>
          <div className="flex-1 min-w-0">
            <button onClick={() => !isArchived && setView('project_detail', p.id)}
              className={`block text-[13.5px] font-bold truncate text-left w-full ${isArchived ? 'text-gray-500 cursor-default' : 'text-gray-900 hover:text-brand-600 transition-colors'}`}>
              {p.name}
            </button>
            <p className="text-[11px] text-gray-400 truncate">{p.description || 'Sem descrição'}</p>
          </div>
          {!isArchived && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0 tabnum"
              style={{ background: tier.bg, color: tier.color }} title={`GUT ${p.gut.score} · G${p.gut.g} U${p.gut.u} T${p.gut.t}`}>
              {p.gut.score}
            </span>
          )}
          {isArchived && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">Arquivado</span>}
        </div>

        {!isArchived && (
          <>
            {/* Progresso */}
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background: p.color }} />
              </div>
              <span className="text-[11px] font-bold text-gray-500 tabnum">{pct}%</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 mt-2 text-[11px] font-medium text-gray-400">
              <span><b className="text-gray-600 tabnum">{stats.active}</b> ativas</span>
              <span><b className="text-gray-600 tabnum">{stats.done}</b> feitas</span>
              {stats.overdue > 0 && <span className="text-red-500"><b className="tabnum">{stats.overdue}</b> atrasadas</span>}
            </div>
          </>
        )}

        {/* Ações (hover) */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
          {!isArchived && (
            <button onClick={() => openGUT(p.id)} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-brand-600 transition-colors">
              <Target size={12} /> GUT
            </button>
          )}
          <div className="flex-1"/>
          {isArchived ? (
            <button onClick={() => unarchiveProject(p.id)}
              className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
              <ArchiveRestore size={12} /> Restaurar
            </button>
          ) : (
            <button onClick={() => archiveProject(p.id)} title="Arquivar"
              className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors md:opacity-0 md:group-hover:opacity-100">
              <Archive size={13} />
            </button>
          )}
          {isConfirming ? (
            <button onClick={() => handleDelete(p.id)}
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 bg-red-500 text-white rounded-lg animate-pulse">
              Confirmar?
            </button>
          ) : (
            <button onClick={() => handleDelete(p.id)} title="Excluir"
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors md:opacity-0 md:group-hover:opacity-100">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 bg-white">
        <LayoutGrid size={16} className="text-gray-400" />
        <h1 className="text-[15px] font-extrabold text-gray-900 flex-1 tracking-tight">Projetos <span className="text-gray-300 font-bold">{active.length}</span></h1>
        <Button variant="default" size="sm" icon={<Sparkles size={13} className="text-brand-500"/>} onClick={() => openAIProject()}>
          Criar com IA
        </Button>
        <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => openNewProject()}>
          Novo projeto
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-gray-50/40">
        {/* GUT legend */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-[11px] font-semibold text-gray-400">Prioridade GUT:</span>
          {[{ label:'Crítico ≥80', color:'#993C1D', bg:'#FAECE7' },{ label:'Alto 40–79', color:'#854F0B', bg:'#FAEEDA' },{ label:'Médio 15–39', color:'#185FA5', bg:'#E6F1FB' },{ label:'Baixo <15', color:'#0F6E56', bg:'#E1F5EE' }].map(t => (
            <span key={t.label} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: t.bg, color: t.color }}>{t.label}</span>
          ))}
        </div>

        {/* Active projects — grid */}
        {active.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <LayoutGrid size={22} className="text-gray-300"/>
            </div>
            <p className="text-sm font-semibold text-gray-500">Nenhum projeto ativo</p>
            <button onClick={() => openNewProject()} className="text-xs text-brand-600 hover:underline mt-1">Criar o primeiro projeto</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {active.map(p => <ProjectCard key={p.id} p={p} />)}
          </div>
        )}

        {/* Archived section */}
        {archived.length > 0 && (
          <div className="mt-6">
            <button onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors mb-3">
              {showArchived ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Archive size={13} />
              Arquivados ({archived.length})
            </button>
            {showArchived && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {archived.map(p => <ProjectCard key={p.id} p={p} isArchived />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
