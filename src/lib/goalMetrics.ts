// Cálculos das metas. Ficam aqui, fora da view, pelo mesmo motivo do relatório: é a parte
// que precisa ser conferida com calma, e a tela dos Relatórios consome as mesmas funções.
import type { Goal, GoalStatus, GoalTarget, Task } from '../types'
import { goalTargetProgress } from '../types'

const DIA = 86_400_000

/** Dias inteiros entre duas datas (nunca negativo para trás). */
const dias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DIA)

/**
 * Valor atual de um alvo. Para `tasks` o número é **contado das tarefas concluídas** que
 * casam com projeto/etiqueta; para os outros tipos é o valor digitado.
 */
export function targetCurrent(t: GoalTarget, tasks: Task[]): number {
  if (t.type !== 'tasks') return t.current
  return tasks.filter(k =>
    k.status === 'done' && !k.parentId &&
    (!t.projectId || k.projectId === t.projectId) &&
    (!t.tag || k.tags.includes(t.tag))
  ).length
}

/** Progresso do alvo (0–100), já resolvendo o tipo `tasks`. */
export function targetProgress(t: GoalTarget, tasks: Task[]): number {
  return goalTargetProgress({ ...t, current: targetCurrent(t, tasks) })
}

/**
 * Lista de alvos à prova de dado velho. Metas gravadas antes de `targets` existir (ou por
 * uma escrita parcial da nuvem) chegam com `null`, e `null.length` derrubava a tela inteira
 * — descoberto testando o ErrorBoundary com um registro corrompido.
 */
const alvosDe = (goal: Goal): GoalTarget[] => Array.isArray(goal.targets) ? goal.targets : []

/** Progresso da meta = média dos alvos. Sem alvos, cai no status (0 ou 100). */
export function goalProgressOf(goal: Goal, tasks: Task[]): number {
  const alvos = alvosDe(goal)
  if (!alvos.length) return goal.status === 'done' ? 100 : 0
  const soma = alvos.reduce((s, t) => s + targetProgress(t, tasks), 0)
  return Math.round(soma / alvos.length)
}

export interface GoalHealth {
  progress: number
  status: GoalStatus
  /** Percentual do prazo já decorrido (null quando a meta não tem prazo). */
  timeElapsed: number | null
  daysLeft: number | null
  /** Dias desde a última atualização da meta ou de um alvo. */
  idleDays: number
  /** Frase curta explicando o status — o card mostra o *porquê*, não só a cor. */
  reason: string
}

export const GOAL_IDLE_DAYS = 21   // acima disso a meta é tratada como parada

/**
 * Saúde da meta, **derivada**. O status era um campo escolhido à mão que nunca se
 * atualizava: meta com prazo vencido e 20% feito seguia dizendo "No caminho" até alguém
 * lembrar de editar — pior que não ter status, porque parecia medido. Agora só
 * `status === 'done'` é respeitado como decisão do usuário; o resto sai da conta de
 * progresso contra prazo.
 */
export function goalHealth(goal: Goal, tasks: Task[], now: Date = new Date()): GoalHealth {
  const progress = goalProgressOf(goal, tasks)
  const criacao  = new Date(goal.createdAt)
  const prazo    = goal.targetDate ? new Date(goal.targetDate + 'T23:59:59') : null

  const ultimaMexida = alvosDe(goal).reduce<string>(
    (max, t) => (t.updatedAt && t.updatedAt > max ? t.updatedAt : max), goal.updatedAt)
  const idleDays = Math.max(0, dias(new Date(ultimaMexida), now))

  if (goal.status === 'done' || progress >= 100) {
    return { progress, status: 'done', timeElapsed: null, daysLeft: null, idleDays,
             reason: progress >= 100 ? 'Alvos alcançados' : 'Marcada como concluída' }
  }

  if (!prazo) {
    return { progress, status: 'on_track', timeElapsed: null, daysLeft: null, idleDays,
             reason: idleDays >= GOAL_IDLE_DAYS ? `Sem atualização há ${idleDays} dias` : 'Sem prazo definido' }
  }

  const daysLeft = dias(now, prazo)
  const total    = Math.max(1, dias(criacao, prazo))
  const decorrido = Math.min(100, Math.max(0, Math.round((dias(criacao, now) / total) * 100)))

  if (daysLeft < 0) {
    return { progress, status: 'off_track', timeElapsed: 100, daysLeft, idleDays,
             reason: `Prazo venceu há ${Math.abs(daysLeft)} dia(s) com ${progress}% feito` }
  }

  // Comparação simples e explicável: o quanto do trabalho deveria estar pronto se o
  // avanço fosse proporcional ao tempo. As folgas evitam alarmar no começo do ciclo.
  const atraso = decorrido - progress
  const status: GoalStatus = atraso <= 10 ? 'on_track' : atraso <= 25 ? 'at_risk' : 'off_track'
  const reason =
    status === 'on_track' ? `${progress}% feito com ${decorrido}% do prazo — em ritmo`
    : `${progress}% feito, mas ${decorrido}% do prazo já passou`

  return { progress, status, timeElapsed: decorrido, daysLeft, idleDays, reason }
}

/** Resumo do conjunto, para a faixa no topo da tela. */
export function goalsSummary(goals: Goal[], tasks: Task[], now: Date = new Date()) {
  const saude = goals.map(g => goalHealth(g, tasks, now))
  return {
    total: goals.length,
    done:      saude.filter(s => s.status === 'done').length,
    onTrack:   saude.filter(s => s.status === 'on_track').length,
    atRisk:    saude.filter(s => s.status === 'at_risk').length,
    offTrack:  saude.filter(s => s.status === 'off_track').length,
    idle:      saude.filter(s => s.status !== 'done' && s.idleDays >= GOAL_IDLE_DAYS).length,
    avgProgress: goals.length ? Math.round(saude.reduce((s, h) => s + h.progress, 0) / goals.length) : 0,
  }
}

export type GoalSort = 'deadline' | 'progress' | 'risk' | 'name'

const RISK_ORDER: Record<GoalStatus, number> = { off_track: 0, at_risk: 1, on_track: 2, done: 3 }

export function sortGoals(goals: Goal[], tasks: Task[], sort: GoalSort, now: Date = new Date()): Goal[] {
  const health = new Map(goals.map(g => [g.id, goalHealth(g, tasks, now)]))
  return [...goals].sort((a, b) => {
    const ha = health.get(a.id)!, hb = health.get(b.id)!
    switch (sort) {
      case 'deadline':
        if (!a.targetDate && !b.targetDate) return a.name.localeCompare(b.name)
        if (!a.targetDate) return 1
        if (!b.targetDate) return -1
        return a.targetDate.localeCompare(b.targetDate)
      case 'progress': return hb.progress - ha.progress
      case 'risk':     return RISK_ORDER[ha.status] - RISK_ORDER[hb.status] || ha.progress - hb.progress
      case 'name':     return a.name.localeCompare(b.name)
    }
  })
}
