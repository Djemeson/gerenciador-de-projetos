// Separa os anexos do JSON que vai para o localStorage e os devolve na volta.
//
// É o espelho local de `cloudAttachments.ts`: lá os blobs saem do documento do Firestore
// (teto de 1 MiB por documento); aqui eles saem do localStorage (teto de poucos MB para a
// origem inteira) e vão para o cofre IndexedDB. O estado em memória continua sempre com o
// conteúdo real — a troca por referência acontece só na hora de gravar.
import { mapearImagensDoHtml, PREFIXO_LOCAL } from './cloudAttachments'
import { guardarBlobs, lerBlobs, manterApenas } from './blobStore'
import type { Task } from '../types'

export { PREFIXO_LOCAL }

const refId = (entityId: string, campo: string) => `${entityId}__${campo}`

interface Extracao {
  /** Tarefas prontas para o localStorage: sem nenhum base64. */
  enxutas: Task[]
  /** Blobs a gravar no cofre. */
  blobs: { id: string; data: string }[]
  /** Todo id de blob ainda em uso — o que não estiver aqui pode ser apagado do cofre. */
  vivos: Set<string>
}

/**
 * Troca todo base64 por referência. Percorre os mesmos quatro lugares que a versão da
 * nuvem: anexo e áudio de comentário, bloco de conteúdo e imagem embutida no HTML da
 * descrição — esta última é a que mais pega de surpresa, porque uma captura de tela colada
 * no corpo não fica em `data`, fica dentro do texto.
 */
export function extrairBlobs(tasks: Task[]): Extracao {
  const blobs: { id: string; data: string }[] = []
  const vivos = new Set<string>()

  const guardar = (id: string, data: string) => {
    blobs.push({ id, data })
    vivos.add(id)
    return id
  }

  const enxutas = tasks.map(t => ({
    ...t,
    comments: (t.comments ?? []).map(c => {
      let attachment: any = c.attachment
      let audio: any = c.audio
      if (c.attachment?.data) {
        const id = guardar(refId(c.id, 'attachment'), c.attachment.data)
        attachment = { ...c.attachment, data: '', lref: id }
      } else if ((c.attachment as any)?.lref) {
        vivos.add((c.attachment as any).lref)
      }
      if (c.audio?.data) {
        const id = guardar(refId(c.id, 'audio'), c.audio.data)
        audio = { ...c.audio, data: '', lref: id }
      } else if ((c.audio as any)?.lref) {
        vivos.add((c.audio as any).lref)
      }
      return { ...c, attachment, audio }
    }),
    blocks: (t.blocks ?? []).map(b => {
      let bloco: any = b
      if (b.data) {
        const id = guardar(refId(b.id, 'block'), b.data)
        bloco = { ...bloco, data: '', lref: id }
      } else if ((b as any).lref) {
        vivos.add((b as any).lref)
      }
      if (typeof bloco.text === 'string' && (bloco.text.includes('data:') || bloco.text.includes(PREFIXO_LOCAL))) {
        bloco = { ...bloco, text: mapearImagensDoHtml(bloco.text, (src, k) => {
          const id = refId(b.id, `inline${k}`)
          if (src.startsWith(PREFIXO_LOCAL)) { vivos.add(src.slice(PREFIXO_LOCAL.length)); return null }
          if (!src.startsWith('data:')) return null
          return PREFIXO_LOCAL + guardar(id, src)
        }) }
      }
      return bloco
    }),
  })) as Task[]

  return { enxutas, blobs, vivos }
}

/** Devolve o base64 de volta às tarefas lidas do localStorage. */
export async function reidratarBlobs(tasks: Task[]): Promise<Task[]> {
  const ids: string[] = []
  const anotar = (id?: string) => { if (id) ids.push(id) }

  tasks.forEach(t => {
    (t.comments ?? []).forEach(c => { anotar((c.attachment as any)?.lref); anotar((c.audio as any)?.lref) })
    ;(t.blocks ?? []).forEach(b => {
      anotar((b as any).lref)
      if (typeof b.text === 'string' && b.text.includes(PREFIXO_LOCAL)) {
        mapearImagensDoHtml(b.text, src => {
          if (src.startsWith(PREFIXO_LOCAL)) anotar(src.slice(PREFIXO_LOCAL.length))
          return null
        })
      }
    })
  })
  if (!ids.length) return tasks

  const encontrados = await lerBlobs([...new Set(ids)])
  if (!encontrados.size) return tasks

  const repor = (alvo: any) => {
    const data = alvo?.lref ? encontrados.get(alvo.lref) : undefined
    return data ? { ...alvo, data } : alvo
  }

  return tasks.map(t => ({
    ...t,
    comments: (t.comments ?? []).map(c => ({ ...c, attachment: repor(c.attachment), audio: repor(c.audio) })),
    blocks: (t.blocks ?? []).map(b => {
      let bloco: any = repor(b)
      if (typeof bloco.text === 'string' && bloco.text.includes(PREFIXO_LOCAL)) {
        // Referência sem blob (cofre limpo pelo navegador) fica como está: perder o
        // marcador perderia também a chance de a nuvem repor a imagem depois.
        bloco = { ...bloco, text: mapearImagensDoHtml(bloco.text, src =>
          src.startsWith(PREFIXO_LOCAL) ? (encontrados.get(src.slice(PREFIXO_LOCAL.length)) ?? null) : null) }
      }
      return bloco
    }),
  })) as Task[]
}

/** Grava os blobs extraídos e limpa os que nenhuma tarefa usa mais. */
export async function sincronizarCofre(extracao: Extracao): Promise<void> {
  await guardarBlobs(extracao.blobs)
  await manterApenas(extracao.vivos)
}
