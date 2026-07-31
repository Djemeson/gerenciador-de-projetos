import { describe, it, expect } from 'vitest'
import { parseAutomationLocal } from '../aiAutomationBuilder'
import { ANY } from '../../types'

const PROJETOS = [
  { id: 'p1', name: 'Fibra Zona Sul' },
  { id: 'p2', name: 'Suporte' },
]

describe('parseAutomationLocal — gatilhos', () => {
  it('prazo com antecedência', () => {
    const g = parseAutomationLocal('quando faltar 2 dias para o prazo, me avise', PROJETOS)
    expect(g?.trigger).toMatchObject({ type: 'due_date_reached', daysBefore: 2 })
    expect(g?.action).toMatchObject({ type: 'notify' })
  })

  it('prazo no dia', () => {
    const g = parseAutomationLocal('quando o prazo chegar, me avise', PROJETOS)
    expect(g?.trigger).toMatchObject({ type: 'due_date_reached', daysBefore: 0 })
  })

  it('conclusão → resumo com IA', () => {
    const g = parseAutomationLocal('quando uma tarefa for concluída, gere o resumo com IA', PROJETOS)
    expect(g?.trigger).toMatchObject({ type: 'status_changed', to: 'done' })
    expect(g?.action).toMatchObject({ type: 'ai_enrich' })
  })

  it('prioridade virar urgente', () => {
    const g = parseAutomationLocal('quando uma tarefa ficar urgente, me avise', PROJETOS)
    expect(g?.trigger).toMatchObject({ type: 'priority_changed', to: 'urgent' })
  })

  it('tarefa criada → etiqueta', () => {
    const g = parseAutomationLocal('quando uma tarefa for criada, aplique a etiqueta triagem', PROJETOS)
    expect(g?.trigger).toMatchObject({ type: 'task_created' })
    expect(g?.action).toMatchObject({ type: 'add_tag', value: 'triagem' })
  })

  it('entrar em progresso → prazo automático', () => {
    const g = parseAutomationLocal('quando uma tarefa entrar em progresso, defina o prazo para 7 dias', PROJETOS)
    expect(g?.trigger).toMatchObject({ type: 'status_changed', to: 'in_progress' })
    expect(g?.action).toMatchObject({ type: 'set_due_date', value: 7 })
  })
})

describe('parseAutomationLocal — ações e escopo', () => {
  it('mover para projeto por nome (sem acento, case livre)', () => {
    const g = parseAutomationLocal('quando o prazo chegar, mova para suporte', PROJETOS)
    expect(g?.action).toMatchObject({ type: 'move_project', value: 'p2' })
  })

  it('escopo "no projeto X" vira projectId', () => {
    const g = parseAutomationLocal('quando uma tarefa for concluída no projeto fibra zona sul, gere o resumo', PROJETOS)
    expect(g?.projectId).toBe('p1')
  })

  it('notificação com mensagem entre aspas', () => {
    const g = parseAutomationLocal('quando o prazo chegar, me avise "Prazo estourando!"', PROJETOS)
    expect(g?.action).toMatchObject({ type: 'notify', value: 'Prazo estourando!' })
  })

  it('atribuir responsável', () => {
    const g = parseAutomationLocal('quando uma tarefa for criada, atribua a Ana', PROJETOS)
    expect(g?.action).toMatchObject({ type: 'assign', value: 'ana' })
  })

  it('frase sem gatilho ou sem ação devolve null', () => {
    expect(parseAutomationLocal('organizar minhas tarefas', PROJETOS)).toBeNull()
    expect(parseAutomationLocal('quando uma tarefa for criada', PROJETOS)).toBeNull()
    expect(parseAutomationLocal('', PROJETOS)).toBeNull()
  })

  it('o nome da regra é a própria frase (limitada a 60)', () => {
    const g = parseAutomationLocal('quando o prazo chegar, me avise', PROJETOS)
    expect(g?.name).toBe('quando o prazo chegar, me avise')
  })
})
