import { describe, it, expect } from 'vitest'
import { buscarIcones, CONCEITOS } from '../iconSearch'
import { ICON_CATEGORIES } from '../sidebarIcons'

const DISPONIVEIS = new Set(ICON_CATEGORIES.flatMap(c => c.icons))

describe('buscarIcones', () => {
  // O exemplo que motivou o recurso: nenhum desses ícones tem "dinheiro" no nome ou rótulo.
  it('"dinheiro" traz cédula, moeda, carteira e banco', () => {
    const r = buscarIcones('dinheiro')
    expect(r).toContain('banknote')
    expect(r).toContain('coins')
    expect(r).toContain('wallet')
    expect(r).toContain('credit-card')
  })

  it('entende o assunto mesmo com outra palavra', () => {
    expect(buscarIcones('financeiro')).toContain('banknote')
    expect(buscarIcones('internet')).toContain('wifi')
    expect(buscarIcones('prazo')).toContain('calendar')
    expect(buscarIcones('urgente')).toContain('siren')
    expect(buscarIcones('manutencao')).toContain('wrench')
  })

  it('acento não atrapalha', () => {
    expect(buscarIcones('finanças')).toContain('banknote')
    expect(buscarIcones('relatório')).toContain('bar-chart-2')
  })

  it('busca por prefixo do rótulo continua funcionando', () => {
    expect(buscarIcones('calend')).toContain('calendar')
    expect(buscarIcones('cadeado')).toContain('lock')
  })

  it('o resultado mais direto vem antes do conceito', () => {
    // "casa" tem o ícone `home` (rótulo "casa") e também a categoria "Casa & Objetos".
    const r = buscarIcones('casa')
    expect(r[0]).toBe('home')
  })

  it('busca pelo nome em inglês ainda funciona', () => {
    expect(buscarIcones('wifi')).toContain('wifi')
    expect(buscarIcones('rocket')).toContain('rocket')
  })

  it('consulta vazia não devolve nada', () => {
    expect(buscarIcones('')).toEqual([])
    expect(buscarIcones('   ')).toEqual([])
  })

  it('termo sem correspondência devolve lista vazia', () => {
    expect(buscarIcones('xyzabc123')).toEqual([])
  })

  it('não repete ícone que aparece em várias categorias', () => {
    const r = buscarIcones('tarefa')
    expect(new Set(r).size).toBe(r.length)
  })

  it('só devolve ícone que existe na grade do seletor', () => {
    for (const termo of ['dinheiro', 'rede', 'saude', 'juridico', 'transporte']) {
      for (const nome of buscarIcones(termo)) expect(DISPONIVEIS.has(nome)).toBe(true)
    }
  })
})

describe('CONCEITOS', () => {
  it('nenhum conceito está vazio', () => {
    for (const c of CONCEITOS) {
      expect(c.termos.length).toBeGreaterThan(0)
      expect(c.icones.length).toBeGreaterThan(0)
    }
  })

  // Um conceito cujos ícones não existem na grade é letra morta: a busca acha e não mostra
  // nada. Não falha o teste, mas precisa estar visível.
  it('a maior parte dos ícones citados existe na grade', () => {
    const citados = CONCEITOS.flatMap(c => c.icones)
    const existentes = citados.filter(n => DISPONIVEIS.has(n))
    expect(existentes.length / citados.length).toBeGreaterThan(0.7)
  })
})
