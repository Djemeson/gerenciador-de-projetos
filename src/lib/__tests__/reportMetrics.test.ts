import { describe, it, expect } from 'vitest'
import { previousRange, tasksInRange, computeKpis, delta, buildSeries, granularityFor, STALLED_DAYS } from '../reportMetrics'
import { taskDateValue, resolvePeriodRange } from '../dateFilter'
import type { Task } from '../../types'

const DIA = 86_400_000
const emDias = (n: number) => new Date(Date.now() + n * DIA).toISOString()
const dataEmDias = (n: number) => emDias(n).slice(0, 10)

function tarefa(patch: Partial<Task> = {}): Task {
  return {
    id: 'k1', workspaceId: 'w', projectId: 'p1', parentId: null, title: 'T', description: '',
    blocks: [], status: 'todo', priority: 'medium', taskType: 'task', dueDate: null,
    assignee: '', tags: [], checklists: [], customFields: {}, comments: [],
    createdAt: emDias(-10), updatedAt: emDias(-1), completedAt: null, ...patch,
  }
}

describe('previousRange', () => {
  it('espelha a janela anterior com o mesmo tamanho', () => {
    const inicio = new Date('2026-07-01T00:00:00')
    const fim    = new Date('2026-07-31T00:00:00')
    const anterior = previousRange({ start: inicio, end: fim })
    expect(anterior.end.getTime()).toBe(inicio.getTime())
    expect(fim.getTime() - inicio.getTime()).toBe(anterior.end.getTime() - anterior.start.getTime())
  })
})

describe('completedAt como campo próprio', () => {
  it('data de conclusão vem do campo, não do updatedAt', () => {
    // O ponto do campo: editar uma tarefa concluída não pode movê-la de período.
    const t = tarefa({ status: 'done', completedAt: emDias(-30), updatedAt: emDias(-1) })
    expect(taskDateValue(t, 'completedAt')).toBe(t.completedAt)
  })

  it('tarefa aberta não tem data de conclusão', () => {
    expect(taskDateValue(tarefa(), 'completedAt')).toBeNull()
  })

  it('cai no updatedAt só para dado antigo, ainda não migrado', () => {
    const legado = { ...tarefa({ status: 'done' }), completedAt: undefined } as Task
    expect(taskDateValue(legado, 'completedAt')).toBe(legado.updatedAt)
  })
})

describe('tasksInRange', () => {
  it('inclui o começo e exclui o fim do intervalo', () => {
    const range = { start: new Date(Date.now() - 5 * DIA), end: new Date(Date.now() - 1 * DIA) }
    const dentro = tarefa({ id: 'dentro', createdAt: emDias(-3) })
    const foraFim = tarefa({ id: 'fora', createdAt: emDias(-1) })
    const ids = tasksInRange([dentro, foraFim], 'createdAt', range).map(t => t.id)
    expect(ids).toEqual(['dentro'])
  })
})

describe('computeKpis', () => {
  it('conta só tarefas raiz no total e ignora subtarefas', () => {
    const tarefas = [tarefa({ id: 'a' }), tarefa({ id: 'sub', parentId: 'a' })]
    expect(computeKpis(tarefas, new Date()).total).toBe(1)
  })

  it('em atraso considera apenas abertas com prazo vencido', () => {
    const tarefas = [
      tarefa({ id: 'a', dueDate: dataEmDias(-2) }),
      tarefa({ id: 'b', dueDate: dataEmDias(-3), status: 'done', completedAt: emDias(-1) }),
      tarefa({ id: 'c', dueDate: dataEmDias(5) }),
    ]
    expect(computeKpis(tarefas, new Date()).overdue).toBe(1)
  })

  it('lead time usa criação até conclusão', () => {
    const t = tarefa({ status: 'done', createdAt: emDias(-10), completedAt: emDias(-4) })
    expect(computeKpis([t], new Date()).leadTimeDays).toBe(6)
  })

  it('marca como paradas as abertas sem toque há muito tempo', () => {
    const antiga = tarefa({ id: 'velha', updatedAt: emDias(-(STALLED_DAYS + 3)) })
    const nova   = tarefa({ id: 'nova', updatedAt: emDias(-1) })
    const kpis = computeKpis([antiga, nova], new Date())
    expect(kpis.stalled.map(t => t.id)).toEqual(['velha'])
  })
})

describe('delta', () => {
  it('não inventa percentual quando não havia base', () => {
    expect(delta(5, 0).pct).toBeNull()
    expect(delta(5, 0).abs).toBe(5)
  })

  it('calcula variação e direção', () => {
    expect(delta(12, 10)).toMatchObject({ pct: 20, direction: 'up' })
    expect(delta(8, 10)).toMatchObject({ pct: -20, direction: 'down' })
    expect(delta(10, 10).direction).toBe('flat')
  })
})

describe('granularidade do gráfico', () => {
  const range = (dias: number) => ({ start: new Date(Date.now() - dias * DIA), end: new Date() })

  it('escolhe dia, semana ou mês conforme o tamanho do recorte', () => {
    expect(granularityFor(range(7))).toBe('day')
    expect(granularityFor(range(60))).toBe('week')
    expect(granularityFor(range(200))).toBe('month')
  })

  it('nunca passa de 24 barras', () => {
    const { buckets } = buildSeries([], range(3650))
    expect(buckets.length).toBeLessThanOrEqual(24)
  })

  it('conta criadas e concluídas separadamente', () => {
    const r = range(7)
    const t = tarefa({ status: 'done', createdAt: emDias(-3), completedAt: emDias(-2) })
    const { buckets } = buildSeries([t], r)
    expect(buckets.reduce((s, b) => s + b.created, 0)).toBe(1)
    expect(buckets.reduce((s, b) => s + b.completed, 0)).toBe(1)
  })
})

describe('resolvePeriodRange — entre datas', () => {
  it('o fim é inclusivo para o usuário (o dia escolhido entra)', () => {
    const { start, end } = resolvePeriodRange({ period: 'between', start: '2026-07-05', end: '2026-07-25' })
    expect(start?.toISOString().slice(0, 10)).toBe('2026-07-05')
    // fim exclusivo internamente = 26, ou seja o dia 25 inteiro está incluído
    expect(end?.toISOString().slice(0, 10)).toBe('2026-07-26')
  })
})
