import React, { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui'
import { useAppStore } from '../../stores/useAppStore'
import type { Priority, TaskStatus } from '../../types'
import { PRIORITY_LABEL, STATUS_LABEL } from '../../types'

export function NewTaskModal() {
  const { newTaskModal, closeNewTask, addTask, projects } = useAppStore()
  const defaultProject = newTaskModal.projectId ?? projects[0]?.id ?? ''

  const [title,     setTitle]     = useState('')
  const [desc,      setDesc]      = useState('')
  const [projectId, setProjectId] = useState(defaultProject)
  const [status,    setStatus]    = useState<TaskStatus>('todo')
  const [priority,  setPriority]  = useState<Priority>('medium')
  const [dueDate,   setDueDate]   = useState('')
  const [assignee,  setAssignee]  = useState('DJ')
  const [tagsRaw,   setTagsRaw]   = useState('')

  const reset = () => {
    setTitle(''); setDesc(''); setStatus('todo'); setPriority('medium')
    setDueDate(''); setAssignee('DJ'); setTagsRaw('')
    setProjectId(newTaskModal.projectId ?? projects[0]?.id ?? '')
  }

  const handleClose = () => { reset(); closeNewTask() }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !projectId) return
    addTask({
      projectId,
      title: title.trim(),
      description: desc.trim(),
      status,
      priority,
      dueDate: dueDate || null,
      assignee: assignee.trim() || 'DJ',
      tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
      subtasks: [],
    })
    handleClose()
  }

  return (
    <Modal open={newTaskModal.open} onClose={handleClose} title="Nova tarefa">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Nome da tarefa *"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 transition-all"
          />
        </div>

        <div>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Projeto *</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none bg-white"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as TaskStatus)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none bg-white"
            >
              {(['todo','in_progress','done'] as TaskStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Prioridade</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none bg-white"
            >
              {(['urgent','high','medium','low'] as Priority[]).map(p => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Prazo</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Responsável</label>
            <input
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              placeholder="Ex: DJ"
              className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Tags (separadas por vírgula)</label>
            <input
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="Dev, Design, ..."
              className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="default" onClick={handleClose} className="flex-1">Cancelar</Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={!title.trim()}>Criar tarefa</Button>
        </div>
      </form>
    </Modal>
  )
}
