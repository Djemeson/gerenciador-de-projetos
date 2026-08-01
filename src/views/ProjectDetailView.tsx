import React, { useMemo, useState } from 'react'
import {
  MoreHorizontal, Target, ChevronLeft, Archive, Trash2, AlertTriangle,
  SlidersHorizontal, Sparkles, Columns, Wand2,
} from 'lucide-react'
import { useAppStore, scopeKeyForProject } from '../stores/useAppStore'
import { TaskPanel } from '../components/tasks/TaskPanel'
import { ProjectIcon } from '../components/ui/EntityBadges'
import { gutTier } from '../types'

/**
 * Tela de um projeto.
 *
 * **Reescrita em 01/08/2026 para usar o `TaskPanel`.** Antes esta tela era uma cópia
 * paralela dele — 775 linhas com cabeçalho, abas, agrupamento e *seis* visualizações
 * (Overview, Board, Tabela, Calendário, Atividade, Painéis) reimplementadas, ao lado das
 * versões do painel. Duas consequências reais, que foram justamente as reclamações que
 * originaram esta entrega:
 *
 * - **Recurso que só chega em um lado.** O `SortControl` foi para o `TaskPanel`, então
 *   espaço e pasta ganharam classificação e projeto não. O agrupamento aqui oferecia três
 *   opções contra cinco do painel.
 * - **Comportamento que diverge em silêncio.** O `BoardView` do painel tem seleção múltipla
 *   e ações em lote; o daqui não tinha. O mesmo "Board" fazia coisas diferentes conforme a
 *   tela em que era aberto.
 *
 * O que sobra aqui é o que é **do projeto**, não da lista de tarefas: a barra de ações
 * (filtros, campos personalizados, IA, GUT, arquivar, excluir) e o modo de abertura da
 * tarefa. Tudo o mais é o painel — e passa a ser corrigido em um lugar só.
 */
export function ProjectDetailView() {
  const {
    activeProjectId, projects, tasks, setView,
    archiveProject, deleteProject, setTaskOpenMode,
    openColumnsModal, openEnrichProject, openGUT,
    filterPanelOpen, toggleFilterPanel, aiPanelOpen, toggleAIPanel,
  } = useAppStore()

  const [confirmDel, setConfirmDel] = useState(false)
  const [moreOpen,   setMoreOpen]   = useState(false)

  const project = projects.find(p => p.id === activeProjectId)
  const projectTasks = useMemo(
    () => tasks.filter(t => t.projectId === activeProjectId),
    [tasks, activeProjectId],
  )
  if (!project) return null

  const scopeKey = scopeKeyForProject(project.id)
  const tier     = gutTier(project.gut.score)
  // 'side' era um modo antigo; hoje o painel abre centralizado ou em tela cheia.
  const openMode = (project.taskOpenMode === 'side' ? 'center' : project.taskOpenMode) ?? 'center'

  const barraDoProjeto = (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button onClick={toggleFilterPanel} title="Filtros"
        className={`p-1.5 rounded-lg transition-colors ${filterPanelOpen ? 'bg-brand-100 text-brand-600' : 'text-gray-400 hover:bg-gray-100'}`}>
        <SlidersHorizontal size={14}/>
      </button>
      <button onClick={() => openColumnsModal(project.id, scopeKey)} title="Campos personalizados"
        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
        <Columns size={14}/>
      </button>
      <button onClick={toggleAIPanel} title="Pergunte à IA"
        className={`p-1.5 rounded-lg transition-colors ${aiPanelOpen ? 'bg-brand-100 text-brand-600' : 'text-gray-400 hover:bg-gray-100'}`}>
        <Sparkles size={14}/>
      </button>
      <button onClick={() => openEnrichProject(project.id)} title="Enriquecer projeto com IA"
        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-600 transition-colors">
        <Wand2 size={14}/>
      </button>

      {/* Separador: os quatro acima são ferramentas de tela; o que vem depois age sobre o
          projeto. Sem essa divisão eram nove alvos numa fileira só. */}
      <span className="w-px h-5 bg-gray-200 mx-1" />

      <button onClick={() => openGUT(project.id)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-colors hover:border-gray-300"
        style={{ background: tier.bg, color: tier.color, borderColor: tier.color + '33' }}>
        <Target size={12}/> GUT {project.gut.score}
      </button>
      <button onClick={() => { archiveProject(project.id); setView('projects') }}
        className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
        <Archive size={12}/> Arquivar
      </button>

      {/* Excluir fica no menu: era o elemento mais chamativo do cabeçalho sendo a única
          ação irreversível da tela. */}
      <div className="relative">
        <button onClick={() => setMoreOpen(v => !v)} title="Mais ações"
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <MoreHorizontal size={14}/>
        </button>
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setMoreOpen(false); setConfirmDel(false) }} />
            <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1 animate-scale-in">
              {confirmDel ? (
                <button onClick={() => { deleteProject(project.id); setView('projects') }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-danger-600 hover:bg-danger-50 transition-colors">
                  <AlertTriangle size={14}/> Confirmar exclusão
                </button>
              ) : (
                <button onClick={() => setConfirmDel(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors">
                  <Trash2 size={14} className="text-gray-400"/> Excluir projeto
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )

  const trilha = (
    <span className="flex items-center gap-1">
      <button onClick={() => setView('projects')} title="Voltar para Projetos"
        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
        <ChevronLeft size={16}/>
      </button>
      <button onClick={() => setView('projects')}
        className="text-gray-500 hover:text-gray-700 transition-colors">Projetos</button>
      <span className="text-gray-400 mx-0.5">/</span>
    </span>
  )

  return (
    <TaskPanel
      scopeKey={scopeKey}
      tasks={projectTasks}
      title={project.name}
      accent={project.color}
      icon={<ProjectIcon project={project} size={16}/>}
      breadcrumb={trilha}
      headerRight={barraDoProjeto}
      columns={project.columns}
      defaultProjectId={project.id}
      // A visualização passa a viver em `viewPrefs` (sincronizado, por escopo). O
      // `project.activeView` antigo entra como **padrão inicial**, para quem já tinha uma
      // escolhida não cair no "Tarefas" na primeira abertura.
      defaultView={project.activeView ?? 'list'}
      gut={project.gut}
      taskOpenMode={openMode}
      onChangeTaskOpenMode={mode => setTaskOpenMode(project.id, mode)}
    />
  )
}
