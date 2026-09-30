// IDs curtos e legíveis: T-142 para tarefa (subtarefa incluída), P-12 para projeto.
//
// Regras (DIRETRIZES.md, seção 17):
// - um número por conta, não por projeto — mover a tarefa de projeto não muda o ID;
// - nunca muda e nunca se repete: o contador só anda para a frente, e o número de um item
//   excluído não volta a ser usado (por isso o contador é guardado, não derivado do maior
//   número existente);
// - o que já existia recebe o número em ordem de criação (a mais antiga vira T-1).
//
// Este arquivo é puro de propósito: roda no navegador (store) e no servidor (conector do
// Claude em api/), e o resultado precisa ser o mesmo nos dois — e em qualquer aparelho que
// numere a mesma lista, para que dois aparelhos que façam o backfill ao mesmo tempo
// cheguem aos mesmos números sem combinar nada.

export type TipoId = 'task' | 'project'
export interface Contadores { task: number; project: number }

export const PREFIXO_ID: Record<TipoId, string> = { task: 'T', project: 'P' }
export const CONTADORES_VAZIOS: Contadores = { task: 0, project: 0 }

export interface ItemNumeravel { id: string; seq?: number; createdAt?: string }

export function formatarId(tipo: TipoId, seq: number | undefined): string {
  return typeof seq === 'number' && seq > 0 ? `${PREFIXO_ID[tipo]}-${seq}` : ''
}

/** Aceita "T-142", "t142", "#T-142", "T 142". Devolve null se não for um ID curto. */
export function lerIdCurto(texto: string): { tipo: TipoId; seq: number } | null {
  const m = /^#?\s*([TPtp])\s*-?\s*(\d+)$/.exec(String(texto ?? '').trim())
  if (!m) return null
  const seq = Number(m[2])
  if (!Number.isSafeInteger(seq) || seq <= 0) return null
  return { tipo: m[1].toUpperCase() === 'T' ? 'task' : 'project', seq }
}

const seqValido = (s: unknown): s is number => typeof s === 'number' && Number.isSafeInteger(s) && s > 0

/** Ordem de chegada: createdAt, com o id como desempate (determinístico entre aparelhos). */
function antes(a: ItemNumeravel, b: ItemNumeravel): number {
  const ca = a.createdAt ?? '', cb = b.createdAt ?? ''
  if (ca !== cb) return ca < cb ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Garante que todo item tem um número único. Itens sem número (novos, ou anteriores à
 * funcionalidade) recebem o próximo do contador, em ordem de criação. Número repetido —
 * dois aparelhos sem internet criando ao mesmo tempo, ou cópia de um item — fica com o
 * item mais antigo; o mais novo ganha o próximo livre.
 *
 * Não mexe em `updatedAt`: numerar não é editar, e a numeração é determinística, então
 * aparelhos que numerem a mesma lista chegam ao mesmo resultado sem precisar "vencer" a
 * mesclagem. Itens inalterados mantêm a mesma referência.
 */
export function numerar<T extends ItemNumeravel>(itens: T[], contador: number): { itens: T[]; contador: number; mudou: boolean } {
  let maior = seqValido(contador) ? contador : 0
  for (const it of itens) if (seqValido(it.seq) && it.seq > maior) maior = it.seq

  const dono = new Map<number, T>()
  for (const it of itens) {
    if (!seqValido(it.seq)) continue
    const atual = dono.get(it.seq)
    if (!atual || antes(it, atual) < 0) dono.set(it.seq, it)
  }
  const semNumero = itens.filter(it => !seqValido(it.seq) || dono.get(it.seq) !== it).sort(antes)
  if (semNumero.length === 0) return { itens, contador: maior, mudou: maior !== contador }

  const novo = new Map<T, number>()
  for (const it of semNumero) novo.set(it, ++maior)
  return {
    itens: itens.map(it => (novo.has(it) ? { ...it, seq: novo.get(it)! } : it)),
    contador: maior,
    mudou: true,
  }
}

export function mesclarContadores(a: Partial<Contadores> | undefined, b: Partial<Contadores> | undefined): Contadores {
  const n = (v: unknown) => (seqValido(v) ? v : 0)
  return { task: Math.max(n(a?.task), n(b?.task)), project: Math.max(n(a?.project), n(b?.project)) }
}
