import { describe, it, expect } from 'vitest'
import { montarMarkdown } from '../exportMarkdown'
import { montarZip, crc32, bytesDeDataUri, extensaoDe } from '../zip'
import type { Task } from '../../types'

const AGORA = new Date('2026-07-30T12:00:00Z')

// 1x1 PNG transparente
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function tarefa(p: Partial<Task> & { id: string; title: string }): Task {
  return {
    workspaceId: 'ws', projectId: 'p1', parentId: null, description: '', blocks: [],
    status: 'todo', priority: 'medium', taskType: 'task', dueDate: null, assignee: '',
    tags: [], checklists: [], customFields: {}, comments: [],
    createdAt: AGORA.toISOString(), updatedAt: AGORA.toISOString(),
    ...p,
  } as Task
}

describe('montarMarkdown', () => {
  it('cada tarefa vira um título e leva os metadados', () => {
    const t = tarefa({ id: 't1', title: 'Renegociar link dedicado', priority: 'high', dueDate: '2026-08-15', assignee: 'Djemeson' })
    const { markdown } = montarMarkdown({ tipo: 'Projeto', titulo: 'Comercial', projetos: [{ nome: 'Comercial', tarefas: [t] }], todasTarefas: [t], agora: AGORA })
    expect(markdown).toContain('# Projeto: Comercial')
    expect(markdown).toContain('## Renegociar link dedicado')
    expect(markdown).toContain('**Prioridade:** Alta')
    expect(markdown).toContain('**Responsável:** Djemeson')
  })

  // Regressão: `new Date('2026-08-20')` é meia-noite UTC; em UTC−3 o documento saía com
  // 19/08/2026. Prazo é data pura e não pode andar por causa de fuso.
  it('prazo não desloca um dia por causa do fuso', () => {
    const t = tarefa({ id: 't1', title: 'T', dueDate: '2026-08-20' })
    const { markdown } = montarMarkdown({ tipo: 'Projeto', titulo: 'P', projetos: [{ nome: 'P', tarefas: [t] }], todasTarefas: [t], agora: AGORA })
    expect(markdown).toContain('**Prazo:** 20/08/2026')
  })

  it('descrição, checklist e estado do item saem no corpo', () => {
    const t = tarefa({
      id: 't1', title: 'Tarefa', description: 'Contexto importante',
      checklists: [{ id: 'c1', title: 'Etapas', items: [
        { id: 'i1', text: 'Feito', done: true }, { id: 'i2', text: 'Pendente', done: false },
      ] }],
    })
    const { markdown } = montarMarkdown({ tipo: 'Projeto', titulo: 'P', projetos: [{ nome: 'P', tarefas: [t] }], todasTarefas: [t], agora: AGORA })
    expect(markdown).toContain('Contexto importante')
    expect(markdown).toContain('Checklist — Etapas')
    expect(markdown).toContain('- [x] Feito')
    expect(markdown).toContain('- [ ] Pendente')
  })

  it('subtarefa vira item de lista, com descrição e checklist dentro', () => {
    const pai   = tarefa({ id: 'pai', title: 'Pai' })
    const filha = tarefa({ id: 'f1', title: 'Filha', parentId: 'pai', description: 'Detalhe da filha',
      checklists: [{ id: 'c', title: 'Passos', items: [{ id: 'i', text: 'Passo um', done: false }] }] })
    const { markdown } = montarMarkdown({ tipo: 'Projeto', titulo: 'P', projetos: [{ nome: 'P', tarefas: [pai] }], todasTarefas: [pai, filha], agora: AGORA })
    expect(markdown).toContain('Subtarefas (1)')
    expect(markdown).toContain('- [ ] **Filha**')
    expect(markdown).toContain('  Detalhe da filha')
    expect(markdown).toContain('  - [ ] Passo um')
  })

  it('desce por subtarefas de subtarefas', () => {
    const a = tarefa({ id: 'a', title: 'Avó' })
    const b = tarefa({ id: 'b', title: 'Mãe',  parentId: 'a' })
    const c = tarefa({ id: 'c', title: 'Neta', parentId: 'b', status: 'done' })
    const { markdown } = montarMarkdown({ tipo: 'Projeto', titulo: 'P', projetos: [{ nome: 'P', tarefas: [a] }], todasTarefas: [a, b, c], agora: AGORA })
    expect(markdown).toContain('- [ ] **Mãe**')
    expect(markdown).toContain('- [x] **Neta**')
    // a neta fica indentada dentro da mãe
    expect(markdown).toMatch(/\n\s{2,}- \[x\] \*\*Neta\*\*/)
  })

  it('imagem vira arquivo referenciado, nunca base64 no texto', () => {
    const t = tarefa({ id: 't1', title: 'Com foto', blocks: [{ id: 'b1', type: 'image', data: PNG, name: 'diagrama.png' }] })
    const { markdown, anexos } = montarMarkdown({ tipo: 'Projeto', titulo: 'P', projetos: [{ nome: 'P', tarefas: [t] }], todasTarefas: [t], agora: AGORA })
    expect(anexos).toHaveLength(1)
    expect(anexos[0].nome).toMatch(/^anexos\/01-diagrama\.png$/)
    expect(markdown).toContain('![diagrama.png](anexos/01-diagrama.png)')
    expect(markdown).not.toContain('base64')
  })

  it('anexos com o mesmo nome não se sobrescrevem no pacote', () => {
    const t1 = tarefa({ id: 't1', title: 'A', blocks: [{ id: 'b1', type: 'image', data: PNG, name: 'foto.png' }] })
    const t2 = tarefa({ id: 't2', title: 'B', blocks: [{ id: 'b2', type: 'image', data: PNG, name: 'foto.png' }] })
    const { anexos } = montarMarkdown({ tipo: 'Projeto', titulo: 'P', projetos: [{ nome: 'P', tarefas: [t1, t2] }], todasTarefas: [t1, t2], agora: AGORA })
    expect(new Set(anexos.map(a => a.nome)).size).toBe(2)
  })

  it('agrupa por projeto quando o escopo tem mais de um', () => {
    const t = tarefa({ id: 't1', title: 'Tarefa' })
    const { markdown } = montarMarkdown({
      tipo: 'Espaço', titulo: 'Operações',
      projetos: [{ nome: 'Rede', tarefas: [t] }, { nome: 'Suporte', tarefas: [] }],
      todasTarefas: [t], agora: AGORA,
    })
    expect(markdown).toContain('## Rede')
    expect(markdown).toContain('## Suporte')
    expect(markdown).toContain('### Tarefa')          // desce um nível
    expect(markdown).toContain('*Nenhuma tarefa neste projeto.*')
  })

  it('título com # não quebra a estrutura do documento', () => {
    const t = tarefa({ id: 't1', title: 'Normal', description: '# Isto era para ser texto' })
    const { markdown } = montarMarkdown({ tipo: 'Projeto', titulo: 'P', projetos: [{ nome: 'P', tarefas: [t] }], todasTarefas: [t], agora: AGORA })
    expect(markdown).toContain('\\# Isto era para ser texto')
  })

  it('comentários entram como contexto', () => {
    const t = tarefa({ id: 't1', title: 'T', comments: [
      { id: 'c1', author: 'Djemeson', text: 'Cliente pediu urgência', createdAt: AGORA.toISOString(), parentId: null },
    ] })
    const { markdown } = montarMarkdown({ tipo: 'Projeto', titulo: 'P', projetos: [{ nome: 'P', tarefas: [t] }], todasTarefas: [t], agora: AGORA })
    expect(markdown).toContain('Comentários')
    expect(markdown).toContain('**Djemeson**')
    expect(markdown).toContain('Cliente pediu urgência')
  })

  it('anexo corrompido não derruba a exportação', () => {
    const t = tarefa({ id: 't1', title: 'T', blocks: [{ id: 'b1', type: 'image', data: 'nao-e-data-uri', name: 'x.png' }] })
    const { markdown, anexos } = montarMarkdown({ tipo: 'Projeto', titulo: 'P', projetos: [{ nome: 'P', tarefas: [t] }], todasTarefas: [t], agora: AGORA })
    expect(anexos).toHaveLength(0)
    expect(markdown).toContain('imagem não pôde ser lida')
  })
})

describe('zip', () => {
  it('produz um arquivo com a assinatura de ZIP', async () => {
    const blob = montarZip([{ nome: 'a.txt', dados: new TextEncoder().encode('oi') }], AGORA)
    const b = new Uint8Array(await blob.arrayBuffer())
    expect([b[0], b[1], b[2], b[3]]).toEqual([0x50, 0x4b, 0x03, 0x04])   // "PK\x03\x04"
    expect(blob.type).toBe('application/zip')
  })

  it('fecha com o registro de fim do diretório central', async () => {
    const blob = montarZip([{ nome: 'a.txt', dados: new TextEncoder().encode('oi') }], AGORA)
    const b = new Uint8Array(await blob.arrayBuffer())
    const fim = b.slice(b.length - 22, b.length - 18)
    expect([...fim]).toEqual([0x50, 0x4b, 0x05, 0x06])                   // "PK\x05\x06"
  })

  it('crc32 bate com o valor conhecido de "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926)
  })

  it('decodifica data URI em bytes', () => {
    const r = bytesDeDataUri(PNG)
    expect(r).not.toBeNull()
    expect(r!.mime).toBe('image/png')
    expect([...r!.bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])  // assinatura PNG
  })

  it('extensão vem do nome quando existe, senão do mime', () => {
    expect(extensaoDe('image/png', 'foto.JPG')).toBe('jpg')
    expect(extensaoDe('image/jpeg')).toBe('jpg')
    expect(extensaoDe('coisa/desconhecida')).toBe('bin')
  })
})
