import React, { useMemo, useState } from 'react'
import {
  Plus, Target, LayoutGrid, Archive, Trash2, ArchiveRestore, ChevronDown, ChevronRight,
  Sparkles, Search, MoreHorizontal, List, AlertTriangle, PauseCircle, CheckCircle2,
  TrendingUp, Calendar, Layers, AlertCircle,
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { gutTier } from '../types'
import type { Project } from '../types'
import { Button } from '../components/ui'
import { Select } from '../components/ui/Select'
import { ProjectIcon } from '../components/ui/EntityBadges'
import { parseISO } from '../lib/dateFilter'
import {
  projectHealth, projectsSummary, groupBySpace, sortProjects,
  PROJECT_STATUS_META, PROJECT_IDLE_DAYS,
  type ProjectHealth, type ProjectSort, type ProjectStatus,
} from '../lib/projectMetrics'

/**
 * Lista de projetos.
 *
 * Reformulada em 29/07/2026. Dois furos de produto guiaram a mudança:
 *
 * 1. **A hierarquia era ignorada.** O app organiza tudo em Espaço → Pasta → Projeto
 *    (seção 2, "inquebrável") e esta tela era uma grade plana: com 20 projetos em 4
 *    espaços não havia contexto nem forma de achar nada. Agora agrupa por Espaço › Pasta,
 *    com busca, filtro e ordenação.
 * 2. **Não dizia se o projeto ia bem.** Mostrava GUT, porcentagem e contagens soltas — 3
 *    atrasadas em 5 tarefas parecia igual a 3 em 50. Entra a saúde derivada
 *    (`lib/projectMetrics.ts`) com o motivo escrito, no mesmo padrão de Metas.
 */

const STATUS_ICON: Record<ProjectStatus, React.ElementType> = {
  done: CheckCircle2, healthy: TrendingUp, attention: AlertCircle,
  critical: AlertTriangle, idle: PauseCircle, empty: LayoutGrid,
}

const SORT_OPTS: { value: ProjectSort; label: string }[] = [
  { value: 'risk',     label: 'Risco primeiro' },
  { value: 'gut',      label: 'Prioridade GUT' },
  { value: 'dueDate',  label: 'Prazo mais próximo' },
  { value: 'progress', label: 'Maior progresso' },
  { value: 'name',     label: 'Nome' },
]

const FILTRO_OPTS = [
  { value: '',          label: 'Todos os estados' },
  { value: 'critical',  label: 'Em risco' },
  { value: 'attention', label: 'Atenção' },
  { value: 'idle',      label: 'Parados' },
  { value: 'healthy',   label: 'Em ritmo' },
  { value: 'done',      label: 'Concluídos' },
]

const fmtData = (iso: string) => parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

export function ProjectsListView() {
  const {
    projects: allProjects, tasks: allTasks, spaces: allSpaces, folders: allFolders,
    openNewProject, openAIProject, openGUT, setView, deleteProject, archiveProject,
    unarchiveProject, activeWorkspaceId,
  } = useAppStore()

  const [busca,        setBusca]        = useState('')
  const [sort,         setSort]         = useState<ProjectSort>('risk')
  const [filtro,       setFiltro]       = useState('')
  const [agrupar,      setAgrupar]      = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [menuId,       setMenuId]       = useState<string | null>(null)
  const [confirmDel,   setConfirmDel]   = useState<string | null>(null)

  const now      = useMemo(() => new Date(), [allTasks, allProjects])
  const tasks    = useMemo(() => allTasks.filter(t => t.workspaceId === activeWorkspaceId), [allTasks, activeWorkspaceId])
  const projects = useMemo(() => allProjects.filter(p => p.workspaceId === activeWorkspaceId), [allProjects, activeWorkspaceId])
  const spaces   = useMemo(() => allSpaces.filter(s => s.workspaceId === activeWorkspaceId), [allSpaces, activeWorkspaceId])
  const folders  = useMemo(() => allFolders.filter(f => spaces.some(s => s.id === f.spaceId)), [allFolders, spaces])

  const ativos   = useMemo(() => projects.filter(p => !p.archived), [projects])
  const arquivados = useMemo(() => projects.filter(p => p.archived), [projects])

  const saude = useMemo(
    () => new Map(projects.map(p => [p.id, projectHealth(p, tasks, now)])),
    [projects, tasks, now],
  )
  const resumo = useMemo(() => projectsSummary(ativos, tasks, now), [ativos, tasks, now])

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let lista = ativos
    if (q) lista = lista.filter(p => `${p.name} ${p.description}`.toLowerCase().includes(q))
    if (filtro) lista = lista.filter(p => saude.get(p.id)!.status === filtro)
    return sortProjects(lista, tasks, sort, now)
  }, [ativos, busca, filtro, saude, sort, tasks, now])

  const grupos = useMemo(
    () => groupBySpace(visiveis, spaces, folders).map(g => ({
      ...g, projects: sortProjects(g.projects, tasks, sort, now),
    })),
    [visiveis, spaces, folders, tasks, sort, now],
  )

  const excluir = (id: string) => {
    if (confirmDel === id) { deleteProject(id); setConfirmDel(null); setMenuId(null) }
    else setConfirmDel(id)
  }

  // `key` fica fora daqui: passar a chave dentro de um objeto espalhado é aviso do React
  // ("keys must be passed directly to JSX") e ela deixa de funcionar como identidade.
  const cardProps = (p: Project) => ({
    project: p, health: saude.get(p.id)!,
    menuAberto: menuId === p.id, confirmando: confirmDel === p.id,
    onMenu: () => { setMenuId(menuId === p.id ? null : p.id); setConfirmDel(null) },
    onFecharMenu: () => { setMenuId(null); setConfirmDel(null) },
    onAbrir: () => setView('project_detail', p.id),
    onGut: () => { setMenuId(null); openGUT(p.id) },
    onArquivar: () => { setMenuId(null); archiveProject(p.id) },
    onExcluir: () => excluir(p.id),
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Cabeçalho ── */}
      <div className="px-6 py-3.5 border-b border-gray-200 bg-white flex items-center gap-3 flex-shrink-0">
        <LayoutGrid size={16} className="text-gray-400" />
        <h1 className="text-[20px] font-extrabold text-gray-900 tracking-tight flex-1">Projetos</h1>
        <Button variant="default" size="sm" icon={<Sparkles size={14} className="text-brand-500"/>} onClick={() => openAIProject()}>
          Criar com IA
        </Button>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => openNewProject()}>
          Novo projeto
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {ativos.length === 0 ? (
          <VazioProjetos onCriar={() => openNewProject()} onIA={() => openAIProject()}/>
        ) : (
          <>
            {/* ── Resumo ── */}
            <div className="hero-card px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-1.5">Panorama dos projetos</p>
              <p className="text-[14px] text-gray-800 leading-relaxed">
                <strong className="font-extrabold">{resumo.total}</strong> {resumo.total === 1 ? 'projeto ativo' : 'projetos ativos'} com{' '}
                <strong className="font-extrabold">{resumo.avgProgress}%</strong> de progresso médio
                {resumo.critical > 0 && <> · <strong className="font-extrabold text-danger-600">{resumo.critical}</strong> em risco</>}
                {resumo.attention > 0 && <> · <strong className="font-extrabold text-warning-700">{resumo.attention}</strong> {resumo.attention === 1 ? 'pedindo' : 'pedindo'} atenção</>}
                {resumo.idle > 0 && <> · <strong className="font-extrabold">{resumo.idle}</strong> {resumo.idle === 1 ? 'parado' : 'parados'} há mais de {PROJECT_IDLE_DAYS} dias</>}
                {resumo.critical === 0 && resumo.attention === 0 && resumo.idle === 0 && <> · <span className="text-success-600 font-semibold">nada em risco</span></>}
                {resumo.overdue > 0 && <>. São <strong className="font-extrabold">{resumo.overdue}</strong> tarefas atrasadas no total</>}
                .
              </p>
            </div>

            {/* ── Busca, filtro, ordenação e agrupamento ── */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar projeto..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
              </div>
              <Select value={filtro} onChange={setFiltro} options={FILTRO_OPTS} ariaLabel="Filtrar por estado"/>
              <Select value={sort} onChange={v => setSort(v as ProjectSort)} options={SORT_OPTS} ariaLabel="Ordenar"/>
              <button onClick={() => setAgrupar(v => !v)}
                title={agrupar ? 'Ver como lista corrida' : 'Agrupar por espaço'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-lg border transition-colors ${
                  agrupar ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {agrupar ? <Layers size={14}/> : <List size={14}/>}
                {agrupar ? 'Por espaço' : 'Lista'}
              </button>
              {(busca || filtro) && (
                <button onClick={() => { setBusca(''); setFiltro('') }}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 transition-colors">Limpar</button>
              )}
              <span className="text-[11px] text-gray-500 tabnum ml-auto">
                {visiveis.length === ativos.length ? `${ativos.length} projetos` : `${visiveis.length} de ${ativos.length}`}
              </span>
            </div>

            {visiveis.length === 0 ? (
              <p className="text-[12px] text-gray-500 text-center py-10">Nenhum projeto corresponde à busca.</p>
            ) : agrupar ? (
              grupos.map(g => (
                <div key={g.key}>
                  {/* Cabeçalho do grupo: o caminho Espaço › Pasta que a tela ignorava */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }}/>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">{g.label}</span>
                    <span className="text-[10px] text-gray-500 tabnum">{g.projects.length}</span>
                    <div className="flex-1 h-px bg-gray-200"/>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {g.projects.map(p => <CardProjeto key={p.id} {...cardProps(p)}/>)}
                  </div>
                </div>
              ))
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visiveis.map(p => <CardProjeto key={p.id} {...cardProps(p)}/>)}
              </div>
            )}
          </>
        )}

        {/* ── Arquivados ── */}
        {arquivados.length > 0 && (
          <div className="pt-2">
            <button onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 hover:text-gray-800 transition-colors mb-3">
              {showArchived ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              <Archive size={14}/> Arquivados ({arquivados.length})
            </button>
            {showArchived && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {arquivados.map(p => (
                  <CardProjeto key={p.id} project={p} health={saude.get(p.id)!} arquivado
                    menuAberto={false} confirmando={false}
                    onMenu={() => {}} onFecharMenu={() => {}}
                    onAbrir={() => setView('project_detail', p.id)}
                    onGut={() => openGUT(p.id)}
                    onArquivar={() => unarchiveProject(p.id)}
                    onExcluir={() => excluir(p.id)}/>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────
// Fora do componente de tela: antes era declarado dentro do `ProjectsListView`, então o
// React recriava o tipo do componente a cada render e remontava todos os cartões.

function CardProjeto({
  project: p, health, arquivado, menuAberto, confirmando,
  onMenu, onFecharMenu, onAbrir, onGut, onArquivar, onExcluir,
}: {
  project: Project
  health: ProjectHealth
  arquivado?: boolean
  menuAberto: boolean
  confirmando: boolean
  onMenu: () => void; onFecharMenu: () => void
  onAbrir: () => void; onGut: () => void; onArquivar: () => void; onExcluir: () => void
}) {
  const tier = gutTier(p.gut.score)
  const meta = PROJECT_STATUS_META[health.status]
  const Icon = STATUS_ICON[health.status]

  return (
    <div className={`relative bg-white border rounded-2xl p-4 flex flex-col transition-all duration-200 ${
      arquivado ? 'border-gray-200/70 opacity-75' : 'border-gray-200/70 hover:border-gray-300 hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.12)]'}`}>

      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: p.color + '18' }}>
          <ProjectIcon project={p} size={18}/>
        </span>
        <div className="flex-1 min-w-0">
          <button onClick={onAbrir}
            className="block text-[13px] font-bold truncate text-left w-full text-gray-900 hover:text-brand-600 transition-colors">
            {p.name}
          </button>
          {/* "Sem descrição" era texto de preenchimento — some quando não há descrição */}
          {p.description && <p className="text-[11px] text-gray-500 truncate">{p.description}</p>}
        </div>

        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0 tabnum"
          style={{ background: tier.bg, color: tier.color }}
          title={`GUT ${p.gut.score} (${tier.label}) · Gravidade ${p.gut.g} · Urgência ${p.gut.u} · Tendência ${p.gut.t}`}>
          {p.gut.score}
        </span>

        {/* Ações no menu, como no resto do app — não mais lixeira no hover do cartão */}
        <div className="relative flex-shrink-0">
          <button onClick={onMenu} title="Mais ações"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <MoreHorizontal size={14}/>
          </button>
          {menuAberto && (
            <>
              <div className="fixed inset-0 z-40" onClick={onFecharMenu}/>
              <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1 animate-scale-in">
                <ItemMenu icon={Target} label="Ajustar prioridade (GUT)" onClick={onGut}/>
                <ItemMenu icon={Archive} label="Arquivar projeto" onClick={onArquivar}/>
                {confirmando ? (
                  <ItemMenu icon={AlertTriangle} danger onClick={onExcluir}
                    label={`Excluir e apagar ${health.total} tarefa${health.total === 1 ? '' : 's'}`}/>
                ) : (
                  <ItemMenu icon={Trash2} label="Excluir projeto" danger onClick={onExcluir}/>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Estado derivado + motivo ── */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: meta.color + '1F', color: meta.color }}>
          <Icon size={12}/>{arquivado ? 'Arquivado' : meta.label}
        </span>
        {health.nextDue && health.status !== 'done' && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            parseISO(health.nextDue) < new Date()
              ? 'text-danger-700 bg-danger-50 border-danger-100'
              : 'text-gray-600 bg-gray-50 border-gray-200'}`}>
            <Calendar size={12}/>{fmtData(health.nextDue)}
          </span>
        )}
      </div>
      <p className="text-[10px] text-gray-500 mt-1.5">{health.reason}</p>

      {/* ── Progresso e números ── */}
      <div className="mt-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${health.progress}%`, background: p.color }}/>
          </div>
          <span className="text-[11px] font-bold text-gray-600 tabnum">{health.progress}%</span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
          <span><b className="text-gray-700 tabnum">{health.active}</b> abertas</span>
          <span><b className="text-gray-700 tabnum">{health.done}</b> feitas</span>
          {health.overdue > 0 && <span className="text-danger-600 font-semibold"><b className="tabnum">{health.overdue}</b> em atraso</span>}
        </div>
      </div>

      {arquivado && (
        <button onClick={onArquivar}
          className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-gray-600 hover:text-brand-600 transition-colors">
          <ArchiveRestore size={14}/> Restaurar projeto
        </button>
      )}
    </div>
  )
}

function ItemMenu({ icon: Icon, label, onClick, danger }: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors ${
        danger ? 'text-danger-600 hover:bg-danger-50 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
      <Icon size={14} className={danger ? '' : 'text-gray-400'}/> <span className="flex-1">{label}</span>
    </button>
  )
}

function VazioProjetos({ onCriar, onIA }: { onCriar: () => void; onIA: () => void }) {
  return (
    <div className="bg-white border border-gray-200/70 rounded-xl px-6 py-12 text-center max-w-2xl mx-auto">
      <div className="w-11 h-11 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-3">
        <LayoutGrid size={18} className="text-brand-500"/>
      </div>
      <p className="text-[13px] font-bold text-gray-800">Nenhum projeto ativo</p>
      <p className="text-[11px] text-gray-500 mt-1 max-w-[440px] mx-auto leading-relaxed">
        Projeto é onde as tarefas moram. Crie um do zero ou descreva o que precisa entregar
        e deixe a IA montar a estrutura com as primeiras tarefas.
      </p>
      <div className="flex items-center justify-center gap-2 mt-4">
        <button onClick={onCriar}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-bold rounded-lg transition-colors">
          <Plus size={14}/> Novo projeto
        </button>
        <button onClick={onIA}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-brand-300 text-gray-700 text-[12px] font-semibold rounded-lg transition-colors">
          <Sparkles size={14} className="text-brand-500"/> Criar com IA
        </button>
      </div>
    </div>
  )
}
