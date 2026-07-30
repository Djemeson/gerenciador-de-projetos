import { describe, it, expect } from 'vitest'
import { matchesTrigger, describeTrigger, describeAction, RECIPES } from '../automationEngine'
import type { Automation, Task } from '../../types'
import { ANY } from '../../types'

// O que se testa aqui é a regra que causava o pior defeito das automações: sem condição,
// "status alterado" disparava em qualquer mudança e "concluído → notificar" notificava ao
// mover para "em progresso".

const agora = new Date().toISOString()

function tarefa(patch: Partial<Task> = {}): Task {
  return {
    id: 'k1', workspaceId: 'w', projectId: 'p1', parentId: null, title: 'T', description: '',
    blocks: [], status: 'done', priority: 'medium', taskType: 'task', dueDate: null,
    assignee: 'DJ', tags: [], checklists: [], customFields: {}, comments: [],
    createdAt: agora, updatedAt: agora, completedAt: agora, ...patch,
  }
}
function regra(patch: Partial<Automation> = {}): Automation {
  return {
    id: 'a1', name: 'Regra', workspaceId: 'w', projectId: ANY,
    trigger: { type: 'status_changed', from: ANY, to: ANY },
    action: { type: 'notify', value: 'oi' },
    enabled: true, createdAt: agora, ...patch,
  }
}

describe('matchesTrigger — condições', () => {
  it('com "para = concluído", só dispara ao virar concluído', () => {
    const r = regra({ trigger: { type: 'status_changed', from: ANY, to: 'done' } })
    expect(matchesTrigger(r, 'status_changed', { task: tarefa({ status: 'done' }), prev: { status: 'todo' } })).toBe(true)
    expect(matchesTrigger(r, 'status_changed', { task: tarefa({ status: 'in_progress' }), prev: { status: 'todo' } })).toBe(false)
  })

  it('sem condição (ANY) mantém o comportamento antigo: qualquer mudança', () => {
    const r = regra({ trigger: { type: 'status_changed', from: ANY, to: ANY } })
    expect(matchesTrigger(r, 'status_changed', { task: tarefa({ status: 'in_progress' }), prev: { status: 'todo' } })).toBe(true)
  })

  it('respeita o "de" quando definido', () => {
    const r = regra({ trigger: { type: 'status_changed', from: 'in_progress', to: 'done' } })
    expect(matchesTrigger(r, 'status_changed', { task: tarefa({ status: 'done' }), prev: { status: 'in_progress' } })).toBe(true)
    expect(matchesTrigger(r, 'status_changed', { task: tarefa({ status: 'done' }), prev: { status: 'todo' } })).toBe(false)
  })

  it('não dispara para outro tipo de gatilho', () => {
    const r = regra({ trigger: { type: 'priority_changed', to: 'urgent' } })
    expect(matchesTrigger(r, 'status_changed', { task: tarefa(), prev: {} })).toBe(false)
  })

  it('escopo de projeto é respeitado', () => {
    const r = regra({ projectId: 'p2' })
    expect(matchesTrigger(r, 'status_changed', { task: tarefa({ projectId: 'p1' }), prev: {} })).toBe(false)
    expect(matchesTrigger(r, 'status_changed', { task: tarefa({ projectId: 'p2' }), prev: {} })).toBe(true)
  })

  it('filtra por etiqueta e por prioridade', () => {
    const porTag = regra({ trigger: { type: 'status_changed', to: ANY, tag: 'Dev' } })
    expect(matchesTrigger(porTag, 'status_changed', { task: tarefa({ tags: ['Dev'] }), prev: {} })).toBe(true)
    expect(matchesTrigger(porTag, 'status_changed', { task: tarefa({ tags: [] }), prev: {} })).toBe(false)

    const porPrio = regra({ trigger: { type: 'status_changed', to: ANY, priority: 'urgent' } })
    expect(matchesTrigger(porPrio, 'status_changed', { task: tarefa({ priority: 'urgent' }), prev: {} })).toBe(true)
    expect(matchesTrigger(porPrio, 'status_changed', { task: tarefa({ priority: 'low' }), prev: {} })).toBe(false)
  })
})

describe('descrição em português', () => {
  it('descreve o gatilho com o valor de destino', () => {
    expect(describeTrigger({ type: 'status_changed', to: 'done' })).toContain('Concluído')
  })

  it('descreve gatilho aberto sem inventar valor', () => {
    expect(describeTrigger({ type: 'status_changed', to: ANY })).toBe('o status mudar')
  })

  it('descreve antecedência de prazo', () => {
    expect(describeTrigger({ type: 'due_date_reached', daysBefore: 2 })).toContain('2 dia')
  })

  it('descreve a ação de etiqueta', () => {
    expect(describeAction({ type: 'add_tag', value: 'triagem' })).toContain('triagem')
  })
})

describe('receitas', () => {
  it('toda receita tem propósito escrito e ação válida', () => {
    expect(RECIPES.length).toBeGreaterThan(0)
    RECIPES.forEach(r => {
      expect(r.purpose.length).toBeGreaterThan(10)
      expect(r.trigger.type).toBeTruthy()
      expect(r.action.type).toBeTruthy()
    })
  })

  it('nenhuma receita muda o status para o valor que a tarefa já nasce', () => {
    // A lista antiga tinha "iniciar ao criar" mudando o status para 'todo' — não fazia nada.
    const inutil = RECIPES.find(r => r.trigger.type === 'task_created' && r.action.type === 'change_status' && r.action.value === 'todo')
    expect(inutil).toBeUndefined()
  })
})
