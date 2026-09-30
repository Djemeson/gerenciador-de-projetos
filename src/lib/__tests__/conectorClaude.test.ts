import { describe, it, expect } from 'vitest'
import { executar, ErroFerramenta, AUTOR_CLAUDE, type DocConta } from '../../../api/_lib/ferramentas'

const T0 = '2026-09-01T10:00:00.000Z'
const AGORA = '2026-09-30T12:00:00.000Z'

const tarefa = (id: string, seq: number, extra: Record<string, unknown> = {}) => ({
  id, seq, workspaceId: 'default', projectId: 'p1', parentId: null, title: `Tarefa ${id}`, description: '',
  blocks: [], status: 'todo', priority: 'medium', taskType: 'task', dueDate: null, assignee: 'DJ',
  tags: [], checklists: [], customFields: {}, comments: [], createdAt: T0, updatedAt: T0, completedAt: null, ...extra,
})
const docBase = (): DocConta => ({
  projects: [{ id: 'p1', seq: 1, name: 'Site', workspaceId: 'default', archived: false, createdAt: T0, updatedAt: T0 }],
  tasks: [tarefa('a', 1, { anexoRef: 'lref:xyz' })],
  seqCounters: { task: 1, project: 1 },
  settings: { chave: 'não mexer' },
})

describe('conector do Claude — ferramentas', () => {
  it('cria subtarefas numeradas em ordem, sob a mãe, sem apagar campos desconhecidos', () => {
    const r = executar('criar_subtarefas', { pai: 'T-1', titulos: ['Levantar', 'Fazer', 'Revisar'] }, docBase(), AGORA)
    expect(r.alterou).toBe(true)
    const subs = r.doc.tasks.filter(t => t.parentId === 'a')
    expect(subs.map(t => [t.seq, t.title])).toEqual([[2, 'Levantar'], [3, 'Fazer'], [4, 'Revisar']])
    expect(subs.every(t => t.projectId === 'p1' && t.priority === 'low')).toBe(true)
    expect(r.doc.seqCounters).toEqual({ task: 4, project: 1 })
    expect(r.doc.tasks[0].anexoRef).toBe('lref:xyz')
    expect(r.doc.settings).toEqual({ chave: 'não mexer' })
    expect(r.texto).toContain('T-2 Levantar')
  })

  it('checklist: cria, marca com data e o relatório do período enxerga o item', () => {
    const c = executar('criar_checklist', { tarefa: 'T-1', titulo: 'Passos', itens: ['um', 'dois'] }, docBase(), AGORA)
    const cl = c.doc.tasks[0].checklists[0]
    expect(c.doc.tasks[0].updatedAt).toBe(AGORA)
    const m = executar('marcar_itens', { tarefa: 'T-1', itens: [cl.items[0].id] }, c.doc, AGORA)
    const item = m.doc.tasks[0].checklists[0].items[0]
    expect(item).toMatchObject({ done: true, doneAt: AGORA })
    expect(m.texto).toContain('1/2')
    const rel = executar('relatorio', { de: '2026-09-30', ate: '2026-09-30' }, m.doc, AGORA)
    expect(rel.alterou).toBe(false)
    expect(rel.texto).toContain('T-1: um')
  })

  it('concluir a última subtarefa conclui a mãe (como no app) e grava completedAt', () => {
    const d = docBase()
    d.tasks.push(tarefa('s1', 2, { parentId: 'a' }), tarefa('s2', 3, { parentId: 'a', status: 'done', completedAt: T0 }))
    d.seqCounters = { task: 3, project: 1 }
    const r = executar('atualizar_tarefa', { tarefa: 'T-2', status: 'done' }, d, AGORA)
    const porId = new Map(r.doc.tasks.map(t => [t.id, t]))
    expect(porId.get('s1')).toMatchObject({ status: 'done', completedAt: AGORA })
    expect(porId.get('a')).toMatchObject({ status: 'done', completedAt: AGORA })
    expect(r.texto).toContain('Tarefa-mãe T-1')
  })

  it('comentário sai assinado pelo Claude e aparece em ver_tarefa', () => {
    const c = executar('comentar', { tarefa: 't1', texto: 'Ponto de parada: falta revisar.' }, docBase(), AGORA)
    expect(c.doc.tasks[0].comments[0]).toMatchObject({ author: AUTOR_CLAUDE, text: 'Ponto de parada: falta revisar.' })
    const v = executar('ver_tarefa', { tarefa: 'T-1' }, c.doc, AGORA)
    expect(v.texto).toContain('Claude: Ponto de parada: falta revisar.')
    expect(v.alterou).toBe(false)
  })

  it('conta sem números ainda: o servidor numera na leitura com a mesma regra do app', () => {
    const d: DocConta = { projects: [{ id: 'p1', name: 'Site', createdAt: T0 }], tasks: [
      { ...tarefa('b', 0, { createdAt: '2026-02-01' }), seq: undefined },
      { ...tarefa('a', 0, { createdAt: '2026-01-01' }), seq: undefined },
    ] }
    const r = executar('listar_tarefas', { projeto: 'P-1' }, d, AGORA)
    expect(r.alterou).toBe(true)
    expect(r.texto).toContain('T-1 [A fazer] Tarefa a')
    expect(r.doc.seqCounters).toEqual({ task: 2, project: 1 })
  })

  it('ID errado ou inexistente vira erro legível, sem alterar nada', () => {
    expect(() => executar('ver_tarefa', { tarefa: 'T-99' }, docBase(), AGORA)).toThrow(ErroFerramenta)
    expect(() => executar('ver_tarefa', { tarefa: 'P-1' }, docBase(), AGORA)).toThrow(/não é um ID de tarefa/)
    expect(() => executar('marcar_itens', { tarefa: 'T-1', itens: ['nada'] }, docBase(), AGORA)).toThrow(/não encontrados/)
  })

  it('não existe ferramenta de exclusão', () => {
    expect(() => executar('excluir_tarefa', { tarefa: 'T-1' }, docBase(), AGORA)).toThrow(/desconhecida/)
  })
})
