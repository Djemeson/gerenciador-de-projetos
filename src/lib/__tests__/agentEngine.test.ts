import { describe, it, expect } from 'vitest'
import { buildWorkspaceDigest, AGENT_TEMPLATES, AGENT_CATEGORIES } from '../agentEngine'
import { VIEW_ICON } from '../viewIcons'
import type { Task, Project } from '../../types'
import { calcGUT } from '../../types'

const AGORA = new Date(2026, 6, 30, 9, 0, 0)

function tarefa(patch: Partial<Task> = {}): Task {
  return {
    id: 'k1', workspaceId: 'w', projectId: 'p1', parentId: null, title: 'T', description: '',
    blocks: [], status: 'todo', priority: 'medium', taskType: 'task', dueDate: null,
    assignee: '', tags: [], checklists: [], customFields: {}, comments: [],
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-29T00:00:00.000Z', completedAt: null, ...patch,
  }
}

const projeto = (patch: Partial<Project> = {}): Project => ({
  id: 'p1', name: 'Fibra Zona Sul', color: '#6366F1', description: '', workspaceId: 'w',
  spaceId: null, folderId: null, gut: calcGUT(3, 2, 2), archived: false, columns: [],
  activeView: 'list', taskOpenMode: 'center', customViews: [],
  createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', ...patch,
})

describe('buildWorkspaceDigest', () => {
  it('resume o panorama e marca atraso com todas as letras', () => {
    const d = buildWorkspaceDigest({
      tasks: [
        tarefa({ id: 'a', title: 'Instalar CTO', dueDate: '2026-07-01', priority: 'urgent' }),
        tarefa({ id: 'b', title: 'Doc de rede', status: 'done', completedAt: '2026-07-28T00:00:00.000Z' }),
      ],
      projects: [projeto()], goals: [], now: AGORA,
    })
    expect(d).toContain('1 em atraso, 1 urgentes')
    expect(d).toContain('Projeto "Fibra Zona Sul" (GUT 12)')
    expect(d).toContain('Instalar CTO')
    expect(d).toContain('(ATRASADA)')
    expect(d).toContain('Concluídas nos últimos 7 dias:')
    expect(d).toContain('Doc de rede')
  })

  it('projeto arquivado e subtarefas ficam de fora', () => {
    const d = buildWorkspaceDigest({
      tasks: [tarefa({ id: 'a', projectId: 'p2' }), tarefa({ id: 'sub', parentId: 'a' })],
      projects: [projeto({ id: 'p2', name: 'Arquivado', archived: true })],
      goals: [], now: AGORA,
    })
    expect(d).not.toContain('Arquivado')
  })
})

describe('galeria de modelos', () => {
  it('todo modelo tem categoria, instruções e ícone válido do VIEW_ICON', () => {
    for (const t of AGENT_TEMPLATES) {
      expect(t.instructions.length).toBeGreaterThan(40)
      expect(AGENT_CATEGORIES).toContain(t.category)
      expect(VIEW_ICON[t.icon]).toBeTruthy()
    }
  })

  it('ids são únicos', () => {
    const ids = AGENT_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
