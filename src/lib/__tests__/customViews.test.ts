import { describe, it, expect } from 'vitest'
import { applyCustomViewFilter } from '../customViews'
import type { CustomProjectView, Task } from '../../types'

const DIA = 86_400_000
const emDias = (n: number) => new Date(Date.now() + n * DIA).toISOString()

function tarefa(patch: Partial<Task> = {}): Task {
  return {
    id: 'k1', workspaceId: 'w', projectId: 'p1', parentId: null, title: 'T', description: '',
    blocks: [], status: 'todo', priority: 'medium', taskType: 'task', dueDate: null,
    assignee: '', tags: [], checklists: [], customFields: {}, comments: [],
    createdAt: emDias(-10), updatedAt: emDias(-1), completedAt: null, ...patch,
  }
}

function visao(patch: Partial<CustomProjectView> = {}): CustomProjectView {
  return { id: 'v1', name: 'V', icon: 'list', baseType: 'list', ...patch }
}

describe('applyCustomViewFilter — status', () => {
  const lista = [
    tarefa({ id: 'a', status: 'todo' }),
    tarefa({ id: 'b', status: 'in_progress' }),
    tarefa({ id: 'c', status: 'done', completedAt: emDias(-1) }),
  ]

  it('sem filtro (ou "all") devolve tudo', () => {
    expect(applyCustomViewFilter(lista, visao())).toHaveLength(3)
    expect(applyCustomViewFilter(lista, visao({ filterStatus: 'all' }))).toHaveLength(3)
  })

  it('status exato filtra por igualdade', () => {
    const r = applyCustomViewFilter(lista, visao({ filterStatus: 'done' }))
    expect(r.map(t => t.id)).toEqual(['c'])
  })

  it('"open" = tudo que não está concluído (A fazer + Em progresso)', () => {
    const r = applyCustomViewFilter(lista, visao({ filterStatus: 'open' }))
    expect(r.map(t => t.id)).toEqual(['a', 'b'])
  })
})

describe('applyCustomViewFilter — prioridade, responsável e tags', () => {
  const lista = [
    tarefa({ id: 'a', priority: 'urgent', assignee: 'DJ',  tags: ['fibra'] }),
    tarefa({ id: 'b', priority: 'low',    assignee: 'Ana', tags: ['fibra', 'suporte'] }),
    tarefa({ id: 'c', priority: 'urgent', assignee: '',    tags: [] }),
  ]

  it('prioridade filtra por igualdade; "all" não filtra', () => {
    expect(applyCustomViewFilter(lista, visao({ filterPriority: 'urgent' })).map(t => t.id)).toEqual(['a', 'c'])
    expect(applyCustomViewFilter(lista, visao({ filterPriority: 'all' }))).toHaveLength(3)
  })

  it('responsável filtra pelo nome exato', () => {
    expect(applyCustomViewFilter(lista, visao({ filterAssignee: 'Ana' })).map(t => t.id)).toEqual(['b'])
  })

  it('tags: entra quem tem QUALQUER uma das selecionadas', () => {
    expect(applyCustomViewFilter(lista, visao({ filterTags: ['suporte'] })).map(t => t.id)).toEqual(['b'])
    expect(applyCustomViewFilter(lista, visao({ filterTags: ['fibra', 'suporte'] })).map(t => t.id)).toEqual(['a', 'b'])
  })

  it('lista de tags vazia não filtra nada', () => {
    expect(applyCustomViewFilter(lista, visao({ filterTags: [] }))).toHaveLength(3)
  })

  it('tarefa sem array de tags (dado antigo) não quebra', () => {
    const velha = tarefa({ id: 'x' })
    // Simula registro antigo vindo do armazenamento sem o campo.
    delete (velha as any).tags
    expect(applyCustomViewFilter([velha], visao({ filterTags: ['fibra'] }))).toHaveLength(0)
  })

  it('filtros combinados são interseção (E)', () => {
    const r = applyCustomViewFilter(lista, visao({ filterPriority: 'urgent', filterTags: ['fibra'] }))
    expect(r.map(t => t.id)).toEqual(['a'])
  })
})

describe('applyCustomViewFilter — período', () => {
  it('período aplica sobre o campo de data escolhido', () => {
    const lista = [
      tarefa({ id: 'a', status: 'done', completedAt: emDias(0) }),
      tarefa({ id: 'b', status: 'done', completedAt: emDias(-40) }),
    ]
    const r = applyCustomViewFilter(lista, visao({
      filterStatus: 'done', dateField: 'completedAt', datePeriod: { period: 'last_30_days' },
    }))
    expect(r.map(t => t.id)).toEqual(['a'])
  })

  it('compatibilidade: filterDaysBack antigo ainda funciona quando não há datePeriod', () => {
    const lista = [
      tarefa({ id: 'a', updatedAt: emDias(-2) }),
      tarefa({ id: 'b', updatedAt: emDias(-20) }),
    ]
    const r = applyCustomViewFilter(lista, visao({ filterDaysBack: 7 }))
    expect(r.map(t => t.id)).toEqual(['a'])
  })
})
