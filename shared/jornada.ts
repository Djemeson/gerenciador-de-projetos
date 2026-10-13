// Jornada do projeto: os **marcos** (tarefas do tipo `milestone` no nível principal) viram
// as estações de uma trilha, e as subtarefas de cada marco ficam embaixo dele.
//
// Mora em shared/ porque o app (aba "Marcos", src/lib/jornada.ts) e o conector do Claude
// (ferramenta ver_marcos, shared/ferramentas.ts) precisam contar a mesma história: se cada
// lado decidisse sozinho qual é o "marco atual", o Claude e a tela discordariam.
//
// Responde três perguntas que as outras visões não respondem de relance:
// - **De onde veio** — quando o trabalho começou e o que já foi entregue;
// - **Onde está** — o marco atual e o próximo passo dentro dele;
// - **Para onde vai** — o marco seguinte e a chegada.
//
// Ordem da trilha (não depende de arrastar nada):
// 1. marcos concluídos, pela data em que foram concluídos (o passado é cronológico);
// 2. marcos abertos, pelo prazo; os sem prazo vão para o fim, na ordem da lista.
// O **atual** é o primeiro marco aberto dessa ordem.
//
// Datas são comparadas como texto (AAAA-MM-DD e ISO ordenam certo assim), sem `Date`: o
// servidor roda em UTC e o app no fuso do aparelho, e "hoje" chega pronto de quem chama.

export interface TarefaJornada {
  id: string
  parentId: string | null
  taskType?: string
  status: string
  dueDate?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt?: string
}

export type FaseMarco = 'feito' | 'atual' | 'adiante'

export interface MarcoDaJornada<T extends TarefaJornada = TarefaJornada> {
  marco:        T
  fase:         FaseMarco
  /** Subtarefas diretas do marco, abertas primeiro na ordem de "próximo passo". */
  tarefas:      T[]
  feitas:       number
  total:        number
  pct:          number
  atrasado:     boolean
  /** Só no marco atual: a tarefa que vale atacar agora. */
  proximoPasso: T | null
}

export interface Jornada<T extends TarefaJornada = TarefaJornada> {
  marcos:     MarcoDaJornada<T>[]
  /** Índice do marco atual em `marcos`, ou -1 quando todos estão concluídos (ou não há). */
  atualIdx:   number
  /** Tarefas principais que não são marco e não estão debaixo de um. */
  semMarco:   T[]
  /** Data em que o trabalho começou: a tarefa mais antiga do escopo. */
  inicio:     string | null
  /** Prazo mais distante entre os marcos abertos — a "chegada" prevista. */
  chegada:    string | null
  /** Total de tarefas concluídas dentro de marcos já fechados. */
  entregues:  number
}

/** Do que mais pede atenção para o que menos: em andamento primeiro, pausado por último. */
const PESO_STATUS: Record<string, number> = {
  in_progress: 0, waiting: 1, todo: 2, paused: 3, done: 4,
}
const peso = (s: string) => PESO_STATUS[s] ?? 2

/** Texto de data para ordenar; vazio vai para o fim. */
const chave = (iso: string | null | undefined) => (iso ? String(iso) : '￿')
const cmpTexto = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Ordena preservando a ordem original nos empates (a posição na lista é do usuário). */
function ordenar<T>(itens: T[], cmp: (a: T, b: T) => number): T[] {
  return itens.map((v, i) => ({ v, i }))
    .sort((a, b) => cmp(a.v, b.v) || a.i - b.i)
    .map(x => x.v)
}

/** Ordem das tarefas dentro de um marco: o que falta antes, por urgência; feitas no fim. */
export function ordenarTarefasDoMarco<T extends TarefaJornada>(tarefas: T[]): T[] {
  return ordenar(tarefas, (a, b) =>
    peso(a.status) - peso(b.status)
    || (a.status === 'done' ? 0 : cmpTexto(chave(a.dueDate?.slice(0, 10)), chave(b.dueDate?.slice(0, 10)))))
}

/** `hoje` em AAAA-MM-DD, no fuso de quem vai ler (o app usa o do aparelho; o servidor, Bragança). */
export function montarJornada<T extends TarefaJornada>(tarefas: T[], hoje: string): Jornada<T> {
  const filhasDe = new Map<string, T[]>()
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
    (a, b) => cmpTexto(chave(a.completedAt ?? a.updatedAt), chave(b.completedAt ?? b.updatedAt)))
  const abertos = ordenar(marcosBrutos.filter(m => m.status !== 'done'),
    (a, b) => cmpTexto(chave(a.dueDate?.slice(0, 10)), chave(b.dueDate?.slice(0, 10))))

  const marcos: MarcoDaJornada<T>[] = [...fechados, ...abertos].map((marco, i) => {
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
      // Vencer hoje não é atraso: só o prazo que já virou.
      atrasado: marco.status !== 'done' && !!marco.dueDate && marco.dueDate.slice(0, 10) < hoje,
      proximoPasso: fase === 'atual' ? (ordenadas.find(t => t.status !== 'done') ?? null) : null,
    }
  })

  const inicio = tarefas.reduce<string | null>(
    (min, t) => (!min || t.createdAt < min ? t.createdAt : min), null)
  const prazosAbertos = abertos.map(m => m.dueDate?.slice(0, 10)).filter((d): d is string => !!d)
  const chegada = prazosAbertos.length ? prazosAbertos.reduce((a, b) => (b > a ? b : a)) : null

  return {
    marcos,
    atualIdx: abertos.length ? fechados.length : -1,
    semMarco: principais.filter(t => t.taskType !== 'milestone'),
    inicio,
    chegada,
    entregues: fechados.reduce((s, m) => s + (filhasDe.get(m.id) ?? []).filter(f => f.status === 'done').length, 0),
  }
}
