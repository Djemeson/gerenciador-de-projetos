// Saúde de projeto. Segue o mesmo princípio das metas (lib/goalMetrics.ts): o estado é
// **derivado** dos dados, com o motivo escrito em português — a lista antiga mostrava GUT,
// porcentagem e contagens, mas não dizia se o projeto estava indo bem.
import type { Project, Task, Space, Folder } from '../types'
import { averageProgress } from './reportMetrics'
import { parseISO } from './dateFilter'

const DIA = 86_400_000
const dias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DIA)

export type ProjectStatus = 'done' | 'critical' | 'attention' | 'idle' | 'healthy' | 'empty'

/** Projeto sem atividade por este tempo (tendo trabalho aberto) é tratado como parado. */
export const PROJECT_IDLE_DAYS = 21

export interface ProjectHealth {
  total: number
  done: number
  active: number
  overdue: number
  urgent: number
  /** Progresso real: conta subtarefas e checklists, não só o status da raiz. */
  progress: number
  /** Prazo mais distante entre as tarefas abertas — o app não tem prazo de projeto. */
  lastDue: string | null
  /** Prazo mais próximo entre as abertas, o que costuma ser a pergunta do dia. */
  nextDue: string | null
  idleDays: number
  status: ProjectStatus
  reason: string
}

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  done:      { label: 'Concluído', color: '#1D9E75' },
  healthy:   { label: 'Em ritmo',  color: '#378ADD' },
  attention: { label: 'Atenção',   color: '#D89A18' },
  critical:  { label: 'Em risco',  color: '#E24B4A' },
  idle:      { label: 'Parado',    color: '#888780' },
  empty:     { label: 'Vazio',     color: '#9B9EA8' },
}

export function projectHealth(project: Project, allTasks: Task[], now: Date = new Date()): ProjectHealth {
  const doProjeto = allTasks.filter(t => t.projectId === project.id)
  const raizes    = doProjeto.filter(t => !t.parentId)
  const abertas   = raizes.filter(t => t.status !== 'done')
  const done      = raizes.filter(t => t.status === 'done').length
  const atrasadas = abertas.filter(t => t.dueDate && parseISO(t.dueDate) < now)
  const urgentes  = abertas.filter(t => t.priority === 'urgent')

  const prazos = abertas.map(t => t.dueDate).filter(Boolean).sort() as string[]
  const progress = averageProgress(raizes, doProjeto) ?? 0

  const ultimaMexida = doProjeto.reduce<string>((max, t) => (t.updatedAt > max ? t.updatedAt : max), project.updatedAt)
  const idleDays = Math.max(0, dias(parseISO(ultimaMexida), now))

  const base = {
    total: raizes.length, done, active: abertas.length,
    overdue: atrasadas.length, urgent: urgentes.length, progress,
    nextDue: prazos[0] ?? null, lastDue: prazos[prazos.length - 1] ?? null,
    idleDays,
  }

  if (raizes.length === 0) {
    return { ...base, status: 'empty', reason: 'Nenhuma tarefa criada ainda' }
  }
  if (abertas.length === 0) {
    return { ...base, status: 'done', reason: `${done} de ${raizes.length} tarefas concluídas` }
  }
  // Risco: um terço ou mais do trabalho aberto está atrasado, ou o projeto é crítico no GUT
  // e já tem atraso. Contagem sozinha não serve — 3 atrasadas em 5 é diferente de 3 em 50.
  const fracaoAtrasada = atrasadas.length / abertas.length
  if (fracaoAtrasada >= 0.34 || (project.gut.score >= 80 && atrasadas.length > 0)) {
    return { ...base, status: 'critical',
             reason: `${atrasadas.length} de ${abertas.length} tarefas abertas em atraso` }
  }
  if (idleDays >= PROJECT_IDLE_DAYS) {
    return { ...base, status: 'idle', reason: `Sem movimento há ${idleDays} dias` }
  }
  if (atrasadas.length > 0 || urgentes.length > 0) {
    const partes = [
      atrasadas.length ? `${atrasadas.length} em atraso` : '',
      urgentes.length ? `${urgentes.length} urgente${urgentes.length > 1 ? 's' : ''}` : '',
    ].filter(Boolean)
    return { ...base, status: 'attention', reason: partes.join(' · ') }
  }
  return { ...base, status: 'healthy', reason: `${progress}% concluído, sem atrasos` }
}

// ── Agrupamento pela hierarquia ──────────────────────────────────────────────

export interface ProjectGroup {
  key: string
  label: string
  color: string
  /** Caminho Espaço › Pasta — a hierarquia é o princípio central do app (seção 2). */
  projects: Project[]
}

/**
 * Agrupa por Espaço › Pasta. A lista antiga era uma grade plana: o app organiza tudo em
 * Espaço → Pasta → Projeto e a tela de projetos ignorava os dois níveis.
 */
export function groupBySpace(projects: Project[], spaces: Space[], folders: Folder[]): ProjectGroup[] {
  const grupos: ProjectGroup[] = []
  const push = (key: string, label: string, color: string, itens: Project[]) => {
    if (itens.length) grupos.push({ key, label, color, projects: itens })
  }

  spaces.forEach(s => {
    const doEspaco = projects.filter(p => p.spaceId === s.id)
    if (!doEspaco.length) return
    push(`sp:${s.id}`, s.name, s.color, doEspaco.filter(p => !p.folderId))
    folders.filter(f => f.spaceId === s.id).forEach(f => {
      push(`fd:${f.id}`, `${s.name} › ${f.name}`, f.color ?? s.color, doEspaco.filter(p => p.folderId === f.id))
    })
  })
  push('none', 'Sem espaço', '#888780', projects.filter(p => !p.spaceId))
  return grupos
}

export type ProjectSort = 'risk' | 'gut' | 'progress' | 'name' | 'dueDate'

const RISK_ORDER: Record<ProjectStatus, number> = {
  critical: 0, attention: 1, idle: 2, healthy: 3, empty: 4, done: 5,
}

export function sortProjects(projects: Project[], tasks: Task[], sort: ProjectSort, now: Date = new Date()): Project[] {
  const saude = new Map(projects.map(p => [p.id, projectHealth(p, tasks, now)]))
  return [...projects].sort((a, b) => {
    const ha = saude.get(a.id)!, hb = saude.get(b.id)!
    switch (sort) {
      case 'risk':     return RISK_ORDER[ha.status] - RISK_ORDER[hb.status] || hb.overdue - ha.overdue
      case 'gut':      return b.gut.score - a.gut.score
      case 'progress': return hb.progress - ha.progress
      case 'name':     return a.name.localeCompare(b.name)
      case 'dueDate':
        if (!ha.nextDue && !hb.nextDue) return a.name.localeCompare(b.name)
        if (!ha.nextDue) return 1
        if (!hb.nextDue) return -1
        return ha.nextDue.localeCompare(hb.nextDue)
    }
  })
}

export function projectsSummary(projects: Project[], tasks: Task[], now: Date = new Date()) {
  const saude = projects.map(p => projectHealth(p, tasks, now))
  return {
    total: projects.length,
    critical:  saude.filter(s => s.status === 'critical').length,
    attention: saude.filter(s => s.status === 'attention').length,
    idle:      saude.filter(s => s.status === 'idle').length,
    done:      saude.filter(s => s.status === 'done').length,
    overdue:   saude.reduce((s, h) => s + h.overdue, 0),
    avgProgress: projects.length ? Math.round(saude.reduce((s, h) => s + h.progress, 0) / projects.length) : 0,
  }
}
