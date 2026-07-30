import { describe, it, expect } from 'vitest'
import { goalHealth, goalProgressOf, targetCurrent, sortGoals, GOAL_IDLE_DAYS } from '../goalMetrics'
import type { Goal, GoalTarget, Task } from '../../types'

// Regras de negócio das metas. O que se testa aqui é justamente o que a tela promete e o
// usuário não consegue verificar sozinho: o status derivado e a contagem por tarefas.

const DIA = 86_400_000
const emDias = (n: number) => new Date(Date.now() + n * DIA).toISOString()
const dataEmDias = (n: number) => emDias(n).slice(0, 10)

function meta(patch: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', workspaceId: 'w', name: 'Meta', description: '', color: '#6366F1',
    status: 'on_track', targetDate: null, targets: [],
    createdAt: emDias(-30), updatedAt: emDias(-1), ...patch,
  }
}
function alvo(patch: Partial<GoalTarget> = {}): GoalTarget {
  return { id: 't1', name: 'Alvo', type: 'number', start: 0, current: 0, target: 100, ...patch }
}
function tarefa(patch: Partial<Task> = {}): Task {
  return {
    id: 'k1', workspaceId: 'w', projectId: 'p1', parentId: null, title: 'T', description: '',
    blocks: [], status: 'done', priority: 'medium', taskType: 'task', dueDate: null,
    assignee: '', tags: [], checklists: [], customFields: {}, comments: [],
    createdAt: emDias(-10), updatedAt: emDias(-1), completedAt: emDias(-1), ...patch,
  }
}

describe('goalProgressOf', () => {
  it('usa a média dos alvos', () => {
    const g = meta({ targets: [alvo({ current: 50 }), alvo({ id: 't2', current: 100 })] })
    expect(goalProgressOf(g, [])).toBe(75)
  })

  it('sem alvos, o progresso vem do status', () => {
    expect(goalProgressOf(meta(), [])).toBe(0)
    expect(goalProgressOf(meta({ status: 'done' }), [])).toBe(100)
  })

  it('não quebra com targets nulo (dado antigo ou escrita parcial)', () => {
    const corrompida = meta({ targets: null as unknown as GoalTarget[] })
    expect(() => goalProgressOf(corrompida, [])).not.toThrow()
    expect(goalProgressOf(corrompida, [])).toBe(0)
  })
})

describe('targetCurrent com alvo do tipo tarefas', () => {
  const alvoTarefas = alvo({ type: 'tasks', target: 4, projectId: 'p1' })

  it('conta só tarefas concluídas do projeto', () => {
    const tarefas = [
      tarefa({ id: 'a' }),
      tarefa({ id: 'b' }),
      tarefa({ id: 'c', status: 'todo' }),        // aberta
      tarefa({ id: 'd', projectId: 'p2' }),        // outro projeto
    ]
    expect(targetCurrent(alvoTarefas, tarefas)).toBe(2)
  })

  it('ignora subtarefas para não contar o mesmo trabalho duas vezes', () => {
    const tarefas = [tarefa({ id: 'a' }), tarefa({ id: 'sub', parentId: 'a' })]
    expect(targetCurrent(alvoTarefas, tarefas)).toBe(1)
  })

  it('filtra por etiqueta quando definida', () => {
    const comTag = alvo({ type: 'tasks', target: 2, tag: 'Dev' })
    const tarefas = [tarefa({ id: 'a', tags: ['Dev'] }), tarefa({ id: 'b', tags: ['Suporte'] })]
    expect(targetCurrent(comTag, tarefas)).toBe(1)
  })
})

describe('goalHealth — status derivado', () => {
  it('prazo vencido sem concluir é atrasada, mesmo salva como "no caminho"', () => {
    const g = meta({ status: 'on_track', targetDate: dataEmDias(-5), targets: [alvo({ current: 30 })] })
    const h = goalHealth(g, [])
    expect(h.status).toBe('off_track')
    expect(h.reason).toContain('venceu')
  })

  it('progresso muito atrás do tempo decorrido é risco', () => {
    // 90% do prazo decorrido com 20% feito → atraso de 70 pontos
    const g = meta({ createdAt: emDias(-90), targetDate: dataEmDias(10), targets: [alvo({ current: 20 })] })
    expect(goalHealth(g, []).status).toBe('off_track')
  })

  it('progresso proporcional ao tempo fica em ritmo', () => {
    const g = meta({ createdAt: emDias(-50), targetDate: dataEmDias(50), targets: [alvo({ current: 50 })] })
    expect(goalHealth(g, []).status).toBe('on_track')
  })

  it('respeita a decisão do usuário de marcar como concluída', () => {
    const g = meta({ status: 'done', targetDate: dataEmDias(-30), targets: [alvo({ current: 10 })] })
    expect(goalHealth(g, []).status).toBe('done')
  })

  it('100% dos alvos conclui a meta sem intervenção', () => {
    const g = meta({ targets: [alvo({ current: 100 })] })
    expect(goalHealth(g, []).status).toBe('done')
  })

  it('marca como parada quando ninguém toca há muito tempo', () => {
    const antigo = emDias(-(GOAL_IDLE_DAYS + 5))
    const g = meta({ updatedAt: antigo, targets: [alvo({ id: 'x', current: 10, updatedAt: antigo })] })
    expect(goalHealth(g, []).idleDays).toBeGreaterThanOrEqual(GOAL_IDLE_DAYS)
  })
})

describe('sortGoals', () => {
  it('risco primeiro coloca as atrasadas na frente', () => {
    const atrasada = meta({ id: 'atrasada', targetDate: dataEmDias(-3), targets: [alvo({ current: 10 })] })
    const emRitmo  = meta({ id: 'ritmo', createdAt: emDias(-10), targetDate: dataEmDias(90), targets: [alvo({ current: 50 })] })
    const ordem = sortGoals([emRitmo, atrasada], [], 'risk').map(g => g.id)
    expect(ordem[0]).toBe('atrasada')
  })
})
