import { describe, it, expect } from 'vitest'
import { numerar, lerIdCurto, formatarId, mesclarContadores } from '../shortIds'

const item = (id: string, createdAt: string, seq?: number) => ({ id, createdAt, seq })

describe('numerar', () => {
  it('numera o que já existe em ordem de criação (a mais antiga vira 1)', () => {
    const r = numerar([item('c', '2026-03-01'), item('a', '2026-01-01'), item('b', '2026-02-01')], 0)
    expect(r.itens.map(i => [i.id, i.seq])).toEqual([['c', 3], ['a', 1], ['b', 2]])
    expect(r.contador).toBe(3)
    expect(r.mudou).toBe(true)
  })

  it('não reaproveita o número de item excluído (o contador manda, não o maior existente)', () => {
    const r = numerar([item('a', '2026-01-01', 1), item('novo', '2026-05-01')], 7)
    expect(r.itens[1].seq).toBe(8)
  })

  it('número repetido fica com o item mais antigo; o mais novo ganha o próximo livre', () => {
    const r = numerar([item('novo', '2026-05-02', 5), item('velho', '2026-05-01', 5)], 5)
    expect(r.itens.find(i => i.id === 'velho')!.seq).toBe(5)
    expect(r.itens.find(i => i.id === 'novo')!.seq).toBe(6)
  })

  it('é determinístico: dois aparelhos com a mesma lista chegam aos mesmos números', () => {
    const lista = [item('x', '2026-01-01'), item('y', '2026-01-01'), item('z', '2025-12-31')]
    const a = numerar(lista, 0).itens.map(i => i.seq)
    const b = numerar([...lista].reverse(), 0).itens.reverse().map(i => i.seq)
    expect(a).toEqual(b)
  })

  it('não toca em nada quando todos já têm número (mesma referência)', () => {
    const lista = [item('a', '2026-01-01', 1), item('b', '2026-01-02', 2)]
    const r = numerar(lista, 2)
    expect(r.mudou).toBe(false)
    expect(r.itens).toBe(lista)
  })

  it('não mexe no updatedAt dos itens', () => {
    const r = numerar([{ id: 'a', createdAt: '2026-01-01', updatedAt: 'U' }], 0)
    expect(r.itens[0].updatedAt).toBe('U')
  })
})

describe('lerIdCurto / formatarId', () => {
  it('aceita as formas comuns de digitar', () => {
    for (const t of ['T-142', 't142', '#T-142', 'T 142', ' T-142 ']) expect(lerIdCurto(t)).toEqual({ tipo: 'task', seq: 142 })
    expect(lerIdCurto('P-12')).toEqual({ tipo: 'project', seq: 12 })
  })
  it('recusa o que não é ID curto', () => {
    for (const t of ['142', 'X-1', 'T-0', 'T-', 'abc', 'T-1a']) expect(lerIdCurto(t)).toBeNull()
  })
  it('formata e ignora número ausente', () => {
    expect(formatarId('task', 142)).toBe('T-142')
    expect(formatarId('project', undefined)).toBe('')
  })
})

describe('mesclarContadores', () => {
  it('fica com o maior de cada lado (o contador nunca volta)', () => {
    expect(mesclarContadores({ task: 10, project: 2 }, { task: 8, project: 5 })).toEqual({ task: 10, project: 5 })
    expect(mesclarContadores(undefined, { task: 3 })).toEqual({ task: 3, project: 0 })
  })
})
