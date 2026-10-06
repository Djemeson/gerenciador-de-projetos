import { describe, it, expect } from 'vitest'
import { executar, ErroFerramenta, AUTOR_CLAUDE, type DocConta } from '../../../shared/ferramentas'

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

  it('excluir tarefa leva as subtarefas para a lixeira, registra a exclusão e restaurar desfaz', () => {
    const d = docBase()
    d.tasks.push(tarefa('s1', 2, { parentId: 'a' }), tarefa('neta', 3, { parentId: 's1' }), tarefa('outra', 4))
    d.seqCounters = { task: 4, project: 1 }
    const ex = executar('excluir_tarefa', { tarefa: 'T-1' }, d, AGORA)
    expect(ex.doc.tasks.map(t => t.id)).toEqual(['outra'])
    expect(Object.keys(ex.doc.excluidos!).sort()).toEqual(['a', 'neta', 's1'])
    const entrada = ex.lixeira!.entrar![0]
    expect(entrada).toMatchObject({ id: 'a', tipo: 'task', seq: 1 })
    expect(entrada.tarefas).toHaveLength(3)

    const DEPOIS = '2026-09-30T13:00:00.000Z'
    const r = executar('restaurar', { id: 'T-1' }, ex.doc, DEPOIS, { lixeira: [entrada] })
    expect(r.doc.tasks.map(t => t.id).sort()).toEqual(['a', 'neta', 'outra', 's1'])
    // Volta mais nova que a exclusão, senão os aparelhos a derrubariam de novo.
    expect(r.doc.tasks.find(t => t.id === 'a')!.updatedAt).toBe(DEPOIS)
    expect(r.doc.excluidos).toEqual({})
    expect(r.lixeira).toEqual({ sair: ['a'] })
    expect(r.doc.tasks.find(t => t.id === 'a')!.seq).toBe(1)   // o ID volta o mesmo
  })

  it('excluir projeto leva as tarefas; a caixa de entrada não pode', () => {
    const d = docBase()
    const ex = executar('excluir_projeto', { projeto: 'P-1' }, d, AGORA)
    expect(ex.doc.projects).toHaveLength(0)
    expect(ex.doc.tasks).toHaveLength(0)
    expect(ex.lixeira!.entrar![0]).toMatchObject({ tipo: 'project', seq: 1, titulo: 'Site' })
    const comInbox = { ...docBase(), projects: [{ id: '__inbox__', seq: 2, name: 'Inbox', createdAt: T0 }] }
    expect(() => executar('excluir_projeto', { projeto: 'P-2' }, comInbox, AGORA)).toThrow(/caixa de entrada/)
  })

  it('mover tarefa leva as subtarefas de projeto e não deixa pendurar dentro de si mesma', () => {
    const d = docBase()
    d.projects.push({ id: 'p2', seq: 2, name: 'Outro', workspaceId: 'default', createdAt: T0 })
    d.tasks.push(tarefa('s1', 2, { parentId: 'a' }))
    const m = executar('mover_tarefa', { tarefa: 'T-1', projeto: 'P-2' }, d, AGORA)
    expect(m.doc.tasks.every(t => t.projectId === 'p2')).toBe(true)
    expect(m.doc.tasks.find(t => t.id === 's1')!.parentId).toBe('a')
    expect(() => executar('mover_tarefa', { tarefa: 'T-1', pai: 'T-2' }, d, AGORA)).toThrow(/dentro dela mesma/)
  })

  it('substituir descrição não apaga imagem; acrescentar sempre pode', () => {
    const d = docBase()
    d.tasks[0].blocks = [{ id: 'b', type: 'text', text: 'antes <img src="x">' }]
    expect(() => executar('editar_descricao', { tarefa: 'T-1', texto: 'novo', modo: 'substituir' }, d, AGORA)).toThrow(/imagem/)
    const r = executar('editar_descricao', { tarefa: 'T-1', texto: 'mais' }, d, AGORA)
    expect(r.doc.tasks[0].blocks).toHaveLength(2)
  })

  it('criar projeto recebe o próximo P- e fica no workspace mais usado', () => {
    const r = executar('criar_projeto', { nome: 'Novo' }, docBase(), AGORA)
    expect(r.texto).toContain('P-2 Novo')
    expect(r.doc.projects[1]).toMatchObject({ workspaceId: 'default', spaceId: null, archived: false })
  })

  it('responsável: nasce DJ por padrão, aceita Claude em qualquer grafia e muda pelo atualizar', () => {
    const padrao = executar('criar_tarefa', { projeto: 'P-1', titulo: 'Pagar boleto' }, docBase(), AGORA)
    expect(padrao.doc.tasks[1].assignee).toBe('DJ')
    const doClaude = executar('criar_tarefa', { projeto: 'P-1', titulo: 'Rodar script', responsavel: ' claude ' }, docBase(), AGORA)
    expect(doClaude.doc.tasks[1].assignee).toBe('Claude')
    expect(doClaude.texto).toContain('responsável: Claude')
    expect(() => executar('criar_tarefa', { projeto: 'P-1', titulo: 'x', responsavel: '  ' }, docBase(), AGORA)).toThrow(ErroFerramenta)

    const subs = executar('criar_subtarefas', { pai: 'T-2', titulos: ['a', 'b'] }, doClaude.doc, AGORA)
    expect(subs.doc.tasks.filter(t => t.parentId === doClaude.doc.tasks[1].id).every(t => t.assignee === 'Claude')).toBe(true)

    const DEPOIS = '2026-10-01T09:00:00.000Z'
    const troca = executar('atualizar_tarefa', { tarefa: 'T-1', responsavel: 'Claude' }, docBase(), DEPOIS)
    expect(troca.doc.tasks[0]).toMatchObject({ assignee: 'Claude', updatedAt: DEPOIS })
    const djemeson = executar('atualizar_tarefa', { tarefa: 'T-1', responsavel: 'Djemeson' }, troca.doc, DEPOIS)
    expect(djemeson.doc.tasks[0].assignee).toBe('DJ')
    const igual = executar('atualizar_tarefa', { tarefa: 'T-1', responsavel: 'dj' }, docBase(), DEPOIS)
    expect(igual.texto).toContain('Nada mudou')
    expect(executar('ver_tarefa', { tarefa: 'T-1' }, troca.doc, DEPOIS).texto).toContain('Responsável: Claude')
  })
})
