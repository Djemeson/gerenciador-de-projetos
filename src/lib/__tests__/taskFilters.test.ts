import { describe, it, expect } from 'vitest'
import { somentePendentes } from '../taskFilters'
import type { Task } from '../../types'

const AGORA = new Date('2026-08-01T12:00:00Z').toISOString()
function t(p: Partial<Task> & { id: string; title: string }): Task {
  return {
    workspaceId: 'ws', projectId: 'p1', parentId: null, description: '', blocks: [],
    status: 'todo', priority: 'medium', taskType: 'task', dueDate: null, assignee: '',
    tags: [], checklists: [], customFields: {}, comments: [], createdAt: AGORA, updatedAt: AGORA,
    ...p,
  } as Task
}

describe('somentePendentes', () => {
  it('tira as concluídas', () => {
    const r = somentePendentes([t({ id:'a', title:'Feita', status:'done' }), t({ id:'b', title:'Aberta' })])
    expect(r.map(x => x.title)).toEqual(['Aberta'])
  })

  // A regra que não é óbvia: descartar o pai concluído levaria junto a subtarefa que falta.
  it('mantém a concluída que ainda tem pendência abaixo', () => {
    const pai   = t({ id:'p', title:'Pai fechado cedo', status:'done' })
    const filha = t({ id:'f', title:'Falta esta', parentId:'p' })
    const r = somentePendentes([pai, filha])
    expect(r.map(x => x.title).sort()).toEqual(['Falta esta', 'Pai fechado cedo'])
  })

  it('descarta a concluída cuja subárvore está toda concluída', () => {
    const pai   = t({ id:'p', title:'Pai', status:'done' })
    const filha = t({ id:'f', title:'Filha', parentId:'p', status:'done' })
    expect(somentePendentes([pai, filha])).toEqual([])
  })

  it('enxerga pendência a dois níveis de distância', () => {
    const avo  = t({ id:'a', title:'Avo',  status:'done' })
    const mae  = t({ id:'m', title:'Mae',  parentId:'a', status:'done' })
    const neta = t({ id:'n', title:'Neta', parentId:'m' })
    expect(somentePendentes([avo, mae, neta]).map(x => x.title).sort())
      .toEqual(['Avo', 'Mae', 'Neta'])
  })

  it('dado com ciclo não trava', () => {
    const a = t({ id:'a', title:'A', parentId:'b', status:'done' })
    const b = t({ id:'b', title:'B', parentId:'a', status:'done' })
    expect(() => somentePendentes([a, b])).not.toThrow()
  })

  it('lista vazia devolve vazia', () => {
    expect(somentePendentes([])).toEqual([])
  })
})
