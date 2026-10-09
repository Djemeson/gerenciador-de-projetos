import { describe, it, expect } from 'vitest'
import { mudancasTarefa, mudancasProjeto, avisoTarefa, avisoSincronizar, hojeEmBelem } from '../../../shared/orquestrador'

const AGORA = Date.parse('2026-10-09T12:00:00.000Z')
const RECENTE = '2026-10-09T11:58:00.000Z'
const ANTIGO = '2026-09-01T10:00:00.000Z'
const t = (extra: Record<string, unknown> = {}) => ({
  id: 'a', seq: 7, projectId: 'p1', parentId: null, title: 'Pagar boleto', status: 'todo', assignee: 'DJ',
  dueDate: null, priority: 'medium', createdAt: ANTIGO, updatedAt: ANTIGO, completedAt: null, ...extra,
})
const projetos = [
  { id: 'p1', seq: 3, name: 'Pessoal', archived: false },
  { id: 'p2', seq: 4, name: 'Velho', archived: true },
]

describe('orquestrador — o que vira aviso', () => {
  it('criação só conta quando é recente (regravação antiga não é tarefa nova)', () => {
    expect(mudancasTarefa(null, t({ createdAt: RECENTE }), AGORA)).toEqual(['criada'])
    expect(mudancasTarefa(null, t(), AGORA)).toEqual([])
  })

  it('status, prazo, título, responsável e projeto viram eventos; updatedAt sozinho não', () => {
    expect(mudancasTarefa(t(), t({ updatedAt: RECENTE }), AGORA)).toEqual([])
    expect(mudancasTarefa(t(), t({ status: 'done' }), AGORA)).toEqual(['concluida'])
    expect(mudancasTarefa(t({ status: 'done' }), t({ status: 'in_progress' }), AGORA)).toEqual(['reaberta'])
    expect(mudancasTarefa(t(), t({ status: 'waiting' }), AGORA)).toEqual(['status'])
    expect(mudancasTarefa(t(), t({ dueDate: '2026-10-10T00:00:00.000Z', assignee: 'claude' }), AGORA)).toEqual(['prazo', 'responsavel'])
    expect(mudancasTarefa(t({ assignee: 'Djemeson' }), t({ assignee: 'dj' }), AGORA)).toEqual([])
    expect(mudancasTarefa(t(), t({ projectId: 'p2', title: 'Outro' }), AGORA)).toEqual(['titulo', 'movida'])
    expect(mudancasTarefa(t(), null, AGORA)).toEqual(['excluida'])
  })

  it('projeto: criado recente, renomeado, arquivado e reaberto', () => {
    const p = { id: 'p1', seq: 3, name: 'A', archived: false, createdAt: ANTIGO }
    expect(mudancasProjeto(null, { ...p, createdAt: RECENTE }, AGORA)).toEqual(['projeto_criado'])
    expect(mudancasProjeto(p, { ...p, name: 'B', archived: true }, AGORA)).toEqual(['projeto_renomeado', 'projeto_arquivado'])
    expect(mudancasProjeto({ ...p, archived: true }, p, AGORA)).toEqual(['projeto_reaberto'])
  })

  it('aviso leva a tarefa, o projeto inteiro e o painel com atrasadas no dia de Belém', () => {
    const tarefas = [
      t({ status: 'done', completedAt: '2026-10-09T11:00:00.000Z' }),
      t({ id: 'b', seq: 8, parentId: 'a', dueDate: '2026-10-08T00:00:00.000Z', title: 'Sub' }),
      t({ id: 'c', seq: 9, projectId: 'p2' }),
    ]
    const a = avisoTarefa(['concluida'], t(), tarefas[0], tarefas, projetos, AGORA)
    expect(a.tarefa).toMatchObject({ id: 'T-7', status: 'done', concluidaEm: '2026-10-09', excluida: false })
    expect(a.projeto).toMatchObject({ id: 'P-3', nome: 'Pessoal' })
    expect(a.projeto!.tarefas.map((x: any) => [x.id, x.mae])).toEqual([['T-7', null], ['T-8', 'T-7']])
    expect(a.painel[0]).toMatchObject({ id: 'P-3', total: 2, abertas: 1, concluidas: 1, atrasadas: 1 })
    expect(a.painel[1]).toMatchObject({ id: 'P-4', arquivado: true, abertas: 1 })
  })

  it('"hoje" vira à meia-noite de Belém, não de Greenwich', () => {
    expect(hojeEmBelem(Date.parse('2026-10-10T02:00:00.000Z'))).toBe('2026-10-09')
    expect(hojeEmBelem(Date.parse('2026-10-10T03:00:00.000Z'))).toBe('2026-10-10')
  })

  it('sincronizar devolve o retrato do projeto pedido e nada para projeto inexistente', () => {
    expect(avisoSincronizar(3, [t()], projetos, AGORA)?.projeto).toMatchObject({ id: 'P-3', tarefas: [{ id: 'T-7' }] })
    expect(avisoSincronizar(99, [], projetos, AGORA)).toBeNull()
  })
})
