import { describe, it, expect, vi, beforeEach } from 'vitest'

// Cofre de mentira no lugar do IndexedDB: um Map id → base64.
const cofre = new Map<string, string>()
vi.mock('../blobStore', () => ({
  guardarBlobs: async (entradas: { id: string; data: string }[]) => { entradas.forEach(e => cofre.set(e.id, e.data)); return true },
  lerBlobs: async (ids: string[]) => new Map(ids.filter(i => cofre.has(i)).map(i => [i, cofre.get(i)!])),
  manterApenas: async (vivos: Set<string>) => { [...cofre.keys()].forEach(k => { if (!vivos.has(k)) cofre.delete(k) }) },
  cofreDisponivel: async () => true,
}))

import { extrairBlobs, reidratarBlobs, sincronizarCofre, PREFIXO_LOCAL } from '../localAttachments'

const b64 = (n: number, letra = 'A') => 'data:application/pdf;base64,' + letra.repeat(n)

const tarefa = (over: Record<string, any> = {}): any => ({
  id: 't1', workspaceId: 'default', projectId: 'p1', parentId: null, title: 'Tarefa', description: '',
  blocks: [], status: 'todo', priority: 'medium', taskType: 'task', dueDate: null,
  assignee: 'DJ', tags: [], checklists: [], customFields: {}, comments: [],
  createdAt: '2026-09-12T12:00:00.000Z', updatedAt: '2026-09-12T12:00:00.000Z', ...over,
})

beforeEach(() => cofre.clear())

describe('extrairBlobs', () => {
  it('tira o anexo do JSON e devolve o conteúdo separado', () => {
    const pdf = b64(5000)
    const t = tarefa({ blocks: [{ id: 'b1', type: 'file', region: 'attachment', name: 'contrato.pdf', data: pdf }] })
    const { enxutas, blobs } = extrairBlobs([t])

    expect((enxutas[0].blocks[0] as any).data).toBe('')
    expect((enxutas[0].blocks[0] as any).lref).toBe('b1__block')
    expect(enxutas[0].blocks[0].name).toBe('contrato.pdf')   // o que a lista mostra continua no JSON
    expect(blobs).toEqual([{ id: 'b1__block', data: pdf }])
    expect(JSON.stringify(enxutas)).not.toContain('AAAA')    // nenhum base64 sobra no que vai ser gravado
  })

  it('tira também anexo e áudio de comentário e imagem colada na descrição', () => {
    const t = tarefa({
      comments: [{ id: 'c1', author: 'DJ', text: 'segue', createdAt: '', attachment: { name: 'a.pdf', mimeType: 'application/pdf', data: b64(100, 'B') }, audio: { data: b64(100, 'C') } }],
      blocks: [{ id: 'b1', type: 'text', region: 'body', text: `<p><img src="${b64(100, 'D')}"></p>` }],
    })
    const { enxutas, blobs } = extrairBlobs([t])

    expect(blobs.map(b => b.id).sort()).toEqual(['b1__inline0', 'c1__attachment', 'c1__audio'])
    expect(enxutas[0].blocks[0].text).toContain(`${PREFIXO_LOCAL}b1__inline0`)
    expect(JSON.stringify(enxutas)).not.toMatch(/base64,[A-D]{10}/)
  })

  it('não desmonta uma tarefa que já veio do disco só com referência', () => {
    const t = tarefa({ blocks: [{ id: 'b1', type: 'file', region: 'attachment', data: '', lref: 'b1__block' }] })
    const { blobs, vivos } = extrairBlobs([t])
    expect(blobs).toEqual([])
    expect(vivos.has('b1__block')).toBe(true)   // continua em uso: a faxina não pode apagá-lo
  })
})

describe('ida e volta', () => {
  it('devolve o anexo intacto depois de gravar e reler', async () => {
    const pdf = b64(9000)
    const t = tarefa({
      blocks: [{ id: 'b1', type: 'file', region: 'attachment', name: 'contrato.pdf', data: pdf }],
      comments: [{ id: 'c1', author: 'DJ', text: '', createdAt: '', attachment: { name: 'b.pdf', mimeType: 'application/pdf', data: b64(200, 'E') } }],
    })
    const extracao = extrairBlobs([t])
    await sincronizarCofre(extracao)

    const devolvidas = await reidratarBlobs(JSON.parse(JSON.stringify(extracao.enxutas)))
    expect((devolvidas[0].blocks[0] as any).data).toBe(pdf)
    expect((devolvidas[0].comments[0].attachment as any).data).toBe(b64(200, 'E'))
  })

  it('devolve a imagem para dentro do HTML da descrição', async () => {
    const img = b64(300, 'F')
    const t = tarefa({ blocks: [{ id: 'b1', type: 'text', region: 'body', text: `<p>antes</p><img src="${img}" alt="x"><p>depois</p>` }] })
    const extracao = extrairBlobs([t])
    await sincronizarCofre(extracao)

    const devolvidas = await reidratarBlobs(extracao.enxutas)
    expect(devolvidas[0].blocks[0].text).toBe(`<p>antes</p><img src="${img}" alt="x"><p>depois</p>`)
  })

  it('mantém o marcador quando o cofre foi limpo, em vez de perder a referência', async () => {
    const t = tarefa({ blocks: [{ id: 'b1', type: 'text', region: 'body', text: `<img src="${PREFIXO_LOCAL}b1__inline0">` }] })
    const devolvidas = await reidratarBlobs([t] as any)
    expect(devolvidas[0].blocks[0].text).toContain(PREFIXO_LOCAL)
  })
})

describe('faxina do cofre', () => {
  it('apaga o blob do anexo excluído e preserva o que ficou', async () => {
    const comDois = tarefa({ blocks: [
      { id: 'b1', type: 'file', region: 'attachment', data: b64(50, 'G') },
      { id: 'b2', type: 'file', region: 'attachment', data: b64(50, 'H') },
    ] })
    await sincronizarCofre(extrairBlobs([comDois]))
    expect([...cofre.keys()].sort()).toEqual(['b1__block', 'b2__block'])

    // usuário remove o segundo anexo
    const comUm = tarefa({ blocks: [{ id: 'b1', type: 'file', region: 'attachment', data: '', lref: 'b1__block' }] })
    await sincronizarCofre(extrairBlobs([comUm]))
    expect([...cofre.keys()]).toEqual(['b1__block'])
  })
})
