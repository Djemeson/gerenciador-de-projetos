import { describe, it, expect } from 'vitest'
import { estaAtrasada, venceHoje, formatarPrazo, inicioDeHoje } from '../dueDate'

// 01/08/2026, 11h da manhã, hora local.
const AGORA = new Date(2026, 7, 1, 11, 0, 0)

describe('estaAtrasada', () => {
  // A regressão principal: com `new Date('2026-08-01')` o prazo de hoje virava
  // "31/07 21:00" em UTC−3 e a tarefa nascia vermelha.
  it('prazo de hoje NÃO é atraso', () => {
    expect(estaAtrasada('2026-08-01', 'todo', AGORA)).toBe(false)
  })

  it('prazo de ontem é atraso', () => {
    expect(estaAtrasada('2026-07-31', 'todo', AGORA)).toBe(true)
  })

  it('prazo futuro não é atraso', () => {
    expect(estaAtrasada('2026-08-20', 'todo', AGORA)).toBe(false)
  })

  it('tarefa concluída nunca é atraso', () => {
    expect(estaAtrasada('2026-01-01', 'done', AGORA)).toBe(false)
  })

  it('sem prazo não é atraso', () => {
    expect(estaAtrasada(null, 'todo', AGORA)).toBe(false)
    expect(estaAtrasada(undefined, 'todo', AGORA)).toBe(false)
    expect(estaAtrasada('', 'todo', AGORA)).toBe(false)
  })

  it('data inválida não vira atraso', () => {
    expect(estaAtrasada('nao-e-data', 'todo', AGORA)).toBe(false)
  })

  it('vale para qualquer hora do dia do vencimento', () => {
    const cedo  = new Date(2026, 7, 1, 0, 1, 0)
    const tarde = new Date(2026, 7, 1, 23, 59, 0)
    expect(estaAtrasada('2026-08-01', 'todo', cedo)).toBe(false)
    expect(estaAtrasada('2026-08-01', 'todo', tarde)).toBe(false)
  })
})

describe('venceHoje', () => {
  it('reconhece o prazo do dia', () => {
    expect(venceHoje('2026-08-01', AGORA)).toBe(true)
    expect(venceHoje('2026-08-02', AGORA)).toBe(false)
    expect(venceHoje('2026-07-31', AGORA)).toBe(false)
    expect(venceHoje(null, AGORA)).toBe(false)
  })
})

describe('formatarPrazo', () => {
  // O outro sintoma: 20/08 aparecia como 19/08 na lista, no board e na tabela.
  it('não desloca o dia', () => {
    expect(formatarPrazo('2026-08-20', { day: '2-digit', month: '2-digit', year: 'numeric' }))
      .toBe('20/08/2026')
  })

  it('data inválida volta como veio, sem quebrar a tela', () => {
    expect(formatarPrazo('xx')).toBe('xx')
  })
})

describe('inicioDeHoje', () => {
  it('zera a hora sem mudar o dia', () => {
    const d = inicioDeHoje(AGORA)
    expect(d.getDate()).toBe(1)
    expect(d.getMonth()).toBe(7)
    expect(d.getHours()).toBe(0)
  })
})
