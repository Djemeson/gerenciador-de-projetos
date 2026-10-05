// Formato da conta no Firestore — um documento por tarefa e por projeto (formato 2).
//
// Antes (formato 1) a conta inteira era um documento só, `syncGroups/{uid}`, com as listas
// `tasks` e `projects` dentro. O Firestore limita cada documento a 1 MiB, e passar dele faz
// a gravação falhar inteira: a conta toda parava de sincronizar. Agora:
//
//   syncGroups/{uid}                 → documento principal: espaços, pastas, metas, notas,
//                                      configurações, contadores, exclusões recentes e a
//                                      ORDEM das tarefas e dos projetos (`ordemTarefas`,
//                                      `ordemProjetos` — só ids)
//   syncGroups/{uid}/tarefas/{id}    → uma tarefa
//   syncGroups/{uid}/projetos/{id}   → um projeto
//
// O teto passa a ser 1 MiB POR TAREFA, e cada envio só grava o que mudou.
//
// Este arquivo é puro (sem Firestore): é usado pelo app (src/stores/useAppStore.ts) e pelo
// conector do Claude (functions/src/conector.ts), para os dois montarem e desmontarem a
// conta exatamente do mesmo jeito.
//
// Compatibilidade: um aparelho com a versão antiga do app ainda aberta grava o documento
// principal inteiro com as listas dentro (formato 1). `montarLista` junta essa lista
// "legada" com as coleções em vez de ignorá-la — a edição feita nele não se perde — e o
// próximo envio de um aparelho atualizado devolve tudo ao formato 2.

export const FORMATO_ATUAL = 2
export const COLECAO_TAREFAS = 'tarefas'
export const COLECAO_PROJETOS = 'projetos'

export interface ItemConta { id: string; updatedAt?: string; createdAt?: string; [k: string]: any }

const ts = (s?: string) => {
  const n = s ? Date.parse(s) : 0
  return Number.isFinite(n) ? n : 0
}
const tsItem = (i: ItemConta) => Math.max(ts(i.updatedAt), ts(i.createdAt))

/**
 * Remonta uma lista (tarefas ou projetos) a partir do que está no servidor:
 * - `colecao`: os documentos da subcoleção (formato 2);
 * - `ordem`: os ids na ordem da lista, guardados no documento principal;
 * - `legado`: a lista que um aparelho com versão antiga deixou dentro do documento
 *   principal. Entra quando o item não existe na coleção ou é mais novo que o de lá;
 *   não entra se foi excluído depois da última edição (senão o aparelho antigo
 *   ressuscitaria o que o novo apagou).
 * Ordem do resultado: a de `ordem`; o que não estiver nela vem depois, na ordem do legado
 * e depois pelo número curto (seq) — estável entre aparelhos.
 */
export function montarLista<T extends ItemConta>(
  colecao: T[],
  ordem: string[] | undefined,
  legado: T[] | undefined,
  excluidos: Record<string, number> = {},
): T[] {
  const porId = new Map(colecao.map(i => [i.id, i]))
  for (const l of Array.isArray(legado) ? legado : []) {
    if (!l || typeof l.id !== 'string') continue
    const excluidoEm = excluidos[l.id]
    const atual = porId.get(l.id)
    if (atual) { if (tsItem(l) > tsItem(atual)) porId.set(l.id, l); continue }
    if (excluidoEm !== undefined && excluidoEm >= tsItem(l)) continue
    porId.set(l.id, l)
  }

  const resultado: T[] = []
  const usados = new Set<string>()
  const pegar = (id: string) => {
    const i = porId.get(id)
    if (i && !usados.has(id)) { resultado.push(i); usados.add(id) }
  }
  ;(ordem ?? []).forEach(pegar)
  ;(Array.isArray(legado) ? legado : []).forEach(l => l && pegar(l.id))
  ;[...porId.values()]
    .filter(i => !usados.has(i.id))
    .sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || tsItem(a) - tsItem(b))
    .forEach(i => pegar(i.id))
  return resultado
}

/**
 * Assinatura estável do conteúdo de um item (chaves ordenadas, `undefined` fora): é o que
 * decide se o item mudou desde a última vez que o servidor o viu. Ordem de chaves diferente
 * (objeto vindo do Firestore × criado no app) não conta como mudança.
 */
export function assinatura(valor: unknown): string {
  return JSON.stringify(valor, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce((o, k) => { if (v[k] !== undefined) o[k] = v[k]; return o }, {} as Record<string, unknown>)
    }
    return v
  })
}

/** Mapa id → assinatura, do jeito que o servidor tem hoje. */
export const assinaturasDe = (itens: ItemConta[]) => new Map(itens.map(i => [i.id, assinatura(i)]))

/**
 * O que gravar e o que apagar para o servidor ficar igual a `itens`, sabendo o que ele já
 * tem (`noServidor`, id → assinatura). Item ausente de `itens` mas presente no servidor foi
 * excluído aqui — a exclusão em si já foi decidida pela mescla (syncMerge.ts) ou pela
 * ferramenta do conector.
 */
export function diferenca<T extends ItemConta>(noServidor: Map<string, string>, itens: T[]): { gravar: T[]; apagar: string[] } {
  const ids = new Set(itens.map(i => i.id))
  return {
    gravar: itens.filter(i => noServidor.get(i.id) !== assinatura(i)),
    apagar: [...noServidor.keys()].filter(id => !ids.has(id)),
  }
}

/** Documento principal ainda no formato antigo (listas dentro dele)? Precisa ser convertido. */
export const ehFormatoAntigo = (principal: Record<string, unknown> | undefined) =>
  !!principal && (Array.isArray(principal.tasks) || Array.isArray(principal.projects) || principal.formato !== FORMATO_ATUAL)
