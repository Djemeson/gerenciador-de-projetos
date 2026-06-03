import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import type { TaskStatus } from '../../types'

interface QuickAddRowProps {
  projectId: string
  status: TaskStatus
  parentId?: string
  onDone: () => void
}

export function QuickAddRow({ projectId, status, parentId, onDone }: QuickAddRowProps) {
  const [title, setTitle] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const { quickAddTask, setSelectedTask } = useAppStore()

  useEffect(() => { ref.current?.focus() }, [])

  const save = () => {
    if (!title.trim()) { onDone(); return }
    const task = quickAddTask(title, projectId, status, parentId)
    setTitle('')
    setSelectedTask(task.id)
    onDone()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  save()
    if (e.key === 'Escape') onDone()
  }

  return (
    <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-100 bg-brand-50/30">
      <span className="w-4 h-4 rounded-full border-2 border-brand-300 flex-shrink-0" />
      <input
        ref={ref}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={onKey}
        onBlur={save}
        placeholder="Nome da tarefa..."
        className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
      />
      <span className="text-[10px] text-gray-400 flex-shrink-0 hidden sm:block">
        Enter para salvar · Esc para cancelar
      </span>
    </div>
  )
}
