import { describe, it, expect } from 'vitest'
import { parseSmartCapture } from '../smartCapture'
import { isoDate } from '../dateFilter'

// Quarta-feira, 29/07/2026, meio-dia — data fixa para os testes serem determinísticos.
const AGORA = new Date(2026, 6, 29, 12, 0, 0)
const dias = (n: number) => { const d = new Date(AGORA); d.setDate(d.getDate() + n); return isoDate(d) }

describe('parseSmartCapture — prazo', () => {
  it('entende hoje / amanhã / depois de amanhã e limpa o título', () => {
    expect(parseSmartCapture('pagar boleto hoje', AGORA)).toMatchObject({ title: 'pagar boleto', dueDate: dias(0) })
    expect(parseSmartCapture('ligar pro cliente amanhã', AGORA)).toMatchObject({ title: 'ligar pro cliente', dueDate: dias(1) })
    expect(parseSmartCapture('revisar contrato depois de amanhã', AGORA)).toMatchObject({ title: 'revisar contrato', dueDate: dias(2) })
  })

  it('entende dia da semana como a PRÓXIMA ocorrência (nunca hoje)', () => {
    // AGORA é quarta (day 3): "sexta" = +2; "quarta" = +7 (a próxima, não hoje)
    expect(parseSmartCapture('enviar relatório sexta', AGORA).dueDate).toBe(dias(2))
    expect(parseSmartCapture('reunião quarta', AGORA).dueDate).toBe(dias(7))
    expect(parseSmartCapture('culto domingo', AGORA).dueDate).toBe(dias(4))
  })

  it('entende dd/mm e assume o ano que vem se a data já passou', () => {
    expect(parseSmartCapture('entregar projeto 15/08', AGORA).dueDate).toBe('2026-08-15')
    expect(parseSmartCapture('renovar certificado 15/01', AGORA).dueDate).toBe('2027-01-15')
  })

  it('remove preposição pendurada ("para sexta" → título sem "para")', () => {
    expect(parseSmartCapture('agendar visita para sexta', AGORA).title).toBe('agendar visita')
  })

  it('sem termo de data, dueDate é null e o título fica intacto', () => {
    const r = parseSmartCapture('organizar backlog do trimestre', AGORA)
    expect(r.dueDate).toBeNull()
    expect(r.title).toBe('organizar backlog do trimestre')
    expect(r.matched).toHaveLength(0)
  })
})

describe('parseSmartCapture — prioridade', () => {
  it('urgente / importante / sem pressa mapeiam para as prioridades', () => {
    expect(parseSmartCapture('trocar roteador urgente', AGORA)).toMatchObject({ title: 'trocar roteador', priority: 'urgent' })
    expect(parseSmartCapture('documentar processo importante', AGORA).priority).toBe('high')
    expect(parseSmartCapture('arquivar fotos sem pressa', AGORA).priority).toBe('low')
  })

  it('combina prazo + prioridade na mesma frase', () => {
    const r = parseSmartCapture('ligar pro fornecedor amanhã urgente', AGORA)
    expect(r).toMatchObject({ title: 'ligar pro fornecedor', dueDate: dias(1), priority: 'urgent' })
    expect(r.matched.map(m => m.kind).sort()).toEqual(['date', 'priority'])
  })

  it('palavra dentro de outra não dispara (ex: "urgentemente" não é "urgente")', () => {
    // \b garante fronteira — "urgência" no meio de palavra composta não deve casar
    expect(parseSmartCapture('estudar urgencias médicas', AGORA).priority).toBeNull()
  })
})
