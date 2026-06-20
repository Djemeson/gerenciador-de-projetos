import React, { useState } from 'react'
import { Inbox, Plus, ArrowRight } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskDetail } from '../components/tasks/TaskDetail'
import { TaskRow } from '../components/tasks/TaskRow'
import { QuickAddRow } from '../components/tasks/QuickAddRow'
import { ColumnHeaders } from '../components/tasks/ColumnHeaders'
import { INBOX_PROJECT_ID } from '../types'

export function InboxView() {
  const { tasks, projects, selectedTaskId, updateTask } = useAppStore()
  const [adding, setAdding] = useState(false)

  const inboxTasks = tasks.filter(t => t.projectId === INBOX_PROJECT_ID && !t.parentId)
  const processed  = inboxTasks.filter(t => t.status === 'done')
  const pending    = inboxTasks.filter(t => t.status !== 'done')

  // Só projetos que ainda existem e não estão arquivados
  const activeProjects = projects.filter(p => !p.archived)

  const processTask = (taskId: string, projectId: string) => {
    updateTask(taskId, { projectId, status: 'todo' })
  }

  // Inbox has no custom columns — ColumnHeaders works fine with empty array
  const columns: any[] = []

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <Inbox size={15} className="text-gray-400" />
          <h1 className="text-sm font-semibold text-gray-900 flex-1">Caixa de entrada</h1>
          <span className="text-xs text-gray-400">{pending.length} itens para processar</span>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
            <Plus size={12} /> Capturar ideia
          </button>
        </div>

        {/* Column headers — same as task list (sem adicionar coluna na caixa de entrada) */}
        <ColumnHeaders projectId={INBOX_PROJECT_ID} columns={columns} showProject={false} showAddColumn={false} />

        <div className="flex-1 overflow-y-auto">
          {/* Empty state */}
          {pending.length === 0 && !adding && (
            <div className="flex flex-col items-center justify-center h-64 text-center px-8">
              <Inbox size={32} className="text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500 mb-1">Caixa vazia</p>
              <p className="text-xs text-gray-400">
                Use Ctrl+Espaço para capturar ideias de qualquer lugar.<br />
                Depois processe: atribua a um projeto ou conclua.
              </p>
            </div>
          )}

          {/* Quick add */}
          {adding && (
            <QuickAddRow projectId={INBOX_PROJECT_ID} status="todo" onDone={() => setAdding(false)} />
          )}

          {/* Pending tasks */}
          {pending.map(t => (
            <div key={t.id} className="group">
              <TaskRow task={t} showProject={false} columns={columns} />
              {/* Process action */}
              <div className="hidden group-hover:flex items-center gap-2 px-5 py-1.5 bg-gray-50 border-b border-gray-100 flex-wrap">
                <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                  <ArrowRight size={10} /> Mover para:
                </span>
                {activeProjects.length === 0 ? (
                  <span className="text-[10px] text-gray-400 italic">Nenhum projeto disponível — crie um projeto primeiro.</span>
                ) : activeProjects.map(p => (
                  <button key={p.id} onClick={() => processTask(t.id, p.id)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-gray-200 hover:border-brand-300 hover:bg-brand-50 bg-white text-gray-600 transition-colors">
                    {p.icon
                      ? <span className="text-[10px] leading-none">{p.icon}</span>
                      : <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />}
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Processed */}
          {processed.length > 0 && (
            <div className="mt-4 px-5 pb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">
                Processados ({processed.length})
              </p>
              {processed.map(t => (
                <TaskRow key={t.id} task={t} showProject={false} columns={columns} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTaskId && <TaskDetail />}
    </div>
  )
}
