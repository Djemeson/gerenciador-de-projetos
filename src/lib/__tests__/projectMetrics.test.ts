import { describe, it, expect } from 'vitest'
import { projectHealth, groupBySpace, sortProjects, PROJECT_IDLE_DAYS } from '../projectMetrics'
import type { Project, Task, Space, Folder } from '../../types'
import { calcGUT } from '../../types'

const DIA = 86_400_000
const emDias = (n: number) => new Date(Date.now() + n * DIA).toISOString()
const dataEmDias = (n: number) => emDias(n).slice(0, 10)

function projeto(patch: Partial<Project> = {}): Project {
  return {
    id: 'p1', name: 'Projeto', color: '#6366F1', description: '', workspaceId: 'w',
    spaceId: null, folderId: null, gut: calcGUT(2, 2, 2), archived: false,
    columns: [], activeView: 'list', taskOpenMode: 'center', customViews: [],
    createdAt: emDias(-60), updatedAt: emDias(-1), ...patch,
  }
}
function tarefa(patch: Partial<Task> = {}): Task {
  return {
    id: 'k1', workspaceId: 'w', projectId: 'p1', parentId: null, title: 'T', description: '',
    blocks: [], status: 'todo', priority: 'medium', taskType: 'task', dueDate: null,
    assignee: '', tags: [], checklists: [], customFields: {}, comments: [],
    createdAt: emDias(-10), updatedAt: emDias(-1), completedAt: null, ...patch,
  }
}

describe('projectHealth', () => {
  it('projeto sem tarefas é vazio, não saudável', () => {
    expect(projectHealth(projeto(), []).status).toBe('empty')
  })

  it('tudo concluído é concluído', () => {
    const tarefas = [tarefa({ id: 'a', status: 'done' }), tarefa({ id: 'b', status: 'done' })]
    const h = projectHealth(projeto(), tarefas)
    expect(h.status).toBe('done')
    expect(h.progress).toBe(100)
  })

  it('usa FRAÇÃO de atraso, não contagem — 3 em 5 é risco', () => {
    const tarefas = [
      tarefa({ id: 'a', dueDate: dataEmDias(-2) }),
      tarefa({ id: 'b', dueDate: dataEmDias(-3) }),
      tarefa({ id: 'c', dueDate: dataEmDias(-4) }),
      tarefa({ id: 'd', dueDate: dataEmDias(10) }),
      tarefa({ id: 'e', dueDate: dataEmDias(20) }),
    ]
    expect(projectHealth(projeto(), tarefas).status).toBe('critical')
  })

  it('e 3 em 50 é apenas atenção — o caso que a tela antiga confundia', () => {
    const atrasadas = [1, 2, 3].map(i => tarefa({ id: `atr${i}`, dueDate: dataEmDias(-i) }))
    const normais = Array.from({ length: 47 }, (_, i) => tarefa({ id: `ok${i}`, dueDate: dataEmDias(30) }))
    expect(projectHealth(projeto(), [...atrasadas, ...normais]).status).toBe('attention')
  })

  it('GUT crítico com qualquer atraso já é risco', () => {
    const critico = projeto({ gut: calcGUT(5, 5, 4) })   // 100
    const tarefas = [tarefa({ id: 'a', dueDate: dataEmDias(-1) }), ...Array.from({ length: 20 }, (_, i) => tarefa({ id: `x${i}` }))]
    expect(projectHealth(critico, tarefas).status).toBe('critical')
  })

  it('sem movimento por muito tempo é parado', () => {
    const antigo = emDias(-(PROJECT_IDLE_DAYS + 10))
    const p = projeto({ updatedAt: antigo })
    const tarefas = [tarefa({ id: 'a', updatedAt: antigo })]
    expect(projectHealth(p, tarefas).status).toBe('idle')
  })

  it('deriva o próximo e o último prazo das tarefas abertas', () => {
    const tarefas = [
      tarefa({ id: 'a', dueDate: dataEmDias(5) }),
      tarefa({ id: 'b', dueDate: dataEmDias(20) }),
      tarefa({ id: 'c', dueDate: dataEmDias(10), status: 'done' }),   // concluída não conta
    ]
    const h = projectHealth(projeto(), tarefas)
    expect(h.nextDue).toBe(dataEmDias(5))
    expect(h.lastDue).toBe(dataEmDias(20))
  })
})

describe('groupBySpace', () => {
  const espacos: Space[] = [
    { id: 's1', name: 'Operação', color: '#378ADD', workspaceId: 'w', collapsed: false, createdAt: emDias(-90), updatedAt: emDias(-90) },
  ]
  const pastas: Folder[] = [
    { id: 'f1', name: 'Rede', spaceId: 's1', collapsed: false, createdAt: emDias(-80), updatedAt: emDias(-80) },
  ]

  it('separa espaço, pasta e sem espaço, mostrando o caminho', () => {
    const projetos = [
      projeto({ id: 'a', spaceId: 's1' }),
      projeto({ id: 'b', spaceId: 's1', folderId: 'f1' }),
      projeto({ id: 'c' }),
    ]
    const grupos = groupBySpace(projetos, espacos, pastas)
    expect(grupos.map(g => g.label)).toEqual(['Operação', 'Operação › Rede', 'Sem espaço'])
    expect(grupos[1].projects.map(p => p.id)).toEqual(['b'])
  })

  it('não cria grupo vazio', () => {
    const grupos = groupBySpace([projeto({ id: 'c' })], espacos, pastas)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].label).toBe('Sem espaço')
  })
})

describe('sortProjects', () => {
  it('risco primeiro traz o projeto crítico na frente', () => {
    const saudavel = projeto({ id: 'ok' })
    const critico  = projeto({ id: 'ruim' })
    const tarefas = [
      tarefa({ id: 'a', projectId: 'ruim', dueDate: dataEmDias(-5) }),
      tarefa({ id: 'b', projectId: 'ok', dueDate: dataEmDias(30) }),
    ]
    expect(sortProjects([saudavel, critico], tarefas, 'risk')[0].id).toBe('ruim')
  })
})
