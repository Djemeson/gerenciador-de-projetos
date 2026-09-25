import { describe, it, expect } from 'vitest'
import { removerExemplosAntigos } from '../exemplosAntigos'

const projeto = (id: string, name: string) => ({ id, name } as any)
const tarefa = (id: string, projectId: string) => ({ id, projectId } as any)

describe('removerExemplosAntigos', () => {
  it('remove o exemplo intocado junto com as tarefas de demonstração', () => {
    const r = removerExemplosAntigos(
      [projeto('p1', 'Lançamento v2.0'), projeto('abc', 'Rede Norte')],
      [tarefa('t1', 'p1'), tarefa('t9', 'p1'), tarefa('x', 'abc')],
    )
    expect(r.projects.map(p => p.id)).toEqual(['abc'])
    expect(r.tasks.map(t => t.id)).toEqual(['x'])
    expect(r.removidos.sort()).toEqual(['p1', 't1', 't9'])
  })

  it('mantém exemplo renomeado ou com tarefa real dentro', () => {
    const r = removerExemplosAntigos(
      [projeto('p1', 'Meu lançamento'), projeto('p2', 'Suporte ao Cliente')],
      [tarefa('t7', 'p2'), tarefa('real', 'p2')],
    )
    expect(r.removidos).toEqual([])
    expect(r.projects).toHaveLength(2)
  })

  it('não mexe em projeto real que por acaso tem id curto', () => {
    const r = removerExemplosAntigos([projeto('p3', 'Financeiro')], [])
    expect(r.removidos).toEqual([])
  })
})
