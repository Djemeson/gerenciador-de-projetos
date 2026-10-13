import { describe, it, expect } from 'vitest'
import { executar, ErroFerramenta, type DocConta } from '../../../shared/ferramentas'

const T0 = '2026-09-01T10:00:00.000Z'
// 13/10 às 01h UTC = 12/10 às 22h em Bragança: o "hoje" do atraso tem que ser 12/10.
const AGORA = '2026-10-13T01:00:00.000Z'

const tarefa = (id: string, seq: number, extra: Record<string, unknown> = {}) => ({
  id, seq, workspaceId: 'default', projectId: 'p1', parentId: null, title: `Tarefa ${id}`, description: '',
  blocks: [], status: 'todo', priority: 'medium', taskType: 'task', dueDate: null, assignee: 'DJ',
  tags: [], checklists: [], customFields: {}, comments: [], createdAt: T0, updatedAt: T0, completedAt: null, ...extra,
})
const doc = (tasks: ReturnType<typeof tarefa>[]): DocConta => ({
  projects: [
    { id: 'p1', seq: 1, name: 'Chatwoot', workspaceId: 'default', archived: false, createdAt: T0, updatedAt: T0 },
    { id: 'p2', seq: 2, name: 'Outro', workspaceId: 'default', archived: false, createdAt: T0, updatedAt: T0 },
  ],
  tasks, seqCounters: { task: tasks.length, project: 2 },
})

describe('conector — marcos', () => {
  it('criar_marco: marco + tarefas novas + existentes incluídas, na ordem dada', () => {
    const base = doc([tarefa('a', 1, { title: 'Contratar VPS' }), tarefa('b', 2, { title: 'Solta' })])
    const r = executar('criar_marco', { projeto: 'P-1', titulo: 'Ambiente no ar', prazo: '2026-10-20', tarefas: ['Instalar', 'Configurar SSL'], incluir: ['T-1'], responsavel: 'claude' }, base, AGORA)
    const marco = r.doc.tasks.find(t => t.title === 'Ambiente no ar')!
    expect(marco).toMatchObject({ taskType: 'milestone', parentId: null, dueDate: '2026-10-20', assignee: 'Claude', seq: 3 })
    const filhas = r.doc.tasks.filter(t => t.parentId === marco.id)
    expect(filhas.map(t => t.title).sort()).toEqual(['Configurar SSL', 'Contratar VPS', 'Instalar'])
    expect(r.doc.tasks.filter(t => t.title === 'Instalar' || t.title === 'Configurar SSL').map(t => t.seq)).toEqual([4, 5])
    expect(r.doc.tasks.find(t => t.id === 'a')!.updatedAt).toBe(AGORA)
    expect(r.doc.tasks.find(t => t.id === 'b')!.parentId).toBeNull()
    expect(r.texto).toContain('T-3 Ambiente no ar')
  })

  it('criar_marco recusa tarefa de outro projeto e marco dentro de marco', () => {
    const base = doc([tarefa('x', 1, { projectId: 'p2' }), tarefa('m', 2, { taskType: 'milestone' })])
    expect(() => executar('criar_marco', { projeto: 'P-1', titulo: 'F', incluir: ['T-1'] }, base, AGORA)).toThrow(ErroFerramenta)
    expect(() => executar('criar_marco', { projeto: 'P-1', titulo: 'F', incluir: ['T-2'] }, base, AGORA)).toThrow(/já é um marco/)
  })

  it('marco montado só com trabalho entregue nasce concluído', () => {
    const base = doc([tarefa('a', 1, { status: 'done', completedAt: T0 })])
    const r = executar('criar_marco', { projeto: 'P-1', titulo: 'Fase 0', incluir: ['T-1'] }, base, AGORA)
    expect(r.doc.tasks.find(t => t.title === 'Fase 0')!.status).toBe('done')
  })

  it('ver_marcos: passado, onde estamos com próximo passo, a seguir e o que está fora', () => {
    const base = doc([
      tarefa('m1', 1, { taskType: 'milestone', title: 'Ambiente', status: 'done', completedAt: '2026-10-01T12:00:00.000Z' }),
      tarefa('f1', 2, { parentId: 'm1', status: 'done', completedAt: T0 }),
      tarefa('m2', 3, { taskType: 'milestone', title: 'Integração', dueDate: '2026-10-11' }),
      tarefa('t1', 4, { parentId: 'm2', title: 'Mapear etiquetas' }),
      tarefa('t2', 5, { parentId: 'm2', title: 'Webhook', status: 'in_progress' }),
      tarefa('m3', 6, { taskType: 'milestone', title: 'Treinamento', dueDate: '2026-11-10' }),
      tarefa('s1', 7, { title: 'Pesquisar plano pago' }),
    ])
    const r = executar('ver_marcos', { projeto: 'P-1' }, base, AGORA)
    expect(r.alterou).toBe(false)
    expect(r.texto).toContain('1 de 3 marcos concluídos')
    expect(r.texto).toContain('✓ T-1 Ambiente — concluído em 2026-10-01')
    expect(r.texto).toMatch(/▶ T-3 Integração — ONDE ESTAMOS · até 2026-10-11 \(ATRASADO\)/)
    expect(r.texto).toContain('Próximo passo: T-5 [Em progresso] Webhook')
    expect(r.texto).toContain('○ T-6 Treinamento — a seguir')
    expect(r.texto).toContain('Fora dos marcos (1 aberta(s))')
  })

  it('ver_marcos: atraso medido no dia de Bragança, não no UTC', () => {
    // Prazo 12/10: em UTC já é dia 13, mas em Bragança ainda é 12 — vence hoje, não está atrasado.
    const base = doc([tarefa('m', 1, { taskType: 'milestone', title: 'Fase', dueDate: '2026-10-12' })])
    expect(executar('ver_marcos', { projeto: 'P-1' }, base, AGORA).texto).not.toContain('ATRASADO')
  })

  it('ver_marcos sem marcos explica como começar', () => {
    const r = executar('ver_marcos', { projeto: 'P-1' }, doc([tarefa('a', 1)]), AGORA)
    expect(r.texto).toContain('ainda não tem marcos')
    expect(r.texto).toContain('criar_marco')
  })

  it('listas marcam o marco; tarefas_abertas traz o tipo', () => {
    const base = doc([tarefa('m', 1, { taskType: 'milestone', title: 'Fase 1' }), tarefa('a', 2, { parentId: 'm' })])
    expect(executar('listar_tarefas', { projeto: 'P-1' }, base, AGORA).texto).toContain('T-1 [A fazer] ◆ Marco: Fase 1')
    const json = JSON.parse(executar('tarefas_abertas', {}, base, AGORA).texto)
    expect(json.map((x: { tipo: string }) => x.tipo)).toEqual(['marco', 'tarefa'])
  })

  it('atualizar_tarefa vira marco; subtarefa não pode', () => {
    const base = doc([tarefa('a', 1), tarefa('b', 2, { parentId: 'a' })])
    expect(executar('atualizar_tarefa', { tarefa: 'T-1', tipo: 'marco' }, base, AGORA).doc.tasks[0].taskType).toBe('milestone')
    expect(() => executar('atualizar_tarefa', { tarefa: 'T-2', tipo: 'marco' }, base, AGORA)).toThrow(/subtarefa/)
  })

  it('mover tarefa aberta para marco concluído reabre o marco; marco não entra em tarefa', () => {
    const base = doc([
      tarefa('m', 1, { taskType: 'milestone', status: 'done', completedAt: T0 }),
      tarefa('a', 2),
      tarefa('m2', 3, { taskType: 'milestone' }),
    ])
    const r = executar('mover_tarefa', { tarefa: 'T-2', pai: 'T-1' }, base, AGORA)
    expect(r.doc.tasks.find(t => t.id === 'm')!.status).toBe('in_progress')
    expect(r.texto).toContain('foi reaberto')
    expect(() => executar('mover_tarefa', { tarefa: 'T-3', pai: 'T-1' }, base, AGORA)).toThrow(/é um marco/)
  })
})
