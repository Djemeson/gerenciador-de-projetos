import { describe, it, expect } from 'vitest'
import { normalizarPlano, planoLocal, tarefasElegiveis, userPromptMarcos, planejarMarcos, reaproveitarParecidas, pareceIgual } from '../aiMarcos'
import type { Task } from '../../types'

const CRIADO = '2026-09-01T10:00:00.000Z'
function t(p: Partial<Task> & { id: string; title: string }): Task {
  return {
    workspaceId: 'ws', projectId: 'p1', parentId: null, description: '', blocks: [],
    status: 'todo', priority: 'medium', taskType: 'task', dueDate: null, assignee: '',
    tags: [], checklists: [], customFields: {}, comments: [], createdAt: CRIADO, updatedAt: CRIADO,
    ...p,
  } as Task
}

const PROJETO = [
  t({ id: 'a', seq: 10, title: 'Contratar VPS', status: 'done', completedAt: '2026-09-05T10:00:00Z' }),
  t({ id: 'b', seq: 11, title: 'Webhook para o n8n' }),
  t({ id: 'm', seq: 12, title: 'Ambiente no ar', taskType: 'milestone' }),
  t({ id: 'c', seq: 13, title: 'Dentro do marco', parentId: 'm' }),
  t({ id: 'd', seq: 14, title: 'Subtarefa solta', parentId: 'b' }),
]

describe('tarefasElegiveis', () => {
  it('só principais que não são marco; abertas antes das concluídas', () => {
    expect(tarefasElegiveis(PROJETO).map(x => x.id)).toEqual(['b', 'a'])
  })
})

describe('userPromptMarcos', () => {
  it('leva hoje, marcos existentes e as tarefas com o T- de cada uma', () => {
    const p = userPromptMarcos({ nome: 'Chatwoot', descricao: '' }, PROJETO, 'organizar', '2026-10-13', true)
    expect(p).toContain('Hoje: 2026-10-13')
    expect(p).toContain('- Ambiente no ar')
    expect(p).toContain('- T-11 Webhook para o n8n')
    expect(p).toContain('- T-10 [concluída] Contratar VPS')
    expect(p).not.toContain('Dentro do marco')
  })
  it('sem aproveitar, não lista tarefas e avisa a IA', () => {
    expect(userPromptMarcos({ nome: 'X', descricao: '' }, PROJETO, 'organizar', '2026-10-13', false)).toContain('NÃO aproveitar')
  })
})

describe('normalizarPlano', () => {
  it('traduz rótulos para ids e descarta o que não existe, repete ou já é marco', () => {
    const raw = { marcos: [
      { titulo: 'Integração concluída', prazo: '2026-10-25', descricao: 'Mensagens chegam no n8n', tarefas_novas: ['Testar transferência', 'Webhook para o n8n'], tarefas_existentes: ['T-11', 't-99', 'T-12'] },
      { titulo: 'Equipe treinada', prazo: '25/11', tarefas_novas: ['Roteiro', 'roteiro'], tarefas_existentes: ['T-11', 'T-10'] },
      { titulo: 'Ambiente no ar', tarefas_novas: ['x'] },
      { titulo: '', tarefas_novas: ['y'] },
    ] }
    const r = normalizarPlano(raw, PROJETO, true)
    expect(r).toEqual([
      { titulo: 'Integração concluída', prazo: '2026-10-25', descricao: 'Mensagens chegam no n8n', novas: ['Testar transferência'], existentes: ['b'] },
      { titulo: 'Equipe treinada', prazo: null, descricao: '', novas: ['Roteiro'], existentes: ['a'] },
    ])
  })
  it('resposta fora do formato vira lista vazia, sem lançar', () => {
    expect(normalizarPlano(null, PROJETO, true)).toEqual([])
    expect(normalizarPlano({ marcos: 'nada' }, PROJETO, true)).toEqual([])
  })
  it('com "não aproveitar", ignora rótulos mesmo que a IA mande', () => {
    expect(normalizarPlano({ marcos: [{ titulo: 'A', tarefas_existentes: ['T-11'] }] }, PROJETO, false)[0].existentes).toEqual([])
  })
})

describe('pareceIgual / reaproveitarParecidas', () => {
  it('reconhece a mesma tarefa reescrita, sem casar palavra solta', () => {
    expect(pareceIgual('Padronizar bairros e cadastros no IXC — pendências', 'Padronização de bairros e cadastros no IXC — pendências')).toBe(true)
    expect(pareceIgual('Analisar o plano do cliente e oferecer um upgrade', 'Deve ser capaz de analisar o plano do cliente e oferecer um upgrade se for o caso')).toBe(true)
    expect(pareceIgual('Criar módulo completo de transferência', 'Criar modulo completo de transferência de titularidade')).toBe(true)
    expect(pareceIgual('Testar', 'Testar transferência para atendente')).toBe(false)
    expect(pareceIgual('Configurar domínio', 'Configurar webhook do n8n')).toBe(false)
  })

  // Resposta real do gpt-4o-mini (13/10/2026) com o projeto de atendimento: reescreveu as
  // existentes como novas. Nada disso pode virar duplicata.
  it('resposta real da IA: reescritas viram as existentes, e não duplicatas', () => {
    const tt = (seq: number, title: string, status = 'todo') => t({ id: 'x' + seq, seq, title, status: status as Task['status'] })
    const projeto = [
      tt(73, 'Criar entendimento quando cliente pede carnê', 'done'),
      tt(99, 'Criar modulo completo de transferência de titularidade', 'paused'),
      tt(166, 'Padronização de bairros e cadastros no IXC — pendências'),
      tt(175, 'Religar as IAs reserva: crédito do Gemini e chave do Groq', 'in_progress'),
      tt(92, 'Deve ser capaz de analisar o plano do cliente e oferecer um upgrade se for o caso', 'paused'),
    ]
    const raw = { marcos: [
      { titulo: 'Ambiente estabilizado', prazo: '2026-10-31', tarefas_novas: ['Religar as IAs reserva: crédito do Gemini e chave do Groq', 'Padronizar bairros e cadastros no IXC — pendências'], tarefas_existentes: ['T-73'] },
      { titulo: 'Transferência de titularidade liberada', prazo: '2026-11-30', tarefas_novas: ['Criar módulo completo de transferência de titularidade', 'Avisar a equipe comercial'], tarefas_existentes: [] },
      { titulo: 'Oferta de upgrade implementada', prazo: null, tarefas_novas: ['Analisar o plano do cliente e oferecer um upgrade se for o caso'], tarefas_existentes: [] },
    ] }
    const r = normalizarPlano(raw, projeto, true)
    expect(r.map(m => [m.novas, m.existentes])).toEqual([
      [[], ['x73', 'x175', 'x166']],
      [['Avisar a equipe comercial'], ['x99']],
      [[], ['x92']],
    ])
  })

  it('tarefa já dentro de um marco não é recriada nem movida', () => {
    const r = reaproveitarParecidas([{ titulo: 'F', prazo: null, descricao: '', novas: ['Dentro do marco', 'Nova de verdade'], existentes: [] }], PROJETO)
    expect(r[0]).toMatchObject({ novas: ['Nova de verdade'], existentes: [] })
  })
})

describe('planoLocal', () => {
  const AGORA = new Date('2026-10-13T12:00:00')
  it('linha abre marco, marcador vira tarefa, data vira prazo', () => {
    const r = planoLocal(`Ambiente no ar até 20/10
- Contratar VPS
- Instalar Chatwoot
Fase 2: Integração com o OPA
  • Webhook
Equipe treinada`, AGORA)
    expect(r.map(m => [m.titulo, m.prazo, m.novas])).toEqual([
      ['Ambiente no ar', '2026-10-20', ['Contratar VPS', 'Instalar Chatwoot']],
      ['Integração com o OPA', null, ['Webhook']],
      ['Equipe treinada', null, []],
    ])
  })
  it('texto corrido é cortado nos conectores', () => {
    const r = planoLocal('subir o ambiente; depois integrar com o OPA e por fim treinar a equipe', AGORA)
    expect(r.map(m => m.titulo)).toEqual(['Subir o ambiente', 'Integrar com o OPA', 'Treinar a equipe'])
    expect(planoLocal('primeiro o piloto, depois a produção e por último o treinamento', AGORA).map(m => m.titulo))
      .toEqual(['Primeiro o piloto', 'A produção', 'O treinamento'])
  })
  it('lista só com marcadores: o primeiro abre marco, os seguintes viram tarefas dele', () => {
    const r = planoLocal('- Piloto\n- Ajustar textos', AGORA)
    expect(r).toEqual([{ titulo: 'Piloto', prazo: null, descricao: '', novas: ['Ajustar textos'], existentes: [] }])
  })
})

describe('planejarMarcos', () => {
  it('sem chave usa o modo local e diz que não usou IA', async () => {
    const r = await planejarMarcos({ nome: 'X', descricao: '' }, PROJETO, 'Piloto\nProdução',
      { aproveitar: true, hoje: '2026-10-13' }, { openAIKey: '', geminiApiKey: '' })
    expect(r.usedAI).toBe(false)
    expect(r.marcos.map(m => m.titulo)).toEqual(['Piloto', 'Produção'])
  })
  it('modo local reaproveita a tarefa existente de mesmo nome (sem acento/caixa), uma vez só', async () => {
    const r = await planejarMarcos({ nome: 'X', descricao: '' }, PROJETO, 'Integração\n- webhook PARA o n8n\n- Testar\nOutra\n- Webhook para o n8n',
      { aproveitar: true, hoje: '2026-10-13' }, { openAIKey: '', geminiApiKey: '' })
    expect(r.marcos.map(m => [m.novas, m.existentes])).toEqual([[['Testar'], ['b']], [[], []]])
    // Sem "aproveitar", nada muda: vira tarefa nova.
    const s = await planejarMarcos({ nome: 'X', descricao: '' }, PROJETO, 'Integração\n- Webhook para o n8n',
      { aproveitar: false, hoje: '2026-10-13' }, { openAIKey: '', geminiApiKey: '' })
    expect(s.marcos[0].novas).toEqual(['Webhook para o n8n'])
    expect(reaproveitarParecidas([], PROJETO)).toEqual([])
  })
  it('pedido vazio não gera nada', async () => {
    const r = await planejarMarcos({ nome: 'X', descricao: '' }, PROJETO, '  ', { aproveitar: true, hoje: '2026-10-13' }, { openAIKey: '', geminiApiKey: '' })
    expect(r.marcos).toEqual([])
  })
})
