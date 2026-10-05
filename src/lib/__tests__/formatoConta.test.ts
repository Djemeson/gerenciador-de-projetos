import { describe, it, expect } from 'vitest'
import { montarLista, diferenca, assinatura, assinaturasDe, ehFormatoAntigo, FORMATO_ATUAL } from '../formatoConta'

const T1 = '2026-10-01T10:00:00.000Z'
const T2 = '2026-10-02T10:00:00.000Z'
const item = (id: string, seq: number, updatedAt = T1, extra: Record<string, unknown> = {}) =>
  ({ id, seq, title: `Tarefa ${id}`, createdAt: T1, updatedAt, ...extra })

describe('formato da conta — montarLista', () => {
  it('segue a ordem guardada no documento principal', () => {
    const r = montarLista([item('a', 1), item('b', 2), item('c', 3)], ['c', 'a', 'b'], undefined)
    expect(r.map(i => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('item fora da ordem (criado num envio ainda não refletido nela) vai para o fim, pelo número', () => {
    const r = montarLista([item('z', 9), item('a', 1), item('m', 5)], ['a'], undefined)
    expect(r.map(i => i.id)).toEqual(['a', 'm', 'z'])
  })

  it('id na ordem sem documento (excluído) é ignorado, sem buraco', () => {
    const r = montarLista([item('a', 1)], ['x', 'a'], undefined)
    expect(r.map(i => i.id)).toEqual(['a'])
  })

  it('conta no formato antigo: a lista de dentro do documento vira a fonte, na ordem dela', () => {
    const r = montarLista([], undefined, [item('b', 2), item('a', 1)])
    expect(r.map(i => i.id)).toEqual(['b', 'a'])
  })

  it('aparelho com versão antiga: edição mais nova que a da coleção vence; mais velha não', () => {
    const colecao = [item('a', 1, T1, { title: 'coleção' }), item('b', 2, T2, { title: 'coleção' })]
    const legado = [item('a', 1, T2, { title: 'antigo, mais novo' }), item('b', 2, T1, { title: 'antigo, mais velho' })]
    const r = montarLista(colecao, ['a', 'b'], legado)
    expect(r.find(i => i.id === 'a')!.title).toBe('antigo, mais novo')
    expect(r.find(i => i.id === 'b')!.title).toBe('coleção')
  })

  it('aparelho com versão antiga não ressuscita o que foi excluído depois da última edição', () => {
    const excluidoEm = Date.parse(T2)
    const r = montarLista([item('a', 1)], ['a'], [item('a', 1), item('x', 7, T1)], { x: excluidoEm })
    expect(r.map(i => i.id)).toEqual(['a'])
  })

  it('mas devolve o item editado depois da exclusão (restaurado noutro aparelho)', () => {
    const r = montarLista([], undefined, [item('x', 7, T2)], { x: Date.parse(T1) })
    expect(r.map(i => i.id)).toEqual(['x'])
  })

  it('não duplica item presente na coleção e no legado', () => {
    const r = montarLista([item('a', 1)], ['a'], [item('a', 1)])
    expect(r).toHaveLength(1)
  })
})

describe('formato da conta — diferenca', () => {
  it('grava só o que mudou e apaga o que saiu', () => {
    const servidor = assinaturasDe([item('a', 1), item('b', 2), item('c', 3)])
    const r = diferenca(servidor, [item('a', 1), item('b', 2, T2), item('d', 4)])
    expect(r.gravar.map(i => i.id)).toEqual(['b', 'd'])
    expect(r.apagar).toEqual(['c'])
  })

  it('ordem de chaves e campos undefined não contam como mudança', () => {
    const doServidor = { id: 'a', title: 'x', tags: ['1'], meta: { b: 2, a: 1 } }
    const local = { meta: { a: 1, b: 2 }, tags: ['1'], title: 'x', id: 'a', vazio: undefined }
    expect(assinatura(local)).toBe(assinatura(doServidor))
    expect(diferenca(assinaturasDe([doServidor]), [local]).gravar).toHaveLength(0)
  })

  it('servidor vazio (primeira conversão): grava tudo', () => {
    const r = diferenca(new Map(), [item('a', 1), item('b', 2)])
    expect(r.gravar).toHaveLength(2)
    expect(r.apagar).toEqual([])
  })
})

describe('formato da conta — ehFormatoAntigo', () => {
  it('reconhece o documento que ainda carrega as listas ou não tem o carimbo do formato', () => {
    expect(ehFormatoAntigo({ tasks: [], projects: [] })).toBe(true)
    expect(ehFormatoAntigo({ formato: FORMATO_ATUAL, tasks: [] })).toBe(true)
    expect(ehFormatoAntigo({ spaces: [] })).toBe(true)
    expect(ehFormatoAntigo({ formato: FORMATO_ATUAL, ordemTarefas: [] })).toBe(false)
    expect(ehFormatoAntigo(undefined)).toBe(false)
  })
})
