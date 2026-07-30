// O documento único de sincronização no Firestore tem limite de 1 MiB. Anexos e áudios
// (armazenados como base64 inline em Task.comments/Task.blocks) precisam sair desse
// documento e virar documentos próprios em syncGroups/{uid}/attachments — só assim o
// app sincroniza tarefas com fotos/áudios sem estourar o limite do Firestore.
import { db, doc, setDoc, getDoc, deleteDoc } from './firebase'
import type { Task } from '../types'

const ATTACHMENT_LIMIT = 900_000 // ~900KB de string base64 (folga sob o limite de 1 MiB/doc)
// Os caches são chaveados por grupo + id: o mesmo anexo pode existir em dois grupos
// diferentes (é o caso durante a migração do código antigo para a conta Google), e uma
// chave só com o id faria o segundo grupo ser pulado por "já enviado nesta sessão".
const uploadedThisSession = new Set<string>()
const downloadCache = new Map<string, string>()

function refId(entityId: string, field: string) {
  return `${entityId}__${field}`
}

async function uploadBlob(group: string, id: string, data: string) {
  const key = `${group}/${id}`
  if (uploadedThisSession.has(key)) return
  await setDoc(doc(db!, 'syncGroups', group, 'attachments', id), { data })
  uploadedThisSession.add(key)
}

async function downloadBlob(group: string, id: string): Promise<string | undefined> {
  const key = `${group}/${id}`
  if (downloadCache.has(key)) return downloadCache.get(key)
  const snap = await getDoc(doc(db!, 'syncGroups', group, 'attachments', id))
  const data = snap.exists() ? (snap.data() as any).data as string : undefined
  if (data) downloadCache.set(key, data)
  return data
}

/**
 * Apaga os blobs das tarefas removidas. Sem isto cada foto ou áudio já excluído ficava
 * para sempre em `syncGroups/{uid}/attachments`, consumindo a cota do plano gratuito do
 * Firestore — o app subia anexos e nunca apagava nenhum.
 *
 * Falha de rede aqui não interrompe a exclusão local: o pior caso volta a ser um blob
 * órfão, que é o comportamento antigo.
 */
export async function deleteAttachmentsOf(group: string, tasks: Task[]): Promise<void> {
  if (!db || !group || !tasks.length) return
  const ids = new Set<string>()
  tasks.forEach(t => {
    t.comments?.forEach(c => {
      if (c.attachment) ids.add(refId(c.id, 'attachment'))
      if (c.audio)      ids.add(refId(c.id, 'audio'))
    })
    t.blocks?.forEach(b => { if (b.data || (b as any).ref) ids.add(refId(b.id, 'block')) })
  })
  if (!ids.size) return

  await Promise.all([...ids].map(async id => {
    try {
      await deleteDoc(doc(db!, 'syncGroups', group, 'attachments', id))
      uploadedThisSession.delete(`${group}/${id}`)
      downloadCache.delete(`${group}/${id}`)
    } catch (e) {
      console.warn('Não foi possível apagar o anexo na nuvem (ficará órfão):', id, e)
    }
  }))
}

/** Remove blobs pesados das tasks antes de mandar pro doc de sincronização, subindo cada um
 *  como documento próprio. Blobs acima do limite ficam só locais (não sincronizam). */
export async function stripAndUploadAttachments(group: string, tasks: Task[]): Promise<Task[]> {
  if (!db) return tasks
  const jobs: Promise<void>[] = []

  const stripped = tasks.map(t => ({
    ...t,
    comments: t.comments.map(c => {
      let attachment = c.attachment
      let audio = c.audio
      if (c.attachment?.data) {
        const id = refId(c.id, 'attachment')
        if (c.attachment.data.length > ATTACHMENT_LIMIT) {
          attachment = { ...c.attachment, data: '', tooLargeToSync: true } as any
        } else {
          jobs.push(uploadBlob(group, id, c.attachment.data))
          attachment = { name: c.attachment.name, mimeType: c.attachment.mimeType, data: '', ref: id } as any
        }
      }
      if (c.audio?.data) {
        const id = refId(c.id, 'audio')
        if (c.audio.data.length > ATTACHMENT_LIMIT) {
          audio = { data: '', tooLargeToSync: true } as any
        } else {
          jobs.push(uploadBlob(group, id, c.audio.data))
          audio = { data: '', ref: id } as any
        }
      }
      return { ...c, attachment, audio }
    }),
    blocks: t.blocks.map(b => {
      if (!b.data) return b
      const id = refId(b.id, 'block')
      if (b.data.length > ATTACHMENT_LIMIT) {
        return { ...b, data: '', tooLargeToSync: true } as any
      }
      jobs.push(uploadBlob(group, id, b.data))
      return { ...b, data: '', ref: id } as any
    }),
  }))

  await Promise.all(jobs)
  return stripped
}

/** Reidrata os blobs a partir de syncGroups/{group}/attachments ao aplicar um estado vindo da
 *  nuvem — sem isso, fotos/áudios apareceriam quebrados no dispositivo que está recebendo o snapshot. */
export async function hydrateAttachments(group: string, tasks: any[]): Promise<Task[]> {
  if (!db) return tasks
  return Promise.all(tasks.map(async (t) => ({
    ...t,
    comments: await Promise.all((t.comments ?? []).map(async (c: any) => {
      const attachment = c.attachment?.ref
        ? { name: c.attachment.name, mimeType: c.attachment.mimeType, data: (await downloadBlob(group, c.attachment.ref)) ?? '' }
        : c.attachment
      const audio = c.audio?.ref
        ? { data: (await downloadBlob(group, c.audio.ref)) ?? '' }
        : c.audio
      return { ...c, attachment, audio }
    })),
    blocks: await Promise.all((t.blocks ?? []).map(async (b: any) => {
      if (!b.ref) return b
      return { ...b, data: (await downloadBlob(group, b.ref)) ?? '' }
    })),
  })))
}
