import { describe, it, expect } from 'vitest'
import { buildLocalDailyBriefing, topPriorities, type DailyBriefingInput } from '../aiDailyBriefing'
import { suggestGutLocal } from '../aiGut'
import { suggestProjectLocal, normalize } from '../aiInboxTriage'
import type { Task } from '../../types'

const AGORA = new Date(2026, 6, 30, 8, 0, 0)   // 30/07/2026, 8h

function tarefa(patch: Partial<Task> = {}): Task {
  return {
    id: 'k1', workspaceId: 'w', projectId: 'p1', parentId: null, title: 'T', description: '',
    blocks: [], status: 'todo', priority: 'medium', taskType: 'task', dueDate: null,
    assignee: '', tags: [], checklists: [], customFields: {}, comments: [],
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-29T00:00:00.000Z', completedAt: null, ...patch,
  }
}

// ── Briefing do dia ──────────────────────────────────────────────────────────
function briefing(patch: Partial<DailyBriefingInput> = {}): DailyBriefingInput {
  return { dateLabel: 'quinta, 30/07', dueToday: [], overdue: [], urgentOpen: [], goalsAtRisk: [], ...patch }
}

describe('buildLocalDailyBriefing', () => {
  it('dia limpo é dito com todas as letras', () => {
    expect(buildLocalDailyBriefing(briefing())).toContain('Dia limpo')
  })

  it('radar soma os três sinais e lista o "comece por aqui"', () => {
    const txt = buildLocalDailyBriefing(briefing({
      dueToday: [tarefa({ id: 'a', title: 'Enviar proposta', dueDate: '2026-07-30' })],
      overdue:  [tarefa({ id: 'b', title: 'Pagar boleto', dueDate: '2026-07-28' })],
      urgentOpen: [tarefa({ id: 'c', title: 'Roteador queimado', priority: 'urgent' })],
    }))
    expect(txt).toContain('1 vence hoje · 1 em atraso · 1 urgente em aberto')
    expect(txt).toContain('1. Pagar boleto — em atraso desde 28/07')
    expect(txt).toContain('2. Enviar proposta — vence hoje')
    expect(txt).toContain('3. Roteador queimado — urgente')
  })

  it('top 3 não repete tarefa que está em mais de uma lista', () => {
    const t = tarefa({ id: 'a', title: 'X', priority: 'urgent', dueDate: '2026-07-28' })
    const top = topPriorities(briefing({ overdue: [t], urgentOpen: [t] }))
    expect(top).toHaveLength(1)
  })

  it('metas em risco entram com o motivo', () => {
    const txt = buildLocalDailyBriefing(briefing({ goalsAtRisk: [{ name: 'Meta X', reason: 'prazo em 3 dias com 20% feito' }] }))
    expect(txt).toContain('Meta X — prazo em 3 dias com 20% feito')
  })
})

// ── GUT local ────────────────────────────────────────────────────────────────
describe('suggestGutLocal', () => {
  it('projeto sem tarefas abertas fica no mínimo', () => {
    const s = suggestGutLocal({ name: 'P' }, [tarefa({ status: 'done' })], AGORA)
    expect(s).toMatchObject({ g: 1, u: 1, t: 1 })
  })

  it('atraso puxa a urgência para 5', () => {
    const s = suggestGutLocal({ name: 'P' }, [tarefa({ dueDate: '2026-07-01' })], AGORA)
    expect(s.u).toBe(5)
    expect(s.reason).toContain('em atraso')
  })

  it('prioridades altas puxam a gravidade; tarefas paradas puxam a tendência', () => {
    const paradas = [
      tarefa({ id: 'a', priority: 'urgent', updatedAt: '2026-07-01T00:00:00.000Z' }),
      tarefa({ id: 'b', priority: 'high',   updatedAt: '2026-07-01T00:00:00.000Z' }),
    ]
    const s = suggestGutLocal({ name: 'P' }, paradas, AGORA)
    expect(s.g).toBe(5)          // 100% alta/urgente
    expect(s.t).toBeGreaterThanOrEqual(4)  // 100% paradas há 7+ dias
  })

  it('valores sempre ficam entre 1 e 5', () => {
    const s = suggestGutLocal({ name: 'P' }, [tarefa({ dueDate: '2026-07-01', priority: 'urgent', updatedAt: '2026-07-01T00:00:00.000Z' })], AGORA)
    for (const v of [s.g, s.u, s.t]) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(5) }
  })
})

// ── Triagem da inbox ─────────────────────────────────────────────────────────
describe('suggestProjectLocal', () => {
  const projetos = [
    { id: 'p1', name: 'Fibra Zona Sul', description: 'expansão da rede de fibra' },
    { id: 'p2', name: 'Suporte', description: 'chamados de clientes' },
  ]
  const porProjeto = new Map([
    ['p1', [{ title: 'Instalar CTO no poste 12' }]],
    ['p2', [{ title: 'Responder chamado do João' }]],
  ])

  it('bate no nome do projeto com confiança (ignora acento)', () => {
    const s = suggestProjectLocal({ title: 'Levantar custos da fibra' }, projetos, porProjeto)
    expect(s).toMatchObject({ projectId: 'p1', confident: true })
    expect(normalize('Fibra Ótica')).toBe('fibra otica')
  })

  it('bate em título de tarefa existente do projeto', () => {
    const s = suggestProjectLocal({ title: 'Verificar chamado pendente' }, projetos, porProjeto)
    expect(s?.projectId).toBe('p2')
  })

  it('sem afinidade suficiente, não sugere nada', () => {
    expect(suggestProjectLocal({ title: 'Comprar café' }, projetos, porProjeto)).toBeNull()
    expect(suggestProjectLocal({ title: 'de para com' }, projetos, porProjeto)).toBeNull()
  })
})
