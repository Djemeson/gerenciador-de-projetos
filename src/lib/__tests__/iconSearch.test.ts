import { describe, it, expect } from 'vitest'
import { buscarIcones, CONCEITOS } from '../iconSearch'
import { ICON_CATEGORIES, getIconComponent } from '../sidebarIcons'
import { ICON_LABEL_PT } from '../iconLabelsPt'

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

describe('escopo ampliado (01/08/2026)', () => {
  it('assuntos do dia a dia de um provedor', () => {
    expect(buscarIcones('ordem de servico')).toContain('hard-hat')
    expect(buscarIcones('cobranca')).toContain('receipt')
    expect(buscarIcones('cancelamento')).toContain('user-x')
    expect(buscarIcones('estoque')).toContain('package')
    expect(buscarIcones('contrato')).toContain('file-text')
  })

  it('assuntos gerais que antes não tinham nada', () => {
    expect(buscarIcones('emocao')).toContain('smile')
    expect(buscarIcones('academia')).toContain('dumbbell')
    expect(buscarIcones('pet')).toContain('dog')
    expect(buscarIcones('ciencia')).toContain('flask-conical')
    expect(buscarIcones('matematica')).toContain('sigma')
    expect(buscarIcones('kanban')).toContain('kanban')
    expect(buscarIcones('backup')).toContain('cloud-upload')
    expect(buscarIcones('desfazer')).toContain('undo')
  })

  // Regressões de ranking pegas testando no seletor real.
  it('termo curto dentro de outra palavra não dispara o conceito', () => {
    // O conceito de IA tem o termo "ia", e "academia" contém "ia".
    const r = buscarIcones('academia')
    expect(r).not.toContain('bot')
    expect(r).not.toContain('cpu')
    expect(r).toContain('dumbbell')
  })

  it('conceito exato vem antes de substring acidental', () => {
    // "repetir" contém "pet" (re-pet-ir) e vinha na frente dos animais.
    const r = buscarIcones('pet')
    expect(r.indexOf('dog')).toBeLessThan(r.indexOf('repeat'))
  })

  it('frase encontra o conceito pela palavra inteira', () => {
    expect(buscarIcones('controle de estoque')).toContain('package')
  })

  it('o catálogo cresceu e não tem nome quebrado', () => {
    const todos = ICON_CATEGORIES.flatMap(c => c.icons)
    expect(new Set(todos).size).toBeGreaterThan(500)
    expect(ICON_CATEGORIES.length).toBeGreaterThanOrEqual(24)
  })

  // A lista antiga tinha 34 nomes que não existiam na lucide instalada: a grade os pulava
  // em silêncio, então eram buracos invisíveis no seletor.
  it('todo nome do catálogo resolve para um componente real', () => {
    const quebrados = [...new Set(ICON_CATEGORIES.flatMap(c => c.icons))].filter(n => !getIconComponent(n))
    expect(quebrados).toEqual([])
  })

  // Verifica a **presença no mapa**, não `iconLabel(n) === n`: há 22 ícones cujo rótulo é
  // igual em português ('link', 'menu', 'bitcoin', 'podcast', 'usb', 'dna', 'pi'...), e
  // comparar as strings acusaria falta de tradução onde ela existe.
  it('todo ícone do catálogo tem rótulo em português', () => {
    const semRotulo = [...new Set(ICON_CATEGORIES.flatMap(c => c.icons))].filter(n => !(n in ICON_LABEL_PT))
    expect(semRotulo).toEqual([])
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
