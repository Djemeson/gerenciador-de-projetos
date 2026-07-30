import React, { useState } from 'react'
import { Inbox, Plus, ArrowRight } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskDetail } from '../components/tasks/TaskDetail'
import { TaskRow } from '../components/tasks/TaskRow'
import { QuickAddRow } from '../components/tasks/QuickAddRow'
import { ColumnHeaders } from '../components/tasks/ColumnHeaders'
import { ProjectIcon } from '../components/ui/EntityBadges'
import { INBOX_PROJECT_ID } from '../types'
import { Select } from '../components/ui/Select'
import { useSettingsStore } from '../stores/useSettingsStore'

export function InboxView() {
  const { tasks, projects, selectedTaskId, updateTask, inboxColumns, activeWorkspaceId } = useAppStore()
  const [adding, setAdding] = useState(false)
  // O texto citava "Ctrl+Espaço" fixo, mas o atalho é configurável — quem trocasse lia
  // uma instrução errada.
  const quickCaptureHotkey = useSettingsStore(s => s.quickCaptureHotkey)

  const inboxTasks = tasks.filter(t => t.projectId === INBOX_PROJECT_ID && !t.parentId && t.workspaceId === activeWorkspaceId)
  const processed  = inboxTasks.filter(t => t.status === 'done')
  const pending    = inboxTasks.filter(t => t.status !== 'done')

  // Só projetos que ainda existem, não estão arquivados e são do workspace ativo
  const activeProjects = projects.filter(p => !p.archived && p.workspaceId === activeWorkspaceId)

  const processTask = (taskId: string, projectId: string) => {
    updateTask(taskId, { projectId, status: 'todo' })
  }

  // Colunas personalizadas da caixa de entrada (persistidas no store)
  const columns = inboxColumns

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-gray-200 bg-white flex-shrink-0">
          <Inbox size={16} className="text-gray-400" />
          <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900 flex-1">Caixa de entrada</h1>
          <span className="text-[11px] text-gray-500 tabnum hidden sm:inline">{pending.length} para processar</span>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
            <Plus size={12} /> Capturar ideia
          </button>
        </div>

        {/* Column headers — agora com colunas personalizadas e botão de adicionar */}
        <ColumnHeaders projectId={INBOX_PROJECT_ID} scope="inbox" columns={columns} showProject={false} />

        <div className="flex-1 overflow-y-auto">
          {/* Empty state */}
          {pending.length === 0 && !adding && (
            <div className="flex flex-col items-center justify-center h-64 text-center px-8">
              <Inbox size={32} className="text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500 mb-1">Caixa vazia</p>
              <p className="text-xs text-gray-400">
                Use <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">{quickCaptureHotkey}</kbd> para capturar ideias de qualquer lugar.<br />
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
            <div key={t.id}>
              <TaskRow task={t} showProject={false} columns={columns} />
              {/* Processar é a ação principal desta tela. Estava dentro de `group-hover`,
                  então no celular — que não tem hover — era impossível processar uma
                  captura. E listava todos os projetos como pílulas: não sobrevive a 30. */}
              <div className="flex items-center gap-2 px-5 py-1.5 bg-gray-50 border-b border-gray-100 flex-wrap">
                <span className="text-[10px] text-gray-500 flex items-center gap-1 flex-shrink-0">
                  <ArrowRight size={12} /> Mover para
                </span>
                {activeProjects.length === 0 ? (
                  <span className="text-[10px] text-gray-500 italic">Nenhum projeto disponível — crie um projeto primeiro.</span>
                ) : (
                  <>
                    <div className="min-w-[168px]">
                      <Select value="" ariaLabel="Mover para o projeto" searchable
                        placeholder="Escolher projeto…"
                        onChange={pid => { if (pid) processTask(t.id, pid) }}
                        options={activeProjects.map(p => ({ value: p.id, label: p.name, color: p.color }))}/>
                    </div>
                    {/* Atalho para os primeiros projetos, sem esconder o resto */}
                    {activeProjects.slice(0, 3).map(p => (
                      <button key={p.id} onClick={() => processTask(t.id, p.id)}
                        className="hidden lg:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-gray-200 hover:border-brand-300 hover:bg-brand-50 bg-white text-gray-600 transition-colors">
                        <ProjectIcon project={p} size={12}/>
                        {p.name}
                      </button>
                    ))}
                  </>
                )}
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
