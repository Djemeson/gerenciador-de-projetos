/**
 * Integração do caminho "com login": conta vinculada (startCloudSync), snapshot chegando
 * do Firestore e push de volta — com o Firestore simulado. É o cenário exato do bug
 * "tarefa recém-criada some segundos depois": o snapshot (gravado antes de a tarefa
 * existir) chegava e substituía o estado local inteiro.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── localStorage de mentira (vitest roda em Node puro) ────────────────────
const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
  clear: () => { mem.clear() },
})

// ── Firestore simulado ────────────────────────────────────────────────────
// Formato 2 (shared/formatoConta.ts): documento principal + coleções de tarefas e
// projetos, cada um com a sua assinatura em tempo real; envio em lote (writeBatch).
type SnapshotCb = (snap: any) => void
const ouvintes = new Map<string, SnapshotCb>()
interface Op { tipo: 'set' | 'delete'; path: string; data?: any }
const lotes: Op[][] = []

vi.mock('../../lib/firebase', () => ({
  db: {},
  USE_FIREBASE: true,
  doc: (pai: any, ...partes: string[]) => ({ path: [pai?.path, ...partes].filter(Boolean).join('/') }),
  collection: (pai: any, nome: string) => ({ path: `${pai.path}/${nome}` }),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  setDoc: vi.fn(async () => {}),
  writeBatch: () => {
    const ops: Op[] = []
    return {
      set: (ref: { path: string }, data: any) => { ops.push({ tipo: 'set', path: ref.path, data }) },
      delete: (ref: { path: string }) => { ops.push({ tipo: 'delete', path: ref.path }) },
      commit: async () => { lotes.push(ops) },
    }
  },
  onSnapshot: (ref: { path: string }, cb: SnapshotCb) => { ouvintes.set(ref.path, cb); return () => { ouvintes.delete(ref.path) } },
}))
// Anexos passam reto — aqui o assunto é a mescla, não o upload.
vi.mock('../../lib/cloudAttachments', () => ({
  stripAndUploadAttachments: async (_uid: string, tasks: unknown[]) => tasks,
  hydrateAttachments: async (_uid: string, tasks: unknown[]) => tasks,
  deleteAttachmentsOf: async () => {},
}))

import { useAppStore } from '../useAppStore'

const BASE = 'syncGroups/uid-teste'
const semPendencia = { hasPendingWrites: false }
const colecao = (itens: any[]) => ({ docs: itens.map(i => ({ data: () => i })), metadata: semPendencia })

/** Documento no formato antigo (listas dentro do principal, coleções vazias) — o caso de
 *  uma conta ainda não convertida ou de um aparelho com a versão anterior do app. */
const chegaSnapshot = async (data: Record<string, unknown>) => {
  ouvintes.get(`${BASE}/tarefas`)!(colecao([]))
  ouvintes.get(`${BASE}/projetos`)!(colecao([]))
  ouvintes.get(BASE)!({ exists: () => true, data: () => data, metadata: semPendencia })
  await vi.advanceTimersByTimeAsync(300)
}

/** Conta no formato 2: tarefas e projetos nas coleções, a ordem no principal. */
const chegaContaNova = async (principal: Record<string, unknown>, tarefas: any[], projetos: any[]) => {
  ouvintes.get(`${BASE}/tarefas`)!(colecao(tarefas))
  ouvintes.get(`${BASE}/projetos`)!(colecao(projetos))
  ouvintes.get(BASE)!({ exists: () => true, data: () => principal, metadata: semPendencia })
  await vi.advanceTimersByTimeAsync(300)
}

const opsDeTodosOsLotes = () => lotes.flat()
const tarefasGravadas = () => opsDeTodosOsLotes().filter(o => o.tipo === 'set' && o.path.startsWith(`${BASE}/tarefas/`)).map(o => o.data.id)
const ultimoPrincipal = () => [...opsDeTodosOsLotes()].reverse().find(o => o.path === BASE)!.data

const tarefaRemota = (id: string, title: string, at: string) => ({
  id, workspaceId: 'default', projectId: 'p1', parentId: null, title, description: '', blocks: [],
  status: 'todo', priority: 'medium', taskType: 'task', dueDate: null, assignee: 'DJ',
  tags: [], checklists: [], customFields: {}, comments: [], createdAt: at, updatedAt: at,
})
const projetoRemoto = (at: string) => ({
  id: 'p1', name: 'Projeto', color: '#888', description: '', workspaceId: 'default',
  spaceId: null, folderId: null, gut: { g: 1, u: 1, t: 1, score: 1 }, archived: false,
  columns: [], activeView: 'list', taskOpenMode: 'center', customViews: [], createdAt: at, updatedAt: at,
})

describe('sincronização com conta vinculada (mescla de snapshots)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mem.clear()
    lotes.length = 0
    useAppStore.getState().stopCloudSync()
    useAppStore.setState({ projects: [], tasks: [], spaces: [], folders: [], workspaces: [], notes: [], goals: [], automations: [], seqCounters: { task: 0, project: 0 } })
  })
  afterEach(() => { vi.useRealTimers() })

  it('tarefa criada logo após o login sobrevive ao primeiro snapshot e é reenviada', async () => {
    const antes = new Date(Date.now() - 60 * 60_000).toISOString()
    useAppStore.getState().startCloudSync('uid-teste')

    // Usuário cria a tarefa ANTES de o primeiro snapshot chegar (o push dela ainda está
    // no debounce e seria engolido pela trava cloudReady — o caso do bug).
    const nova = useAppStore.getState().quickAddTask('Tarefa recém-criada', 'p1', 'todo')

    await chegaSnapshot({
      projects: [projetoRemoto(antes)],
      tasks: [tarefaRemota('t-antiga', 'Tarefa antiga', antes)],
      updatedAt: Date.now() - 30 * 60_000,
    })

    const titulos = useAppStore.getState().tasks.map(t => t.title)
    expect(titulos).toContain('Tarefa recém-criada')      // antes da correção: sumia aqui
    expect(titulos).toContain('Tarefa antiga')

    // A divergência agenda o re-push (debounce 1,5s) que leva a tarefa à nuvem.
    await vi.advanceTimersByTimeAsync(2000)
    expect(tarefasGravadas()).toContain(nova.id)
    expect(ultimoPrincipal().ordemTarefas).toContain(nova.id)
  })

  it('exclusão feita noutro dispositivo continua propagando', async () => {
    const antes = new Date(Date.now() - 60 * 60_000).toISOString()
    useAppStore.getState().startCloudSync('uid-teste')

    // Primeiro snapshot traz duas tarefas; um push conclui as pendências locais.
    await chegaSnapshot({
      projects: [projetoRemoto(antes)],
      tasks: [tarefaRemota('t1', 'Fica', antes), tarefaRemota('t2', 'Será excluída lá', antes)],
      updatedAt: Date.now() - 30 * 60_000,
    })
    expect(useAppStore.getState().tasks).toHaveLength(2)

    // Outro dispositivo exclui t2 e grava o documento agora.
    await chegaSnapshot({
      projects: [projetoRemoto(antes)],
      tasks: [tarefaRemota('t1', 'Fica', antes)],
      updatedAt: Date.now() + MARGEM_FOLGA,
    })
    expect(useAppStore.getState().tasks.map(t => t.id)).toEqual(['t1'])
  })

  it('tarefa excluída aqui não é ressuscitada por um snapshot atrasado', async () => {
    const antes = new Date(Date.now() - 60 * 60_000).toISOString()
    useAppStore.getState().startCloudSync('uid-teste')
    await chegaSnapshot({
      projects: [projetoRemoto(antes)],
      tasks: [tarefaRemota('t1', 'Fica', antes), tarefaRemota('t2', 'Excluo aqui', antes)],
      updatedAt: Date.now() - 30 * 60_000,
    })

    useAppStore.getState().deleteTask('t2')
    // Snapshot velho (gravado antes da exclusão) chega ainda com t2.
    await chegaSnapshot({
      projects: [projetoRemoto(antes)],
      tasks: [tarefaRemota('t1', 'Fica', antes), tarefaRemota('t2', 'Excluo aqui', antes)],
      updatedAt: Date.now() - 10 * 60_000,
    })
    expect(useAppStore.getState().tasks.map(t => t.id)).toEqual(['t1'])
  })

  it('IDs curtos: numera, sobe o contador e não perde o número para um aparelho com versão antiga', async () => {
    const antes = new Date(Date.now() - 60 * 60_000).toISOString()
    const depois = new Date(Date.now() - 50 * 60_000).toISOString()
    useAppStore.getState().startCloudSync('uid-teste')
    await chegaSnapshot({
      projects: [projetoRemoto(antes)],
      tasks: [{ ...tarefaRemota('t1', 'Primeira', antes), seq: 1 }, tarefaRemota('t2', 'Sem número', depois)],
      seqCounters: { task: 4, project: 0 },   // T-2..T-4 já existiram e foram excluídas
      updatedAt: Date.now() - 30 * 60_000,
    })
    const porId = () => new Map(useAppStore.getState().tasks.map(t => [t.id, t.seq]))
    expect(porId().get('t1')).toBe(1)
    expect(porId().get('t2')).toBe(5)           // não reaproveita os excluídos
    expect(useAppStore.getState().projects[0].seq).toBe(1)

    await vi.advanceTimersByTimeAsync(2000)
    expect(ultimoPrincipal().seqCounters.task).toBe(5)

    // Aparelho com versão antiga edita t1 e sobe sem o `seq`: o número conhecido volta.
    const agora = new Date().toISOString()
    await chegaSnapshot({
      projects: [projetoRemoto(antes)],
      tasks: [{ ...tarefaRemota('t1', 'Editada lá', antes), updatedAt: agora }, { ...tarefaRemota('t2', 'Sem número', depois), seq: 5 }],
      updatedAt: Date.now(),
    })
    expect(useAppStore.getState().tasks.find(t => t.id === 't1')).toMatchObject({ title: 'Editada lá', seq: 1 })
  })
})

describe('formato 2: um documento por tarefa', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mem.clear()
    lotes.length = 0
    useAppStore.getState().stopCloudSync()
    useAppStore.setState({ projects: [], tasks: [], spaces: [], folders: [], workspaces: [], notes: [], goals: [], automations: [], seqCounters: { task: 0, project: 0 } })
  })
  afterEach(() => { vi.useRealTimers() })

  const antes = () => new Date(Date.now() - 60 * 60_000).toISOString()

  it('conta no formato antigo é convertida: tarefas vão para a coleção e saem do principal', async () => {
    const at = antes()
    useAppStore.getState().startCloudSync('uid-teste')
    await chegaSnapshot({
      projects: [projetoRemoto(at)],
      tasks: [tarefaRemota('t1', 'Um', at), tarefaRemota('t2', 'Dois', at)],
      updatedAt: Date.now() - 30 * 60_000,
    })
    await vi.advanceTimersByTimeAsync(2000)

    expect(tarefasGravadas().sort()).toEqual(['t1', 't2'])
    const principal = ultimoPrincipal()
    expect(principal.formato).toBe(2)
    expect(principal.ordemTarefas).toEqual(['t1', 't2'])
    expect(principal).not.toHaveProperty('tasks')
    expect(principal).not.toHaveProperty('projects')
  })

  it('editar uma tarefa grava só ela', async () => {
    const at = antes()
    useAppStore.getState().startCloudSync('uid-teste')
    await chegaContaNova(
      { formato: 2, ordemTarefas: ['t1', 't2'], ordemProjetos: ['p1'], updatedAt: Date.now() - 30 * 60_000 },
      [{ ...tarefaRemota('t1', 'Um', at), seq: 1 }, { ...tarefaRemota('t2', 'Dois', at), seq: 2 }],
      [{ ...projetoRemoto(at), seq: 1 }],
    )
    await vi.advanceTimersByTimeAsync(2000)
    lotes.length = 0

    useAppStore.getState().updateTask('t2', { title: 'Dois, editada' })
    await vi.advanceTimersByTimeAsync(2000)

    expect(tarefasGravadas()).toEqual(['t2'])
    expect(opsDeTodosOsLotes().filter(o => o.path.includes('/projetos/'))).toHaveLength(0)
  })

  it('excluir aqui apaga o documento da tarefa', async () => {
    const at = antes()
    useAppStore.getState().startCloudSync('uid-teste')
    await chegaContaNova(
      { formato: 2, ordemTarefas: ['t1', 't2'], ordemProjetos: ['p1'], updatedAt: Date.now() - 30 * 60_000 },
      [{ ...tarefaRemota('t1', 'Um', at), seq: 1 }, { ...tarefaRemota('t2', 'Dois', at), seq: 2 }],
      [{ ...projetoRemoto(at), seq: 1 }],
    )
    await vi.advanceTimersByTimeAsync(2000)
    lotes.length = 0

    useAppStore.getState().deleteTask('t2')
    await vi.advanceTimersByTimeAsync(2000)

    expect(opsDeTodosOsLotes().filter(o => o.tipo === 'delete').map(o => o.path)).toEqual([`${BASE}/tarefas/t2`])
    expect(ultimoPrincipal().ordemTarefas).toEqual(['t1'])
  })

  it('exclusão feita noutro aparelho (documento some da coleção) chega aqui', async () => {
    const at = antes()
    useAppStore.getState().startCloudSync('uid-teste')
    const t1 = { ...tarefaRemota('t1', 'Fica', at), seq: 1 }
    const t2 = { ...tarefaRemota('t2', 'Sai', at), seq: 2 }
    const proj = [{ ...projetoRemoto(at), seq: 1 }]
    await chegaContaNova({ formato: 2, ordemTarefas: ['t1', 't2'], updatedAt: Date.now() - 30 * 60_000 }, [t1, t2], proj)
    expect(useAppStore.getState().tasks).toHaveLength(2)

    await chegaContaNova({ formato: 2, ordemTarefas: ['t1'], excluidos: { t2: Date.now() }, updatedAt: Date.now() + MARGEM_FOLGA }, [t1], proj)
    expect(useAppStore.getState().tasks.map(t => t.id)).toEqual(['t1'])
  })

  it('ordem vem do documento principal', async () => {
    const at = antes()
    useAppStore.getState().startCloudSync('uid-teste')
    await chegaContaNova(
      { formato: 2, ordemTarefas: ['t2', 't1'], ordemProjetos: ['p1'], updatedAt: Date.now() - 30 * 60_000 },
      [{ ...tarefaRemota('t1', 'Um', at), seq: 1 }, { ...tarefaRemota('t2', 'Dois', at), seq: 2 }],
      [{ ...projetoRemoto(at), seq: 1 }],
    )
    expect(useAppStore.getState().tasks.map(t => t.id)).toEqual(['t2', 't1'])
  })
})

// Documento "de outro dispositivo" precisa parecer mais novo que a margem de relógio da
// mescla para a ausência de t2 contar como exclusão, não como atraso.
const MARGEM_FOLGA = 6 * 60_000
