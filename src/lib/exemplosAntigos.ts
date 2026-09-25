// Limpeza dos projetos de exemplo que o app criava sozinho.
//
// Até setembro/2026 o `init()` semeava quatro projetos de demonstração (p1–p4) sempre que a
// lista local estava vazia — e registrava os quatro como "pendentes de push". Resultado: a
// cada navegador novo, cache limpo ou lista esvaziada, os exemplos nasciam de novo, a
// mesclagem os protegia (pendência nunca cai) e o push os devolvia à nuvem. Excluir não
// adiantava: voltavam na próxima abertura. A semeadura foi removida; este módulo apaga os
// exemplos que já foram parar na conta.
//
// Só sai o exemplo **intocado**: id e nome originais e nenhuma tarefa além das de
// demonstração. Projeto renomeado, ou com uma tarefa real dentro, fica — virou do usuário.

import type { Project, Task } from '../types'

const PROJETOS_EXEMPLO: Record<string, string> = {
  p1: 'Lançamento v2.0',
  p2: 'Suporte ao Cliente',
  p3: 'Marketing Q3',
  p4: 'Infraestrutura',
}
const TAREFAS_EXEMPLO = new Set(Array.from({ length: 12 }, (_, i) => `t${i + 1}`))

export interface ResultadoLimpeza {
  projects: Project[]
  tasks: Task[]
  /** Ids removidos (projetos e tarefas) — viram exclusão registrada para a nuvem não devolver. */
  removidos: string[]
}

export function removerExemplosAntigos(projects: Project[], tasks: Task[]): ResultadoLimpeza {
  const alvo = new Set(projects
    .filter(p => PROJETOS_EXEMPLO[p.id] === p.name)
    .filter(p => tasks.every(t => t.projectId !== p.id || TAREFAS_EXEMPLO.has(t.id)))
    .map(p => p.id))
  if (alvo.size === 0) return { projects, tasks, removidos: [] }

  const tarefasFora = tasks.filter(t => alvo.has(t.projectId)).map(t => t.id)
  return {
    projects: projects.filter(p => !alvo.has(p.id)),
    tasks: tasks.filter(t => !alvo.has(t.projectId)),
    removidos: [...alvo, ...tarefasFora],
  }
}
