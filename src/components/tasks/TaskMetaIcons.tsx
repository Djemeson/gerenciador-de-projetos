import { Paperclip, MessageSquare } from 'lucide-react'
import type { Task } from '../../types'

/**
 * Selo informativo de anexo/comentário na tarefa (estilo ClickUp).
 *
 * Fonte única para lista, quadro e tabela — sem isso cada layout inventaria a
 * própria contagem e um deles ficaria para trás quando a regra mudasse.
 *
 * Anexo = qualquer bloco que não seja texto (arquivo, imagem ou áudio), esteja
 * ele na seção "Anexos" ou solto no corpo — para quem olha a lista, os dois são
 * "essa tarefa tem arquivo". Comentário com arquivo entra na contagem de anexos
 * também, senão um áudio enviado no comentário sumiria da lista.
 */
export function contagemAnexos(task: Task): number {
  const emBlocos    = (task.blocks ?? []).filter(b => b.type !== 'text').length
  const emComentarios = (task.comments ?? []).filter(c => c.attachment || c.audio).length
  return emBlocos + emComentarios
}

export function contagemComentarios(task: Task): number {
  return (task.comments ?? []).length
}

interface Props {
  task: Task
  size?: number
  className?: string
}

export function TaskMetaIcons({ task, size = 11, className = '' }: Props) {
  const anexos      = contagemAnexos(task)
  const comentarios = contagemComentarios(task)
  if (!anexos && !comentarios) return null

  return (
    <span className={`inline-flex items-center gap-2 text-gray-400 ${className}`}>
      {anexos > 0 && (
        <span className="inline-flex items-center gap-0.5" title={`${anexos} anexo${anexos > 1 ? 's' : ''}`}>
          <Paperclip size={size} strokeWidth={2}/>
          <span className="text-[10px] font-medium tabnum">{anexos}</span>
        </span>
      )}
      {comentarios > 0 && (
        <span className="inline-flex items-center gap-0.5" title={`${comentarios} comentário${comentarios > 1 ? 's' : ''}`}>
          <MessageSquare size={size} strokeWidth={2}/>
          <span className="text-[10px] font-medium tabnum">{comentarios}</span>
        </span>
      )}
    </span>
  )
}
