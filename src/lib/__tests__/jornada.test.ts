import { describe, it, expect } from 'vitest'
import { montarJornada } from '../jornada'
import type { Task } from '../../types'

const AGORA = new Date('2026-10-13T12:00:00')
const CRIADO = '2026-09-01T10:00:00.000Z'
function t(p: Partial<Task> & { id: string; title: string }): Task {
  return {
    workspaceId: 'ws', projectId: 'p1', parentId: null, description: '', blocks: [],
    status: 'todo', priority: 'medium', taskType: 'task', dueDate: null, assignee: '',
    tags: [], checklists: [], customFields: {}, comments: [], createdAt: CRIADO, updatedAt: CRIADO,
    ...p,
  } as Task
}
const marco = (p: Partial<Task> & { id: string; title: string }) => t({ taskType: 'milestone', ...p })

describe('montarJornada', () => {
  it('passado em ordem de conclusão, futuro por prazo, sem prazo no fim', () => {
    const j = montarJornada([
      marco({ id: 'semPrazo', title: 'Sem prazo' }),
      marco({ id: 'nov', title: 'Novembro', dueDate: '2026-11-20' }),
      marco({ id: 'f2', title: 'Fechado depois', status: 'done', completedAt: '2026-09-20T10:00:00Z' }),
      marco({ id: 'out', title: 'Outubro', dueDate: '2026-10-30' }),
      marco({ id: 'f1', title: 'Fechado antes', status: 'done', completedAt: '2026-09-10T10:00:00Z' }),
    ], AGORA)
    expect(j.marcos.map(m => m.marco.id)).toEqual(['f1', 'f2', 'out', 'nov', 'semPrazo'])
    expect(j.marcos.map(m => m.fase)).toEqual(['feito', 'feito', 'atual', 'adiante', 'adiante'])
    expect(j.atualIdx).toBe(2)
    expect(j.chegada).toBe('2026-11-20')
  })

  it('próximo passo prefere o que já está em andamento', () => {
    const j = montarJornada([
      marco({ id: 'm', title: 'Fase 1' }),
      t({ id: 'a', title: 'A fazer com prazo', parentId: 'm', dueDate: '2026-10-14' }),
      t({ id: 'b', title: 'Em andamento', parentId: 'm', status: 'in_progress' }),
      t({ id: 'c', title: 'Feita', parentId: 'm', status: 'done' }),
    ], AGORA)
    const m = j.marcos[0]
    expect(m.proximoPasso?.id).toBe('b')
    expect(m.tarefas.map(x => x.id)).toEqual(['b', 'a', 'c'])
    expect([m.feitas, m.total, m.pct]).toEqual([1, 3, 33])
  })

  it('tarefa principal fora de marco vai para "sem marco"; subtarefa de marco não', () => {
    const j = montarJornada([
      marco({ id: 'm', title: 'Fase' }),
      t({ id: 'dentro', title: 'Dentro', parentId: 'm' }),
      t({ id: 'solta', title: 'Solta' }),
      t({ id: 'netaDaSolta', title: 'Filha da solta', parentId: 'solta' }),
    ], AGORA)
    expect(j.semMarco.map(x => x.id)).toEqual(['solta'])
  })

  it('todos concluídos: não há marco atual', () => {
    const j = montarJornada([marco({ id: 'm', title: 'Fim', status: 'done' })], AGORA)
    expect(j.atualIdx).toBe(-1)
    expect(j.marcos[0].pct).toBe(100)
  })

  it('marco aberto com prazo vencido fica atrasado; vencer hoje não', () => {
    const j = montarJornada([
      marco({ id: 'v', title: 'Venceu', dueDate: '2026-10-10' }),
      marco({ id: 'h', title: 'Hoje', dueDate: '2026-10-13' }),
    ], AGORA)
    expect(j.marcos.map(m => m.atrasado)).toEqual([true, false])
  })

  it('início é a tarefa mais antiga; entregues conta só marcos fechados', () => {
    const j = montarJornada([
      marco({ id: 'f', title: 'Fechado', status: 'done', createdAt: '2026-08-05T10:00:00.000Z' }),
      t({ id: 'x', title: 'Entregue', parentId: 'f', status: 'done' }),
      marco({ id: 'a', title: 'Aberto' }),
      t({ id: 'y', title: 'Feita no aberto', parentId: 'a', status: 'done' }),
    ], AGORA)
    expect(j.inicio).toBe('2026-08-05T10:00:00.000Z')
    expect(j.entregues).toBe(1)
  })
})
