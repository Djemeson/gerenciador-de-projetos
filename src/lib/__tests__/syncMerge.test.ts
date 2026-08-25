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

  it('criação desta sessão sobrevive mesmo a um doc remoto de relógio adiantado', () => {
    const nova = item('nova', -20 * MIN)           // "antes" do doc só porque o outro relógio corre adiantado
    const ultimoPushOk = T0 - 30 * MIN             // mas ela nasceu depois do último push desta sessão
    const r = mesclarPorId([nova], [item('a', -60 * MIN)], T0, { ultimoPushOk })
    expect(r.itens.map(i => i.id)).toContain('nova')
  })

  it('item excluído noutro dispositivo cai (ausente do doc, mais velho que ele e já enviado)', () => {
    const excluidaLa = item('x', -60 * MIN)
    // O push desta sessão rodou depois da última edição do item → ele já estava na nuvem
    // quando o outro dispositivo o excluiu. Aqui a ausência significa exclusão, não atraso.
    const r = mesclarPorId([excluidaLa], [item('a', -60 * MIN)], T0, { ultimoPushOk: T0 - 1 * MIN })
    expect(r.itens.map(i => i.id)).toEqual(['a'])
  })

  it('edição ainda não enviada (nenhum push desde ela) não é tratada como exclusão', () => {
    const editadaOffline = item('x', -60 * MIN)
    const r = mesclarPorId([editadaOffline], [item('a', -60 * MIN)], T0, { ultimoPushOk: T0 - 120 * MIN })
    expect(r.itens.map(i => i.id)).toEqual(['a', 'x'])
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
    const r = mesclarPorId([], [fantasma], T0, { exclusoes: { x: T0 + 1 * MIN }, ultimoPushOk: T0 - 120 * MIN })
    expect(r.itens).toEqual([])
    expect(r.manteveLocal).toBe(true)              // a exclusão precisa voltar para a nuvem
  })

  it('exclusão registrada há muito tempo não bloqueia um item legitimamente recriado', () => {
    const recriada = item('x', -1 * MIN)
    const r = mesclarPorId([], [recriada], T0, { exclusoes: { x: T0 - MARGEM_RELOGIO_MS - 10 * MIN }, ultimoPushOk: T0 - 120 * MIN })
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
    const r = mesclarPorId([item('a', -60 * MIN)], [item('a', -60 * MIN), item('b', -1 * MIN)], T0, { ultimoPushOk: T0 - 120 * MIN })
    expect(r.itens.map(i => i.id)).toEqual(['a', 'b'])
    expect(r.manteveLocal).toBe(false)
  })

  it('converge: aplicar o mesmo doc duas vezes dá o mesmo resultado', () => {
    const local  = [item('a', -60 * MIN), item('nova', +2 * MIN)]
    const remoto = [item('a', -60 * MIN), item('b', -30 * MIN)]
    const uma  = mesclarPorId(local, remoto, T0, { ultimoPushOk: T0 - 120 * MIN })
    const duas = mesclarPorId(uma.itens, remoto, T0, { ultimoPushOk: T0 - 120 * MIN })
    expect(duas.itens).toEqual(uma.itens)
  })
})
