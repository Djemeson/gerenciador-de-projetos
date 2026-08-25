// Mesclagem item a item entre o estado local e o documento de sincronização da nuvem.
//
// Por que existe: a sincronização é um documento único por conta, gravado inteiro a cada
// push e aplicado inteiro a cada snapshot. Substituir a lista local pela remota fazia uma
// tarefa recém-criada **desaparecer segundos depois**: o snapshot chegava gravado por um
// dispositivo (ou por um estado da nuvem) que ainda não conhecia a tarefa nova — e o push
// dela ou ainda estava no debounce de 1,5s, ou tinha sido engolido pela trava `cloudReady`.
// A mesclagem troca "o remoto vence sempre" por regras por item:
//
// - item nos dois lados      → fica o de `updatedAt` mais novo (empate: remoto);
// - item só no remoto        → entra, a menos que tenha sido excluído aqui depois de o
//                              documento remoto ser gravado (registro de exclusões abaixo);
// - item só no local         → fica, se ainda não subiu num push (registro de pendências
//                              abaixo — independe de relógio) ou se for mais novo que o
//                              documento remoto; senão, foi excluído noutro dispositivo e cai;
// - ordem da lista           → vale a ordem local se ela foi alterada (arrastar) depois de
//                              o documento remoto ser gravado (registro de ordem abaixo);
//                              senão vale a remota, com o que só existe localmente no fim;
// - lista remota vazia       → mantém a local inteira (regra pré-existente: um documento
//                              parcial/corrompido nunca apaga o trabalho — ver comentário
//                              original em `applyRemoteSnapshot`).
//
// `margemMs` absorve diferença de relógio entre dispositivos: na dúvida (timestamps a menos
// de 5 min um do outro), a mesclagem prefere **manter** o item — um item mantido a mais se
// corrige no próximo push; um item descartado a mais é trabalho perdido.

export interface ItemSincronizavel {
  id: string
  updatedAt?: string
  createdAt?: string
}

export interface ResultadoMescla<T> {
  itens: T[]
  /** O resultado difere do remoto (conteúdo ou ordem) → re-push para a nuvem convergir. */
  manteveLocal: boolean
}

export const MARGEM_RELOGIO_MS = 5 * 60_000

const ts = (s?: string) => {
  if (!s) return 0
  const n = Date.parse(s)
  return Number.isFinite(n) ? n : 0
}
const tsItem = (i: ItemSincronizavel) => Math.max(ts(i.updatedAt), ts(i.createdAt))

export function mesclarPorId<T extends ItemSincronizavel>(
  local: T[],
  remoto: T[],
  remotoGravadoEm: number,
  opts: {
    exclusoes?: Record<string, number>
    pendentes?: Record<string, number>
    ordemLocalEm?: number
    margemMs?: number
  } = {},
): ResultadoMescla<T> {
  const { exclusoes = {}, pendentes = {}, ordemLocalEm = 0, margemMs = MARGEM_RELOGIO_MS } = opts

  if (remoto.length === 0) return { itens: local, manteveLocal: local.length > 0 }

  const locaisPorId  = new Map(local.map(i => [i.id, i]))
  const remotosPorId = new Map(remoto.map(i => [i.id, i]))

  // Sequência-base: a local, se o usuário reordenou depois (ou quase junto) da gravação do
  // documento remoto; senão a remota. O lado ausente entra no fim, na ordem em que estava.
  const ordemBase: T[] = ordemLocalEm > remotoGravadoEm - margemMs
    ? [...local, ...remoto.filter(r => !locaisPorId.has(r.id))]
    : [...remoto, ...local.filter(l => !remotosPorId.has(l.id))]

  const itens: T[] = []
  let manteveLocal = false

  for (const base of ordemBase) {
    const l = locaisPorId.get(base.id)
    const r = remotosPorId.get(base.id)
    if (l && r) {
      if (tsItem(l) > tsItem(r)) { itens.push(l); manteveLocal = true }
      else itens.push(r)
      continue
    }
    if (r) {
      // Só no remoto: excluído aqui depois (ou quase junto) da gravação do documento?
      const excluidoEm = exclusoes[r.id]
      if (excluidoEm !== undefined && excluidoEm > remotoGravadoEm - margemMs) {
        manteveLocal = true   // a exclusão local precisa voltar para a nuvem
        continue
      }
      itens.push(r)
      continue
    }
    if (l) {
      // Só no local: nunca subiu num push (pendência sobrevive a reinício e a relógio
      // adiantado do outro lado) ou é novo demais para o remoto conhecer.
      if (pendentes[l.id] !== undefined || tsItem(l) > remotoGravadoEm - margemMs) {
        itens.push(l); manteveLocal = true
      }
      // senão: excluído noutro dispositivo — cai de propósito.
    }
  }

  // A sequência final difere da remota (reordenação local venceu) → também precisa subir.
  if (!manteveLocal && (itens.length !== remoto.length || itens.some((i, k) => i.id !== remoto[k].id))) {
    manteveLocal = true
  }

  return { itens, manteveLocal }
}

// ── Persistência auxiliar (localStorage, tolerante a ambiente sem ele) ────

function lerMapa(key: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') ?? {} }
  catch { return {} }
}
function gravarMapa(key: string, map: Record<string, number>) {
  try { localStorage.setItem(key, JSON.stringify(map)) } catch { /* sem localStorage (testes) */ }
}
function podar(map: Record<string, number>, agora: number, ttlMs: number, max: number): Record<string, number> {
  let entradas = Object.entries(map).filter(([, at]) => agora - at < ttlMs)
  if (entradas.length > max) entradas = entradas.sort((a, b) => b[1] - a[1]).slice(0, max)
  return Object.fromEntries(entradas)
}

// ── Registro de exclusões (tombstones) ────────────────────────────────────
// Guarda `id → quando` das exclusões feitas neste navegador, para um snapshot gravado
// **antes** da exclusão não ressuscitar o item na janela entre excluir e o push subir.
// A propagação da exclusão entre dispositivos não depende disto — ela vai no próprio
// documento (o item simplesmente não está mais lá).

const EXCLUSOES_KEY = 'tf_exclusoes_recentes'
const REGISTRO_MAX = 1000
const REGISTRO_TTL_MS = 7 * 24 * 60 * 60_000

export function registrarExclusoes(ids: string[]) {
  if (!ids.length) return
  const agora = Date.now()
  const map = lerMapa(EXCLUSOES_KEY)
  ids.forEach(id => { map[id] = agora })
  gravarMapa(EXCLUSOES_KEY, podar(map, agora, REGISTRO_TTL_MS, REGISTRO_MAX))
}

/** Desfazer restaurou itens → a exclusão registrada deixa de valer. */
export function cancelarExclusoes(ids: string[]) {
  if (!ids.length) return
  const map = lerMapa(EXCLUSOES_KEY)
  let mudou = false
  ids.forEach(id => { if (id in map) { delete map[id]; mudou = true } })
  if (mudou) gravarMapa(EXCLUSOES_KEY, map)
}

export function obterExclusoes(): Record<string, number> { return lerMapa(EXCLUSOES_KEY) }

// ── Registro de pendências de push ────────────────────────────────────────
// `id → quando` de tudo que foi criado/alterado aqui e ainda não subiu num push
// bem-sucedido. É o que protege um item só-local de ser lido como "excluído noutro
// dispositivo": pendente nunca cai, não importa o relógio de quem gravou o documento
// remoto. Persistido — cobre inclusive edição offline de uma sessão fechada antes do push.

const PENDENCIAS_KEY = 'tf_pendencias_push'

export function registrarPendencias(ids: string[]) {
  if (!ids.length) return
  const agora = Date.now()
  const map = lerMapa(PENDENCIAS_KEY)
  ids.forEach(id => { map[id] = agora })
  gravarMapa(PENDENCIAS_KEY, podar(map, agora, REGISTRO_TTL_MS, REGISTRO_MAX))
}

/** Push subiu com sucesso → o que ele continha deixa de estar pendente. */
export function concluirPendencias(ids: string[]) {
  if (!ids.length) return
  const map = lerMapa(PENDENCIAS_KEY)
  ids.forEach(id => { delete map[id] })
  gravarMapa(PENDENCIAS_KEY, map)
}

export function obterPendencias(): Record<string, number> { return lerMapa(PENDENCIAS_KEY) }

// ── Registro de ordem alterada ────────────────────────────────────────────
// Reordenar por arrasto não muda `updatedAt` de ninguém (a posição é do array, não do
// item). O carimbo por lista diz à mesclagem que a sequência local é mais nova que o
// documento remoto e deve vencer.

const ORDEM_KEY = 'tf_ordem_alterada'
export type ListaOrdenavel = 'tasks' | 'projects' | 'spaces' | 'folders'

export function registrarOrdemAlterada(lista: ListaOrdenavel) {
  const map = lerMapa(ORDEM_KEY)
  map[lista] = Date.now()
  gravarMapa(ORDEM_KEY, map)
}

export function obterOrdemAlterada(lista: ListaOrdenavel): number {
  return lerMapa(ORDEM_KEY)[lista] ?? 0
}
