import { describe, it, expect, vi } from 'vitest'

// Firestore de mentira: um Map de caminho → dados, com a mesma superfície que o módulo usa.
const nuvem = new Map<string, any>()
vi.mock('../firebase', () => ({
  db: {},
  doc: (_db: unknown, ...partes: string[]) => ({ path: partes.join('/') }),
  setDoc: async (ref: any, dados: any) => { nuvem.set(ref.path, dados) },
  getDoc: async (ref: any) => ({ exists: () => nuvem.has(ref.path), data: () => nuvem.get(ref.path) }),
  deleteDoc: async (ref: any) => { nuvem.delete(ref.path) },
}))

import {
  stripAndUploadAttachments, hydrateAttachments, deleteAttachmentsOf,
  mapearImagensDoHtml, partesDe,
} from '../cloudAttachments'

const b64 = (tamanho: number, letra = 'A') => 'data:image/png;base64,' + letra.repeat(tamanho)
const caminho = (grupo: string, id: string) => `syncGroups/${grupo}/attachments/${id}`

const tarefaComImagemNoCorpo = (imagem: string, id = 't1') => ({
  id, workspaceId: 'default', projectId: 'p1', parentId: null, title: 'Tarefa', description: '',
  blocks: [{ id: 'b1', type: 'text' as const, region: 'body' as const, text: `<div>Antes</div><img src="${imagem}" alt="captura.png"><div>Depois</div>` }],
  status: 'todo' as const, priority: 'medium' as const, taskType: 'task' as const, dueDate: null,
  assignee: 'DJ', tags: [], checklists: [], customFields: {}, comments: [],
  createdAt: '2026-09-08T12:00:00.000Z', updatedAt: '2026-09-08T12:00:00.000Z',
})

describe('mapearImagensDoHtml', () => {
  it('troca só o src, preservando os demais atributos e a ordem', () => {
    const html = '<img src="a.png" alt="um"><p>oi</p><img alt="dois" src="b.png" width="20">'
    const r = mapearImagensDoHtml(html, (src, i) => `${i}:${src}`)
    expect(r).toBe('<img src="0:a.png" alt="um"><p>oi</p><img alt="dois" src="1:b.png" width="20">')
  })

  it('devolver null mantém a imagem intacta', () => {
    const html = '<img src="a.png" alt="um">'
    expect(mapearImagensDoHtml(html, () => null)).toBe(html)
  })
})

describe('sincronização de imagem colada/embutida na descrição', () => {
  // A regressão: o base64 ia inteiro no documento de sincronização, estourava o limite de
  // 1 MiB do Firestore, o push falhava e a descrição voltava ao estado da nuvem.
  it('tira o base64 do documento e devolve a mesma descrição ao reidratar', async () => {
    const imagem = b64(5_000)
    const tarefa = tarefaComImagemNoCorpo(imagem)

    const [enviada] = await stripAndUploadAttachments('g1', [tarefa] as any)
    const textoEnviado = enviada.blocks[0].text!
    expect(textoEnviado).not.toContain('base64,AAAA')      // o peso saiu do documento
    expect(textoEnviado).toContain('cloudref:b1__inline0')
    expect(textoEnviado).toContain('Antes')                 // o resto do HTML fica igual

    const [voltou] = await hydrateAttachments('g1', [enviada])
    expect(voltou.blocks[0].text).toBe(tarefa.blocks[0].text)
  })

  it('imagem maior que um documento é fatiada e remontada igual', async () => {
    const imagem = b64(2_300_000)                           // ~2,3 MB: 3 partes
    expect(partesDe(imagem)).toBe(3)
    const [enviada] = await stripAndUploadAttachments('g2', [tarefaComImagemNoCorpo(imagem)] as any)
    expect(nuvem.has(caminho('g2', 'b1__inline0__p2'))).toBe(true)

    const [voltou] = await hydrateAttachments('g2', [enviada])
    expect(voltou.blocks[0].text).toContain(imagem)
  })

  it('trocar a imagem da mesma posição não devolve a antiga (cache por conteúdo)', async () => {
    const antiga = b64(1_000, 'A'), nova = b64(1_000, 'B')
    const [env1] = await stripAndUploadAttachments('g3', [tarefaComImagemNoCorpo(antiga)] as any)
    await hydrateAttachments('g3', [env1])                  // popula o cache de leitura

    const [env2] = await stripAndUploadAttachments('g3', [tarefaComImagemNoCorpo(nova)] as any)
    const [voltou] = await hydrateAttachments('g3', [env2])
    expect(voltou.blocks[0].text).toContain(nova)
    expect(voltou.blocks[0].text).not.toContain(antiga)
  })

  it('anexo comum continua saindo do documento e voltando inteiro', async () => {
    const tarefa = {
      ...tarefaComImagemNoCorpo('', 't2'),
      blocks: [{ id: 'b9', type: 'image' as const, region: 'attachment' as const, data: b64(4_000), name: 'foto.png' }],
    }
    const [enviada] = await stripAndUploadAttachments('g4', [tarefa] as any)
    expect(enviada.blocks[0].data).toBe('')
    const [voltou] = await hydrateAttachments('g4', [enviada])
    expect(voltou.blocks[0].data).toBe(tarefa.blocks[0].data)
  })

  it('excluir a tarefa apaga também as imagens do corpo (nada de blob órfão)', async () => {
    const tarefa = tarefaComImagemNoCorpo(b64(1_000_000), 't5')   // 2 partes
    await stripAndUploadAttachments('g5', [tarefa] as any)
    expect([...nuvem.keys()].some(k => k.startsWith(caminho('g5', 'b1__inline0')))).toBe(true)

    await deleteAttachmentsOf('g5', [tarefa] as any)
    expect([...nuvem.keys()].some(k => k.startsWith(caminho('g5', '')))).toBe(false)
  })
})
