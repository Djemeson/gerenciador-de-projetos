import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { STATUS_COLOR, PRIORITY_OPTIONS } from '../ui/Select'
import type { Task } from '../../types'

/**
 * Peças do painel da tarefa que valem viver fora dele.
 *
 * O `TaskDetail` tem 1.3 mil linhas e concentra subtarefas, checklists, comentários,
 * anexos, IA, redimensionamento e modos de abertura. O que saiu daqui é o que sai **sem
 * risco**: funções puras, a linha recursiva de subtarefa e o cabeçalho de seção que estava
 * duplicado quatro vezes. As três seções grandes seguem no arquivo original de propósito —
 * elas dependem de dezenas de variáveis de estado local (modos de edição, gravação de
 * áudio, colapso por checklist) e arrancá-las agora significaria passar 15+ props ou
 * reescrever o estado, com chance real de quebrar comportamento sutil sem ganho de leitura.
 */

// ── Formatação ───────────────────────────────────────────────────────────────

export function humanSize(bytes?: number) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function blockTypeForFile(file: File): 'image' | 'audio' | 'file' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'file'
}

/** Gradiente estável por nome — mesma pessoa, mesma cor de avatar em qualquer lugar. */
export function getAvatarBg(name: string) {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colors = [
    'from-brand-500 to-brand-600',
    'from-success-500 to-success-600',
    'from-info-500 to-info-600',
    'from-danger-500 to-pink-600',
    'from-warning-500 to-orange-600',
    'from-brand-500 to-fuchsia-600',
  ]
  return colors[hash % colors.length]
}

// ── Cabeçalho de seção colapsável ────────────────────────────────────────────

/**
 * Cabeçalho das seções do painel (Subtarefas, Checklists, Anexos, Comentários). Estava
 * repetido quatro vezes com pequenas variações de espaçamento — o que fazia cada ajuste
 * de estilo precisar de quatro edições.
 */
export function SectionHeader({
  icon, label, count, collapsed, onToggle, editMode, onToggleEdit, action,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  collapsed: boolean
  onToggle: () => void
  /** Quando definido, mostra o lápis que revela os "X" de remover (regra da seção 14). */
  editMode?: boolean
  onToggleEdit?: () => void
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={onToggle}
        className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 uppercase tracking-wider hover:text-gray-900 transition-colors">
        {collapsed ? <ChevronRight size={12} className="text-gray-400"/> : <ChevronDown size={12} className="text-gray-400"/>}
        {icon}
        {label}{typeof count === 'number' && count > 0 && <span className="text-gray-500 font-semibold"> ({count})</span>}
      </button>
      <div className="flex-1" />
      {onToggleEdit && (
        <button onClick={onToggleEdit} title={editMode ? 'Concluir edição' : 'Editar itens'}
          className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${
            editMode ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
          <Pencil size={12}/>
        </button>
      )}
      {action}
    </div>
  )
}

// ── Linha de subtarefa (recursiva) ───────────────────────────────────────────

/**
 * Mostra subtarefas de subtarefas (netos, bisnetos…) com linha-guia de hierarquia, no mesmo
 * padrão do painel de tarefas. Movido do `TaskDetail` **sem alteração de comportamento** —
 * a única mudança é a cor de status vir de `STATUS_COLOR` em vez de hex redigitado.
 */
export function SubtaskTreeItem({ task, depth, editMode }: { task: Task; depth: number; editMode: boolean }) {
  const { updateTask, deleteTask, setSelectedTask, getSubtasks } = useAppStore()
  const [expanded, setExpanded] = useState(true)
  const children = getSubtasks(task.id)
  const hasChildren = children.length > 0
  const sColor = STATUS_COLOR[task.status]
  const sPrio  = PRIORITY_OPTIONS.find(o => o.value === task.priority)
  return (
    <div>
      <div onClick={() => setSelectedTask(task.id)}
        className="w-full flex items-center justify-between text-left px-3 py-2 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 cursor-pointer group transition-all">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {hasChildren ? (
            <button onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-gray-500 flex-shrink-0">
              {expanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
            </button>
          ) : <span className="w-3.5 flex-shrink-0"/>}
          <button
            onClick={e => { e.stopPropagation(); updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' }) }}
            className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:scale-110 active:scale-95 focus:outline-none"
            style={{ borderColor: sColor }}
            title={task.status === 'done' ? 'Marcar como a fazer' : 'Marcar como concluído'}
          >
            {task.status === 'done' && <span className="w-2 h-2 rounded-full" style={{ background: sColor }} />}
          </button>
          <span className={`text-sm truncate font-medium ${task.status === 'done' ? 'line-through text-gray-500 font-normal' : 'text-gray-700'}`}>{task.title}</span>
          {hasChildren && (
            <span className="text-[10px] text-gray-500 flex-shrink-0 tabnum">
              {children.filter(c => c.status === 'done').length}/{children.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {sPrio && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: sPrio.color + '15', color: sPrio.textColor ?? sPrio.color }}>{sPrio.label}</span>
          )}
          {editMode && (
            <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }} title="Remover subtarefa"
              className="p-1 rounded text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="ml-[27px] pl-3 border-l border-gray-100 space-y-1 mt-1">
          {children.map(c => <SubtaskTreeItem key={c.id} task={c} depth={depth + 1} editMode={editMode}/>)}
        </div>
      )}
    </div>
  )
}
