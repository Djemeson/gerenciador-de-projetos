// O documento único de sincronização no Firestore tem limite de 1 MiB. Anexos e áudios
// (armazenados como base64 inline em Task.comments/Task.blocks) precisam sair desse
// documento e virar documentos próprios em syncGroups/{code}/attachments — só assim o
// app sincroniza tarefas com fotos/áudios sem estourar o limite do Firestore.
import { db, doc, setDoc, getDoc } from './firebase'
import type { Task } from '../types'

const ATTACHMENT_LIMIT = 900_000 // ~900KB de string base64 (folga sob o limite de 1 MiB/doc)
const uploadedThisSession = new Set<string>()
const downloadCache = new Map<string, string>()

function refId(entityId: string, field: string) {
  return `${entityId}__${field}`
}

async function uploadBlob(code: string, id: string, data: string) {
  if (uploadedThisSession.has(id)) return
  await setDoc(doc(db!, 'syncGroups', code, 'attachments', id), { data })
  uploadedThisSession.add(id)
}

async function downloadBlob(code: string, id: string): Promise<string | undefined> {
  if (downloadCache.has(id)) return downloadCache.get(id)
  const snap = await getDoc(doc(db!, 'syncGroups', code, 'attachments', id))
  const data = snap.exists() ? (snap.data() as any).data as string : undefined
  if (data) downloadCache.set(id, data)
  return data
}

/** Remove blobs pesados das tasks antes de mandar pro doc de sincronização, subindo cada um
 *  como documento próprio. Blobs acima do limite ficam só locais (não sincronizam). */
export async function stripAndUploadAttachments(code: string, tasks: Task[]): Promise<Task[]> {
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
          jobs.push(uploadBlob(code, id, c.attachment.data))
          attachment = { name: c.attachment.name, mimeType: c.attachment.mimeType, data: '', ref: id } as any
        }
      }
      if (c.audio?.data) {
        const id = refId(c.id, 'audio')
        if (c.audio.data.length > ATTACHMENT_LIMIT) {
          audio = { data: '', tooLargeToSync: true } as any
        } else {
          jobs.push(uploadBlob(code, id, c.audio.data))
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
      jobs.push(uploadBlob(code, id, b.data))
      return { ...b, data: '', ref: id } as any
    }),
  }))

  await Promise.all(jobs)
  return stripped
}

/** Reidrata os blobs a partir de syncGroups/{code}/attachments ao aplicar um estado vindo da
 *  nuvem — sem isso, fotos/áudios apareceriam quebrados no dispositivo que está recebendo o snapshot. */
export async function hydrateAttachments(code: string, tasks: any[]): Promise<Task[]> {
  if (!db) return tasks
  return Promise.all(tasks.map(async (t) => ({
    ...t,
    comments: await Promise.all((t.comments ?? []).map(async (c: any) => {
      const attachment = c.attachment?.ref
        ? { name: c.attachment.name, mimeType: c.attachment.mimeType, data: (await downloadBlob(code, c.attachment.ref)) ?? '' }
        : c.attachment
      const audio = c.audio?.ref
        ? { data: (await downloadBlob(code, c.audio.ref)) ?? '' }
        : c.audio
      return { ...c, attachment, audio }
    })),
    blocks: await Promise.all((t.blocks ?? []).map(async (b: any) => {
      if (!b.ref) return b
      return { ...b, data: (await downloadBlob(code, b.ref)) ?? '' }
    })),
  })))
}
