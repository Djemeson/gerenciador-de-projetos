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
type SnapshotCb = (snap: any) => void
let snapshotCb: SnapshotCb | null = null
const setDocMock = vi.fn(async (..._args: unknown[]) => {})

vi.mock('../../lib/firebase', () => ({
  db: {},
  USE_FIREBASE: true,
  doc: (_db: unknown, _col: string, id: string) => ({ id }),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  onSnapshot: (_ref: unknown, cb: SnapshotCb) => { snapshotCb = cb; return () => { snapshotCb = null } },
}))
// Anexos passam reto — aqui o assunto é a mescla, não o upload.
vi.mock('../../lib/cloudAttachments', () => ({
  stripAndUploadAttachments: async (_uid: string, tasks: unknown[]) => tasks,
  hydrateAttachments: async (_uid: string, tasks: unknown[]) => tasks,
  deleteAttachmentsOf: async () => {},
}))

import { useAppStore } from '../useAppStore'

const chegaSnapshot = async (data: Record<string, unknown>) => {
  await snapshotCb!({ exists: () => true, data: () => data, metadata: { hasPendingWrites: false } })
}

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
    setDocMock.mockClear()
    useAppStore.getState().stopCloudSync()
    useAppStore.setState({ projects: [], tasks: [], spaces: [], folders: [], workspaces: [], notes: [], goals: [], automations: [] })
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
    expect(setDocMock).toHaveBeenCalled()
    const chamadas = setDocMock.mock.calls
    const doc = chamadas[chamadas.length - 1][1] as { tasks: { id: string }[] }
    expect(doc.tasks.map(t => t.id)).toContain(nova.id)
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
})

// Documento "de outro dispositivo" precisa parecer mais novo que a margem de relógio da
// mescla para a ausência de t2 contar como exclusão, não como atraso.
const MARGEM_FOLGA = 6 * 60_000
