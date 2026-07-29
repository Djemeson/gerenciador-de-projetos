import React from 'react'
import { X, Download } from 'lucide-react'
import type { Task, Project } from '../../types'
import { PRIORITY_LABEL, STATUS_LABEL } from '../../types'
import { PRIORITY_OPTIONS } from '../ui/Select'
import { useAppStore } from '../../stores/useAppStore'
import { downloadCsv, csvFilename } from '../../lib/exportCsv'
import { parseISO } from '../../lib/dateFilter'

// Drill-down único do relatório: qualquer indicador abre a mesma lista, com o mesmo
// acabamento e a mesma exportação. Antes só "Concluídas" tinha detalhe, e os cards que
// realmente exigem ação ("em atraso", "urgentes") eram becos sem saída.

const fmt = (iso: string | null | undefined) =>
  iso ? parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'

const priorityColor = (p: string) => PRIORITY_OPTIONS.find(o => o.value === p)?.color ?? '#9B9EA8'

export function TaskListModal({ open, title, subtitle, tasks, projects, onClose }: {
  open: boolean; title: string; subtitle?: string
  tasks: Task[]; projects: Project[]; onClose: () => void
}) {
  const setView         = useAppStore(s => s.setView)
  const setSelectedTask = useAppStore(s => s.setSelectedTask)
  if (!open) return null

  // `setView` zera a seleção, então a ordem importa: navega para o projeto e só depois
  // marca a tarefa aberta.
  const openTask = (t: Task) => {
    setView('project_detail', t.projectId)
    setSelectedTask(t.id)
    onClose()
  }

  const exportar = () => downloadCsv(
    csvFilename(title.toLowerCase().replace(/\s+/g, '-')),
    ['Tarefa', 'Projeto', 'Status', 'Prioridade', 'Responsável', 'Prazo', 'Concluída em'],
    tasks.map(t => [
      t.title,
      projects.find(p => p.id === t.projectId)?.name ?? '',
      STATUS_LABEL[t.status],
      PRIORITY_LABEL[t.priority],
      t.assignee,
      fmt(t.dueDate),
      fmt(t.completedAt),
    ]),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-overlay-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[620px] max-w-[92vw] max-h-[80vh] flex flex-col overflow-hidden animate-scale-in"
           onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-extrabold tracking-tight text-gray-900 truncate">{title}</h2>
            {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
          </div>
          <span className="text-[11px] font-bold text-gray-500 tabnum flex-shrink-0">{tasks.length}</span>
          {tasks.length > 0 && (
            <button onClick={exportar} title="Exportar esta lista"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Download size={14} />
            </button>
          )}
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {tasks.length === 0 ? (
            <p className="px-5 py-10 text-[12px] text-gray-400 text-center">Nenhuma tarefa aqui.</p>
          ) : tasks.map(t => {
            const p = projects.find(pr => pr.id === t.projectId)
            return (
              <button key={t.id} onClick={() => openTask(t)}
                className="w-full flex items-center gap-2.5 px-5 py-2.5 text-left hover:bg-gray-50 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: priorityColor(t.priority) }} />
                <span className="flex-1 text-[12px] text-gray-800 truncate">{t.title}</span>
                {p && <span className="text-[10px] text-gray-400 flex-shrink-0 truncate max-w-[120px]">{p.name}</span>}
                <span className="text-[10px] text-gray-400 flex-shrink-0 tabnum w-14 text-right">
                  {t.status === 'done' ? fmt(t.completedAt) : fmt(t.dueDate)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
