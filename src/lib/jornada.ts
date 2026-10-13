import type { Task, TaskStatus } from '../types'
import { estaAtrasada } from './dueDate'
import { parseISO } from './dateFilter'

/**
 * Jornada do projeto: os **marcos** (tarefas do tipo `milestone` no nível principal) viram
 * as estações de uma trilha, e as subtarefas de cada marco ficam embaixo dele.
 *
 * Responde três perguntas que as outras visões não respondem de relance:
 * - **De onde veio** — quando o trabalho começou e o que já foi entregue;
 * - **Onde está** — o marco atual e o próximo passo dentro dele;
 * - **Para onde vai** — o marco seguinte e a chegada.
 *
 * Ordem da trilha (não depende de arrastar nada):
 * 1. marcos concluídos, pela data em que foram concluídos (o passado é cronológico);
 * 2. marcos abertos, pelo prazo; os sem prazo vão para o fim, na ordem da lista.
 * O **atual** é o primeiro marco aberto dessa ordem.
 */

export type FaseMarco = 'feito' | 'atual' | 'adiante'

export interface MarcoDaJornada {
  marco:        Task
  fase:         FaseMarco
  /** Subtarefas diretas do marco, abertas primeiro na ordem de "próximo passo". */
  tarefas:      Task[]
  feitas:       number
  total:        number
  pct:          number
  atrasado:     boolean
  /** Só no marco atual: a tarefa que vale atacar agora. */
  proximoPasso: Task | null
}

export interface Jornada {
  marcos:     MarcoDaJornada[]
  /** Índice do marco atual em `marcos`, ou -1 quando todos estão concluídos (ou não há). */
  atualIdx:   number
  /** Tarefas principais que não são marco e não estão debaixo de um. */
  semMarco:   Task[]
  /** Data em que o trabalho começou: a tarefa mais antiga do escopo. */
  inicio:     string | null
  /** Prazo mais distante entre os marcos abertos — a "chegada" prevista. */
  chegada:    string | null
  /** Total de tarefas concluídas dentro de marcos já fechados. */
  entregues:  number
}

/** Do que mais pede atenção para o que menos: em andamento primeiro, pausado por último. */
const PESO_STATUS: Record<TaskStatus, number> = {
  in_progress: 0, waiting: 1, todo: 2, paused: 3, done: 4,
}

const tempo = (iso: string | null | undefined): number => {
  if (!iso) return Number.POSITIVE_INFINITY
  const ms = parseISO(iso).getTime()
  return isNaN(ms) ? Number.POSITIVE_INFINITY : ms
}

/** Ordena preservando a ordem original nos empates (a posição na lista é do usuário). */
function ordenar<T>(itens: T[], cmp: (a: T, b: T) => number): T[] {
  return itens.map((v, i) => ({ v, i }))
    .sort((a, b) => cmp(a.v, b.v) || a.i - b.i)
    .map(x => x.v)
}

/** Ordem das tarefas dentro de um marco: o que falta antes, por urgência; feitas no fim. */
export function ordenarTarefasDoMarco(tarefas: Task[]): Task[] {
  return ordenar(tarefas, (a, b) =>
    PESO_STATUS[a.status] - PESO_STATUS[b.status]
    || (a.status === 'done' ? 0 : tempo(a.dueDate) - tempo(b.dueDate)))
}

export function montarJornada(tarefas: Task[], agora: Date = new Date()): Jornada {
  const filhasDe = new Map<string, Task[]>()
  for (const t of tarefas) {
    if (!t.parentId) continue
    const l = filhasDe.get(t.parentId) ?? []
    l.push(t)
    filhasDe.set(t.parentId, l)
  }
  const ids = new Set(tarefas.map(t => t.id))
  // "Principal" = sem pai, ou com pai fora do conjunto (busca/filtro pode cortar o pai).
  const principais = tarefas.filter(t => !t.parentId || !ids.has(t.parentId))

  const marcosBrutos = principais.filter(t => t.taskType === 'milestone')
  const fechados = ordenar(marcosBrutos.filter(m => m.status === 'done'),
    (a, b) => tempo(a.completedAt ?? a.updatedAt) - tempo(b.completedAt ?? b.updatedAt))
  const abertos = ordenar(marcosBrutos.filter(m => m.status !== 'done'),
    (a, b) => tempo(a.dueDate) - tempo(b.dueDate))

  const marcos: MarcoDaJornada[] = [...fechados, ...abertos].map((marco, i) => {
    const filhas  = filhasDe.get(marco.id) ?? []
    const feitas  = filhas.filter(f => f.status === 'done').length
    const total   = filhas.length
    const fase: FaseMarco = marco.status === 'done' ? 'feito' : i === fechados.length ? 'atual' : 'adiante'
    const ordenadas = ordenarTarefasDoMarco(filhas)
    return {
      marco, fase,
      tarefas: ordenadas,
      feitas, total,
      pct: total > 0 ? Math.round((feitas / total) * 100) : marco.status === 'done' ? 100 : 0,
      atrasado: estaAtrasada(marco.dueDate, marco.status, agora),
      proximoPasso: fase === 'atual' ? (ordenadas.find(t => t.status !== 'done') ?? null) : null,
    }
  })

  const inicio = tarefas.reduce<string | null>(
    (min, t) => (!min || t.createdAt < min ? t.createdAt : min), null)
  const prazosAbertos = abertos.map(m => m.dueDate).filter((d): d is string => !!d)
  const chegada = prazosAbertos.length ? prazosAbertos.reduce((a, b) => (tempo(b) > tempo(a) ? b : a)) : null

  return {
    marcos,
    atualIdx: abertos.length ? fechados.length : -1,
    semMarco: principais.filter(t => t.taskType !== 'milestone'),
    inicio,
    chegada,
    entregues: fechados.reduce((s, m) => s + (filhasDe.get(m.id) ?? []).filter(f => f.status === 'done').length, 0),
  }
}
