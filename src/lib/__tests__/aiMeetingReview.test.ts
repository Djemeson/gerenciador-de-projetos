import { describe, it, expect } from 'vitest'
import { buildLocalMeetingReview, type MeetingReviewInput } from '../aiMeetingReview'
import type { Task } from '../../types'

function tarefa(patch: Partial<Task> = {}): Task {
  return {
    id: 'k1', workspaceId: 'w', projectId: 'p1', parentId: null, title: 'T', description: '',
    blocks: [], status: 'todo', priority: 'medium', taskType: 'task', dueDate: null,
    assignee: '', tags: [], checklists: [], customFields: {}, comments: [],
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', completedAt: null, ...patch,
  }
}

function entrada(patch: Partial<MeetingReviewInput> = {}): MeetingReviewInput {
  return {
    periodLabel: 'Esta semana', doneNow: [], donePrevCount: 0, createdCount: 0,
    overdue: [], urgentOpen: [], dueSoon: [],
    projects: [{ id: 'p1', name: 'Fibra Zona Sul' }, { id: 'p2', name: 'Suporte' }],
    ...patch,
  }
}

describe('buildLocalMeetingReview', () => {
  it('período vazio diz que nada foi concluído e que não há pontos de atenção', () => {
    const txt = buildLocalMeetingReview(entrada())
    expect(txt).toContain('Esta semana')
    expect(txt).toContain('Nenhuma tarefa foi concluída')
    expect(txt).toContain('Sem pontos de atenção')
  })

  it('compara com o período anterior (acima / abaixo / mesmo ritmo)', () => {
    const done = [tarefa({ id: 'a', status: 'done' }), tarefa({ id: 'b', status: 'done' })]
    expect(buildLocalMeetingReview(entrada({ doneNow: done, donePrevCount: 1 }))).toContain('acima das 1')
    expect(buildLocalMeetingReview(entrada({ doneNow: done, donePrevCount: 5 }))).toContain('abaixo das 5')
    expect(buildLocalMeetingReview(entrada({ doneNow: done, donePrevCount: 2 }))).toContain('mesmo ritmo')
  })

  it('agrupa as entregas por projeto, maior primeiro, com os títulos', () => {
    const done = [
      tarefa({ id: 'a', status: 'done', projectId: 'p2', title: 'Chamado 1' }),
      tarefa({ id: 'b', status: 'done', projectId: 'p2', title: 'Chamado 2' }),
      tarefa({ id: 'c', status: 'done', projectId: 'p1', title: 'Instalar CTO' }),
    ]
    const txt = buildLocalMeetingReview(entrada({ doneNow: done }))
    expect(txt).toContain('Principais entregas:')
    expect(txt.indexOf('Suporte')).toBeLessThan(txt.indexOf('Fibra Zona Sul'))
    expect(txt).toContain('"Chamado 1"')
    expect(txt).toContain('"Instalar CTO"')
  })

  it('lista atrasadas e urgentes como pontos de atenção, com truncamento', () => {
    const atrasadas = [1, 2, 3, 4, 5].map(n => tarefa({ id: 'x' + n, title: 'Atrasada ' + n, dueDate: '2026-01-01' }))
    const txt = buildLocalMeetingReview(entrada({ overdue: atrasadas, urgentOpen: [tarefa({ id: 'u', title: 'Roteador queimado', priority: 'urgent' })] }))
    expect(txt).toContain('5 em atraso')
    expect(txt).toContain('e mais 2')
    expect(txt).toContain('1 urgente em aberto: "Roteador queimado"')
  })

  it('mostra os próximos 7 dias com a data curta', () => {
    const txt = buildLocalMeetingReview(entrada({ dueSoon: [tarefa({ id: 'd', title: 'Visita técnica', dueDate: '2026-08-03' })] }))
    expect(txt).toContain('Próximos 7 dias:')
    expect(txt).toContain('Visita técnica (03/08)')
  })

  it('sinaliza quando entrou mais trabalho do que saiu', () => {
    const txt = buildLocalMeetingReview(entrada({ doneNow: [tarefa({ id: 'a', status: 'done' })], createdCount: 4 }))
    expect(txt).toContain('entrou mais trabalho do que saiu')
  })
})
