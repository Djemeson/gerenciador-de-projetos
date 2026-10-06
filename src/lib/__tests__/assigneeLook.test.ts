import { describe, it, expect } from 'vitest'
import { assigneeLook, assigneeInitials, ASSIGNEE_LOOK } from '../assigneeLook'
import { normalizarResponsavel, quemE } from '../../../shared/responsaveis'

describe('responsável: cor e nome', () => {
  it('reconhece Claude e DJ sem depender de grafia', () => {
    expect(quemE('Claude')).toBe('claude')
    expect(quemE(' CLAUDE ')).toBe('claude')
    expect(quemE('dj')).toBe('dj')
    expect(quemE('Djemeson')).toBe('dj')
    expect(quemE('Ana')).toBe('outro')
    expect(normalizarResponsavel('claude')).toBe('Claude')
    expect(normalizarResponsavel('Djemeson')).toBe('DJ')
    expect(normalizarResponsavel('  Ana ')).toBe('Ana')
    expect(normalizarResponsavel(undefined)).toBe('')
  })

  it('Claude laranja, DJ azul claro, outros no índigo de sempre', () => {
    expect(assigneeLook('Claude')).toBe(ASSIGNEE_LOOK.claude)
    expect(assigneeLook('DJ')).toBe(ASSIGNEE_LOOK.dj)
    expect(assigneeLook('Ana').dot).toBe('#6366F1')
    expect(assigneeInitials('Claude')).toBe('CL')
    expect(assigneeInitials('DJ')).toBe('DJ')
    expect(assigneeInitials('ana')).toBe('AN')
  })
})
