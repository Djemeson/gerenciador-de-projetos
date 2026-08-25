// Mesclagem item a item entre o estado local e o documento de sincronização da nuvem.
//
// Por que existe: a sincronização é um documento único por conta, gravado inteiro a cada
// push e aplicado inteiro a cada snapshot. Substituir a lista local pela remota fazia uma
// tarefa recém-criada **desaparecer segundos depois**: o snapshot chegava gravado por um
// dispositivo (ou por um estado da nuvem) que ainda não conhecia a tarefa nova — e o push
// dela ou ainda estava no debounce de 1,5s, ou tinha sido engolido pela trava `cloudReady`.
// A mesclagem troca "o remoto vence sempre" por "cada item vence pelo relógio":
//
// - item nos dois lados      → fica o de `updatedAt` mais novo (empate: remoto);
// - item só no remoto        → entra, a menos que tenha sido excluído aqui depois de o
//                              documento remoto ser gravado (registro de exclusões abaixo);
// - item só no local         → fica, se for mais novo que o documento remoto (o remoto não
//                              podia conhecê-lo) ou se ainda não subiu num push desta sessão;
//                              senão, foi excluído noutro dispositivo e cai;
// - lista remota vazia       → mantém a local inteira (regra pré-existente: um documento
//                              parcial/corrompido nunca apaga o trabalho — ver comentário
//                              original em `applyRemoteSnapshot`).
//
// `margemMs` absorve diferença de relógio entre dispositivos: na dúvida (timestamps a menos
// de 5 min um do outro), a mesclagem prefere **manter** o item — um item mantido a mais se
// corrige no próximo push; um item descartado a mais é trabalho perdido.
//
// Limitação conhecida (aceita): um item editado offline numa sessão anterior, fechada antes
// do push, e mais velho que o documento remoto pode ser interpretado como exclusão remota.
// A janela real é o debounce de 1,5s do push — pequena o bastante para não valer um
// controle de pendência por item.

export interface ItemSincronizavel {
  id: string
  updatedAt?: string
  createdAt?: string
}

export interface ResultadoMescla<T> {
  itens: T[]
  /** O resultado difere do remoto (item local mantido/vencedor ou exclusão local aplicada) → re-push. */
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
  opts: { exclusoes?: Record<string, number>; ultimoPushOk?: number; margemMs?: number } = {},
): ResultadoMescla<T> {
  const { exclusoes = {}, ultimoPushOk = Number.MAX_SAFE_INTEGER, margemMs = MARGEM_RELOGIO_MS } = opts

  if (remoto.length === 0) return { itens: local, manteveLocal: local.length > 0 }

  const locaisPorId = new Map(local.map(i => [i.id, i]))
  const itens: T[] = []
  let manteveLocal = false

  for (const r of remoto) {
    const l = locaisPorId.get(r.id)
    if (l) {
      if (tsItem(l) > tsItem(r)) { itens.push(l); manteveLocal = true }
      else itens.push(r)
      locaisPorId.delete(r.id)
      continue
    }
    // Só no remoto: excluído aqui depois (ou quase junto) da gravação do documento?
    const excluidoEm = exclusoes[r.id]
    if (excluidoEm !== undefined && excluidoEm > remotoGravadoEm - margemMs) {
      manteveLocal = true   // a exclusão local precisa voltar para a nuvem
      continue
    }
    itens.push(r)
  }

  for (const l of local) {
    if (!locaisPorId.has(l.id)) continue
    // Só no local: novo demais para o remoto conhecer, ou ainda não subiu nesta sessão.
    if (tsItem(l) > remotoGravadoEm - margemMs || tsItem(l) > ultimoPushOk) {
      itens.push(l); manteveLocal = true
    }
    // senão: excluído noutro dispositivo — cai de propósito.
  }

  return { itens, manteveLocal }
}

// ── Registro de exclusões (tombstones) ────────────────────────────────────
// Guarda `id → quando` das exclusões feitas neste navegador, para um snapshot gravado
// **antes** da exclusão não ressuscitar o item na janela entre excluir e o push subir.
// A propagação da exclusão entre dispositivos não depende disto — ela vai no próprio
// documento (o item simplesmente não está mais lá).

const EXCLUSOES_KEY = 'tf_exclusoes_recentes'
const EXCLUSOES_MAX = 500
const EXCLUSOES_TTL_MS = 7 * 24 * 60 * 60_000

function lerExclusoes(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(EXCLUSOES_KEY) ?? '{}') ?? {} }
  catch { return {} }
}
function gravarExclusoes(map: Record<string, number>) {
  try { localStorage.setItem(EXCLUSOES_KEY, JSON.stringify(map)) } catch { /* sem localStorage (testes) */ }
}

export function registrarExclusoes(ids: string[]) {
  if (!ids.length) return
  const agora = Date.now()
  const map = lerExclusoes()
  ids.forEach(id => { map[id] = agora })
  // Poda: fora do TTL e, se ainda assim passar do teto, as mais antigas primeiro.
  let entradas = Object.entries(map).filter(([, at]) => agora - at < EXCLUSOES_TTL_MS)
  if (entradas.length > EXCLUSOES_MAX) entradas = entradas.sort((a, b) => b[1] - a[1]).slice(0, EXCLUSOES_MAX)
  gravarExclusoes(Object.fromEntries(entradas))
}

/** Desfazer restaurou itens → a exclusão registrada deixa de valer. */
export function cancelarExclusoes(ids: string[]) {
  if (!ids.length) return
  const map = lerExclusoes()
  let mudou = false
  ids.forEach(id => { if (id in map) { delete map[id]; mudou = true } })
  if (mudou) gravarExclusoes(map)
}

export function obterExclusoes(): Record<string, number> { return lerExclusoes() }

// ── Marcação do último push bem-sucedido ─────────────────────────────────
// Começa no carregamento do app: tudo que for criado/alterado daqui em diante e ainda não
// subiu é "desta sessão" e a mesclagem o protege mesmo contra um documento remoto de
// relógio adiantado.

let ultimoPushOk = Date.now()
export function marcarPushConcluido() { ultimoPushOk = Date.now() }
export function obterUltimoPushOk() { return ultimoPushOk }
