import type { Task } from '../types'

/**
 * Decide quais tarefas entram quando se quer ver **só o que falta fazer**.
 *
 * Usado em dois lugares que precisam da mesma regra: o botão "Ocultar concluídas" da lista
 * e a exportação em Markdown. Mora aqui, e não em um deles, porque a regra é a mesma e
 * divergir seria pior que duplicar.
 *
 * Concluída sai. A exceção não é capricho: uma tarefa marcada como concluída pode ter
 * **subtarefa pendente** abaixo dela (acontece quando alguém fecha o pai antes da hora).
 * Descartá-la levaria a pendente junto, e o trabalho que falta sumiria da tela sem aviso.
 * Nesse caso ela fica, como caminho até a pendente — e o `[x]` no pai com `[ ]` na filha
 * deixa a inconsistência visível em vez de escondida.
 */
export function criarFiltroDePendentes(filhasDe: (id: string) => Task[]) {
  const cache = new Map<string, boolean>()

  const temPendenteAbaixo = (id: string, visitados = new Set<string>()): boolean => {
    if (cache.has(id)) return cache.get(id)!
    if (visitados.has(id)) return false   // guarda contra ciclo em dado corrompido
    visitados.add(id)
    const r = filhasDe(id).some(f => f.status !== 'done' || temPendenteAbaixo(f.id, visitados))
    cache.set(id, r)
    return r
  }

  return (t: Task): boolean => t.status !== 'done' || temPendenteAbaixo(t.id)
}

/** Conveniência: aplica o filtro a uma lista, resolvendo os filhos dentro dela mesma. */
export function somentePendentes(tarefas: Task[]): Task[] {
  const porPai = new Map<string, Task[]>()
  for (const t of tarefas) {
    if (!t.parentId) continue
    const l = porPai.get(t.parentId) ?? []
    l.push(t)
    porPai.set(t.parentId, l)
  }
  const manter = criarFiltroDePendentes(id => porPai.get(id) ?? [])
  return tarefas.filter(manter)
}
