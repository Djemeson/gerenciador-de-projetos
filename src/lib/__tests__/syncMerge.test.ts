import { describe, it, expect } from 'vitest'
import { mesclarPorId, MARGEM_RELOGIO_MS } from '../syncMerge'

// Relógio de referência dos cenários: T0 é o momento em que o documento remoto foi gravado.
const T0 = Date.parse('2026-08-25T12:00:00.000Z')
const iso = (deltaMs: number) => new Date(T0 + deltaMs).toISOString()
const MIN = 60_000

interface Item { id: string; title: string; updatedAt?: string; createdAt?: string }
const item = (id: string, deltaMs: number, title = id): Item =>
  ({ id, title, createdAt: iso(deltaMs), updatedAt: iso(deltaMs) })

describe('mesclarPorId', () => {
  // A regressão que motivou tudo: tarefa criada agora, snapshot gravado antes chega e
  // — no código antigo — substituía a lista local, apagando a tarefa.
  it('tarefa recém-criada sobrevive a um snapshot gravado antes dela', () => {
    const antiga = item('a', -60 * MIN)
    const nova   = item('nova', +2 * MIN)          // criada depois de o doc remoto ser gravado
    const r = mesclarPorId([antiga, nova], [antiga], T0)
    expect(r.itens.map(i => i.id)).toEqual(['a', 'nova'])
    expect(r.manteveLocal).toBe(true)              // → dispara o re-push que leva a tarefa à nuvem
  })

  it('item pendente de push sobrevive mesmo a um doc remoto de relógio adiantado', () => {
    const nova = item('nova', -20 * MIN)           // "antes" do doc só porque o outro relógio corre adiantado
    const r = mesclarPorId([nova], [item('a', -60 * MIN)], T0, { pendentes: { nova: T0 - 20 * MIN } })
    expect(r.itens.map(i => i.id)).toContain('nova')
  })

  it('item excluído noutro dispositivo cai (ausente do doc, mais velho que ele e sem pendência)', () => {
    const excluidaLa = item('x', -60 * MIN)
    const r = mesclarPorId([excluidaLa], [item('a', -60 * MIN)], T0)
    expect(r.itens.map(i => i.id)).toEqual(['a'])
    expect(r.manteveLocal).toBe(false)             // o estado convergiu para o remoto — nada a subir
  })

  it('edição offline nunca enviada (pendência persistida) não é tratada como exclusão', () => {
    const editadaOffline = item('x', -60 * MIN)
    const r = mesclarPorId([editadaOffline], [item('a', -60 * MIN)], T0, { pendentes: { x: T0 - 60 * MIN } })
    expect(r.itens.map(i => i.id)).toEqual(['a', 'x'])
    expect(r.manteveLocal).toBe(true)
  })

  it('edição local mais nova vence o mesmo item vindo do remoto', () => {
    const local  = { ...item('a', +1 * MIN), title: 'editado aqui' }
    const remoto = { ...item('a', -10 * MIN), title: 'versão da nuvem' }
    const r = mesclarPorId([local], [remoto], T0)
    expect(r.itens[0].title).toBe('editado aqui')
    expect(r.manteveLocal).toBe(true)
  })

  it('no empate ou com o remoto mais novo, o remoto vence sem marcar divergência', () => {
    const local  = { ...item('a', -10 * MIN), title: 'daqui' }
    const remoto = { ...item('a', -5 * MIN), title: 'da nuvem' }
    const r = mesclarPorId([local], [remoto], T0)
    expect(r.itens[0].title).toBe('da nuvem')
    expect(r.manteveLocal).toBe(false)
  })

  it('exclusão local recente não é ressuscitada por um doc gravado antes dela', () => {
    const fantasma = item('x', -60 * MIN)
    const r = mesclarPorId([], [fantasma], T0, { exclusoes: { x: T0 + 1 * MIN } })
    expect(r.itens).toEqual([])
    expect(r.manteveLocal).toBe(true)              // a exclusão precisa voltar para a nuvem
  })

  it('exclusão registrada há muito tempo não bloqueia um item legitimamente recriado', () => {
    const recriada = item('x', -1 * MIN)
    const r = mesclarPorId([], [recriada], T0, { exclusoes: { x: T0 - MARGEM_RELOGIO_MS - 10 * MIN } })
    expect(r.itens.map(i => i.id)).toEqual(['x'])
  })

  // Regra pré-existente, preservada: doc parcial/vazio nunca apaga o trabalho local.
  it('lista remota vazia mantém a local inteira', () => {
    const locais = [item('a', -60 * MIN), item('b', -30 * MIN)]
    const r = mesclarPorId(locais, [], T0)
    expect(r.itens).toEqual(locais)
    expect(r.manteveLocal).toBe(true)
  })

  it('novidade remota entra normalmente', () => {
    const r = mesclarPorId([item('a', -60 * MIN)], [item('a', -60 * MIN), item('b', -1 * MIN)], T0)
    expect(r.itens.map(i => i.id)).toEqual(['a', 'b'])
    expect(r.manteveLocal).toBe(false)
  })

  // ── Ordem (reordenação por arrasto) ─────────────────────────────────────
  it('reordenação local feita depois do doc remoto vence a ordem remota', () => {
    const a = item('a', -60 * MIN); const b = item('b', -60 * MIN)
    const r = mesclarPorId([b, a], [a, b], T0, { ordemLocalEm: T0 + 1 * MIN })
    expect(r.itens.map(i => i.id)).toEqual(['b', 'a'])
    expect(r.manteveLocal).toBe(true)              // a ordem nova precisa subir
  })

  it('sem reordenação local recente, vale a ordem do documento remoto', () => {
    const a = item('a', -60 * MIN); const b = item('b', -60 * MIN)
    const r = mesclarPorId([b, a], [a, b], T0, { ordemLocalEm: T0 - 30 * MIN })
    expect(r.itens.map(i => i.id)).toEqual(['a', 'b'])
    expect(r.manteveLocal).toBe(false)
  })

  it('com a ordem local vencendo, item novo do remoto ainda entra e exclusão remota ainda vale', () => {
    const a = item('a', -60 * MIN); const b = item('b', -60 * MIN)
    const excluidaLa = item('x', -60 * MIN)        // só local, velha, sem pendência → excluída lá
    const novaLa = item('c', -1 * MIN)             // só remota → entra no fim
    const r = mesclarPorId([b, excluidaLa, a], [a, b, novaLa], T0, { ordemLocalEm: T0 + 1 * MIN })
    expect(r.itens.map(i => i.id)).toEqual(['b', 'a', 'c'])
  })

  it('converge: aplicar o mesmo doc duas vezes dá o mesmo resultado', () => {
    const local  = [item('a', -60 * MIN), item('nova', +2 * MIN)]
    const remoto = [item('a', -60 * MIN), item('b', -30 * MIN)]
    const uma  = mesclarPorId(local, remoto, T0)
    const duas = mesclarPorId(uma.itens, remoto, T0)
    expect(duas.itens).toEqual(uma.itens)
  })
})
