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

// ── Ampliação de 01/08/2026: projeto, etiquetas, responsável e tipo ──────────

const VOCAB = {
  projetos: [
    { id: 'p1', name: 'Migração de rede' },
    { id: 'p2', name: 'Rede' },
    { id: 'p3', name: 'Financeiro' },
  ],
  responsaveis: ['Djemeson', 'Ana Paula'],
}

describe('parseSmartCapture — projeto', () => {
  it('reconhece o nome do projeto e tira do título', () => {
    const r = parseSmartCapture('trocar switch no Financeiro', AGORA, VOCAB)
    expect(r.projectId).toBe('p3')
    expect(r.title).toBe('trocar switch')
  })

  // "Rede" e "Migração de rede" existem: falar o nome longo não pode casar o curto.
  it('prefere o nome mais longo quando um contém o outro', () => {
    expect(parseSmartCapture('revisar Migração de rede', AGORA, VOCAB).projectId).toBe('p1')
  })

  it('acento e caixa não atrapalham', () => {
    expect(parseSmartCapture('ajustar migracao de rede', AGORA, VOCAB).projectId).toBe('p1')
    expect(parseSmartCapture('ajustar MIGRAÇÃO DE REDE', AGORA, VOCAB).projectId).toBe('p1')
  })

  it('sem projeto no texto devolve null — quem decide o destino é a interface', () => {
    expect(parseSmartCapture('comprar cabo', AGORA, VOCAB).projectId).toBeNull()
  })

  it('sem vocabulário não tenta adivinhar projeto', () => {
    expect(parseSmartCapture('trocar switch no Financeiro', AGORA).projectId).toBeNull()
  })
})

describe('parseSmartCapture — etiquetas, responsável e tipo', () => {
  it('coleta etiquetas com # e limpa o título', () => {
    const r = parseSmartCapture('revisar contrato #juridico #urgente-cliente', AGORA, VOCAB)
    expect(r.tags).toEqual(['juridico', 'urgente-cliente'])
    expect(r.title).toBe('revisar contrato')
  })

  it('reconhece responsável com @ e casa com o nome cadastrado', () => {
    const r = parseSmartCapture('ligar pro cliente @djemeson', AGORA, VOCAB)
    expect(r.assignee).toBe('Djemeson')   // devolve o nome como está cadastrado
    expect(r.title).toBe('ligar pro cliente')
  })

  it('responsável não cadastrado sai como foi escrito', () => {
    expect(parseSmartCapture('tarefa @carlos', AGORA, VOCAB).assignee).toBe('carlos')
  })

  it('entende o tipo de tarefa', () => {
    expect(parseSmartCapture('corrigir bug do login', AGORA, VOCAB).taskType).toBe('bug')
    expect(parseSmartCapture('reunião com fornecedor', AGORA, VOCAB).taskType).toBe('meeting_note')
    expect(parseSmartCapture('entrega da fase 1', AGORA, VOCAB).taskType).toBe('milestone')
  })

  it('junta tudo numa frase só, como sai da fala', () => {
    const r = parseSmartCapture('reunião com fornecedor amanhã urgente no Financeiro @ana paula #comercial', AGORA, VOCAB)
    expect(r.dueDate).toBe(dias(1))
    expect(r.priority).toBe('urgent')
    expect(r.projectId).toBe('p3')
    expect(r.taskType).toBe('meeting_note')
    expect(r.tags).toEqual(['comercial'])
    expect(r.assignee).toBe('ana')
    expect(r.title.length).toBeGreaterThan(0)
  })

  it('texto sem marcador nenhum não inventa campo', () => {
    const r = parseSmartCapture('comprar cabo de rede', AGORA, { projetos: [] })
    expect(r).toMatchObject({ priority: null, dueDate: null, projectId: null, assignee: null, taskType: null })
    expect(r.tags).toEqual([])
  })
})

describe('parseSmartCapture — o tipo não é arrancado do título', () => {
  // "reunião com fornecedor" virava "com fornecedor": a palavra que define o tipo também é
  // o assunto da tarefa, ao contrário de "amanhã" ou "urgente".
  it('mantém a palavra do tipo no título', () => {
    const r = parseSmartCapture('reunião com fornecedor', AGORA, VOCAB)
    expect(r.taskType).toBe('meeting_note')
    expect(r.title).toBe('reunião com fornecedor')
  })

  it('idem para bug', () => {
    const r = parseSmartCapture('bug do login', AGORA, VOCAB)
    expect(r.taskType).toBe('bug')
    expect(r.title).toBe('bug do login')
  })

  it('prazo e prioridade continuam saindo do título', () => {
    const r = parseSmartCapture('reunião com fornecedor amanhã urgente', AGORA, VOCAB)
    expect(r.title).toBe('reunião com fornecedor')
    expect(r.taskType).toBe('meeting_note')
    expect(r.priority).toBe('urgent')
  })
})
