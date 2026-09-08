// O documento único de sincronização no Firestore tem limite de 1 MiB. Anexos e áudios
// (armazenados como base64 inline em Task.comments/Task.blocks) precisam sair desse
// documento e virar documentos próprios em syncGroups/{uid}/attachments — só assim o
// app sincroniza tarefas com fotos/áudios sem estourar o limite do Firestore.
//
// Havia um vazamento nessa regra: imagem **dentro do texto da descrição**. O editor grava
// o corpo como HTML (`block.text`), e uma imagem colada/arrastada vira
// `<img src="data:image/png;base64,...">` DENTRO desse HTML — não em `block.data`. Como só
// `block.data` era extraído, o base64 inteiro ia no documento de sincronização: uma captura
// de tela estourava o limite, o `setDoc` falhava e a conta inteira parava de sincronizar —
// era o "colei a imagem na descrição e ela desapareceu" (a descrição voltava ao que a nuvem
// ainda tinha). Agora as imagens do HTML saem junto, cada uma como documento próprio.
//
// Blobs maiores que o limite de um documento são **fatiados** em partes
// (`{id}__p0`, `{id}__p1`, …) em vez de simplesmente não sincronizar.
import { db, doc, setDoc, getDoc, deleteDoc } from './firebase'
import type { Task } from '../types'

const ATTACHMENT_LIMIT = 900_000 // ~900KB de string base64 (folga sob o limite de 1 MiB/doc)
const MAX_PARTES = 12            // teto por blob (~10 MB); acima disso continua só no aparelho
/** Marca uma imagem do HTML cujo base64 foi para um documento próprio: `cloudref:<id>~<partes>~<impressão>`. */
const PREFIXO_REF = 'cloudref:'
// Os caches são chaveados por grupo + id: o mesmo anexo pode existir em dois grupos
// diferentes (é o caso durante a migração do código antigo para a conta Google), e uma
// chave só com o id faria o segundo grupo ser pulado por "já enviado nesta sessão".
const uploadedThisSession = new Set<string>()
const downloadCache = new Map<string, string>()

function refId(entityId: string, field: string) {
  return `${entityId}__${field}`
}

/**
 * Impressão do conteúdo (FNV-1a sobre uma amostra + comprimento). Existe porque o id de uma
 * imagem do corpo é posicional (`inline0`, `inline1`…): trocar a 1ª imagem por outra mantém
 * o id e mudaria só o conteúdo. Sem a impressão, o cache de envio pularia o reenvio e o de
 * leitura devolveria a imagem antiga no outro aparelho.
 */
export function impressaoDeConteudo(s: string): string {
  const meio = s.length >> 1
  const amostra = s.length <= 3000 ? s : s.slice(0, 1000) + s.slice(meio, meio + 1000) + s.slice(-1000)
  let h = 0x811c9dc5
  for (let i = 0; i < amostra.length; i++) { h ^= amostra.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return `${(h >>> 0).toString(36)}${s.length.toString(36)}`
}

export const partesDe = (data: string) => Math.max(1, Math.ceil(data.length / ATTACHMENT_LIMIT))

/**
 * Percorre as tags `<img>` do HTML trocando o `src` pelo que o callback devolver
 * (`null` mantém). O índice é a posição da imagem no HTML — é ele que dá o id estável de
 * cada imagem do corpo, e por isso conta **todas** as imagens, inclusive as que não mudam.
 */
export function mapearImagensDoHtml(html: string, aoEncontrar: (src: string, indice: number) => string | null): string {
  let i = 0
  return html.replace(/<img\b[^>]*>/gi, tag => {
    const indice = i++
    return tag.replace(/(\bsrc\s*=\s*")([^"]*)(")/i, (inteiro, antes, src, depois) => {
      const novo = aoEncontrar(src, indice)
      return novo === null ? inteiro : `${antes}${novo}${depois}`
    })
  })
}

interface RefInline { id: string; partes: number; fp?: string }
const montarRef = (id: string, partes: number, fp: string) => `${PREFIXO_REF}${id}~${partes}~${fp}`
function lerRef(src: string): RefInline | null {
  if (!src.startsWith(PREFIXO_REF)) return null
  const [id, partes, fp] = src.slice(PREFIXO_REF.length).split('~')
  return id ? { id, partes: Number(partes) || 1, fp } : null
}

async function uploadBlob(group: string, id: string, data: string): Promise<void> {
  const partes = partesDe(data)
  if (partes > MAX_PARTES) return
  const key = `${group}/${id}/${impressaoDeConteudo(data)}`
  if (uploadedThisSession.has(key)) return
  if (partes === 1) {
    await setDoc(doc(db!, 'syncGroups', group, 'attachments', id), { data })
  } else {
    await Promise.all(Array.from({ length: partes }, (_, k) =>
      setDoc(doc(db!, 'syncGroups', group, 'attachments', `${id}__p${k}`),
        { data: data.slice(k * ATTACHMENT_LIMIT, (k + 1) * ATTACHMENT_LIMIT) })))
  }
  uploadedThisSession.add(key)
}

async function downloadBlob(group: string, id: string, partes = 1, fp?: string): Promise<string | undefined> {
  const key = `${group}/${id}/${fp ?? ''}`
  if (downloadCache.has(key)) return downloadCache.get(key)
  let data: string | undefined
  if (partes <= 1) {
    const snap = await getDoc(doc(db!, 'syncGroups', group, 'attachments', id))
    data = snap.exists() ? (snap.data() as any).data as string : undefined
  } else {
    const pedacos = await Promise.all(Array.from({ length: partes }, (_, k) =>
      getDoc(doc(db!, 'syncGroups', group, 'attachments', `${id}__p${k}`))))
    // Parte faltando = blob incompleto: melhor não devolver nada do que uma imagem cortada.
    if (pedacos.every(s => s.exists())) data = pedacos.map(s => (s.data() as any).data as string).join('')
  }
  if (data) downloadCache.set(key, data)
  return data
}

/** Ids dos documentos de um blob (o próprio id, ou uma parte por fatia). */
const idsDoBlob = (id: string, partes: number) =>
  partes <= 1 ? [id] : Array.from({ length: partes }, (_, k) => `${id}__p${k}`)

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
      if (c.attachment) idsDoBlob(refId(c.id, 'attachment'), (c.attachment as any).parts ?? 1).forEach(i => ids.add(i))
      if (c.audio)      idsDoBlob(refId(c.id, 'audio'),      (c.audio as any).parts ?? 1).forEach(i => ids.add(i))
    })
    t.blocks?.forEach(b => {
      if (b.data || (b as any).ref) idsDoBlob(refId(b.id, 'block'), (b as any).parts ?? partesDe(b.data ?? '')).forEach(i => ids.add(i))
      // Imagens do corpo: o id é posicional, então basta reencontrá-las na mesma ordem.
      if (typeof b.text === 'string' && b.text) {
        mapearImagensDoHtml(b.text, (src, k) => {
          const ref = lerRef(src)
          if (ref) idsDoBlob(refId(b.id, `inline${k}`), ref.partes).forEach(i => ids.add(i))
          else if (src.startsWith('data:')) idsDoBlob(refId(b.id, `inline${k}`), partesDe(src)).forEach(i => ids.add(i))
          return null
        })
      }
    })
  })
  if (!ids.size) return

  await Promise.all([...ids].map(async id => {
    try {
      await deleteDoc(doc(db!, 'syncGroups', group, 'attachments', id))
      // As chaves de cache levam a impressão do conteúdo no fim; limpa por prefixo, senão
      // reenviar a mesma imagem depois seria pulado por "já enviada" com o documento apagado.
      const prefixo = `${group}/${id}/`
      uploadedThisSession.forEach(k => { if (k.startsWith(prefixo)) uploadedThisSession.delete(k) })
      downloadCache.forEach((_v, k) => { if (k.startsWith(prefixo)) downloadCache.delete(k) })
    } catch (e) {
      console.warn('Não foi possível apagar o anexo na nuvem (ficará órfão):', id, e)
    }
  }))
}

/** Remove blobs pesados das tasks antes de mandar pro doc de sincronização, subindo cada um
 *  como documento próprio (fatiado, quando maior que o limite de um documento). */
export async function stripAndUploadAttachments(group: string, tasks: Task[]): Promise<Task[]> {
  if (!db) return tasks
  const jobs: Promise<void>[] = []

  const enviar = (id: string, data: string) => {
    const partes = partesDe(data)
    if (partes > MAX_PARTES) return null
    jobs.push(uploadBlob(group, id, data))
    return { partes, fp: impressaoDeConteudo(data) }
  }

  const stripped = tasks.map(t => ({
    ...t,
    comments: t.comments.map(c => {
      let attachment = c.attachment
      let audio = c.audio
      if (c.attachment?.data) {
        const enviado = enviar(refId(c.id, 'attachment'), c.attachment.data)
        attachment = enviado
          ? { name: c.attachment.name, mimeType: c.attachment.mimeType, data: '', ref: refId(c.id, 'attachment'), parts: enviado.partes, fp: enviado.fp } as any
          : { ...c.attachment, data: '', tooLargeToSync: true } as any
      }
      if (c.audio?.data) {
        const enviado = enviar(refId(c.id, 'audio'), c.audio.data)
        audio = enviado
          ? { data: '', ref: refId(c.id, 'audio'), parts: enviado.partes, fp: enviado.fp } as any
          : { data: '', tooLargeToSync: true } as any
      }
      return { ...c, attachment, audio }
    }),
    blocks: t.blocks.map(b => {
      let bloco: any = b
      if (b.data) {
        const enviado = enviar(refId(b.id, 'block'), b.data)
        bloco = enviado
          ? { ...bloco, data: '', ref: refId(b.id, 'block'), parts: enviado.partes, fp: enviado.fp }
          : { ...bloco, data: '', tooLargeToSync: true }
      }
      // Imagens embutidas no HTML do corpo — a origem do bug de sincronização.
      if (typeof bloco.text === 'string' && bloco.text.includes('data:')) {
        bloco = { ...bloco, text: mapearImagensDoHtml(bloco.text, (src, k) => {
          if (!src.startsWith('data:')) return null
          const id = refId(b.id, `inline${k}`)
          const enviado = enviar(id, src)
          // Grande demais até para fatiar: fica só neste aparelho, mas o documento sobe.
          return enviado ? montarRef(id, enviado.partes, enviado.fp) : ''
        }) }
      }
      return bloco
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
        ? { name: c.attachment.name, mimeType: c.attachment.mimeType, data: (await downloadBlob(group, c.attachment.ref, c.attachment.parts, c.attachment.fp)) ?? '' }
        : c.attachment
      const audio = c.audio?.ref
        ? { data: (await downloadBlob(group, c.audio.ref, c.audio.parts, c.audio.fp)) ?? '' }
        : c.audio
      return { ...c, attachment, audio }
    })),
    blocks: await Promise.all((t.blocks ?? []).map(async (b: any) => {
      let bloco = b
      if (b.ref) bloco = { ...bloco, data: (await downloadBlob(group, b.ref, b.parts, b.fp)) ?? '' }
      if (typeof bloco.text === 'string' && bloco.text.includes(PREFIXO_REF)) {
        // Baixa todas as imagens do corpo antes de reescrever o HTML (a troca é síncrona).
        const porSrc = new Map<string, string>()
        const pendentes: Promise<void>[] = []
        mapearImagensDoHtml(bloco.text, src => {
          const ref = lerRef(src)
          if (ref && !porSrc.has(src)) {
            porSrc.set(src, '')
            pendentes.push(downloadBlob(group, ref.id, ref.partes, ref.fp).then(d => { if (d) porSrc.set(src, d) }))
          }
          return null
        })
        await Promise.all(pendentes)
        bloco = { ...bloco, text: mapearImagensDoHtml(bloco.text, src => porSrc.get(src) || null) }
      }
      return bloco
    })),
  })))
}
