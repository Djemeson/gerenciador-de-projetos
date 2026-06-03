import React, { useState, useEffect, useRef } from 'react'
import { X, Zap } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { INBOX_PROJECT_ID } from '../types'
import type { Priority } from '../types'

interface QuickCaptureProps {
  open:    boolean
  onClose: () => void
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgente', color: '#D85A30' },
  { value: 'high',   label: 'Alta',    color: '#BA7517' },
  { value: 'medium', label: 'Média',   color: '#378ADD' },
  { value: 'low',    label: 'Baixa',   color: '#888780' },
]

export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const { quickAddTask, projects } = useAppStore()
  const [title,    setTitle]    = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [projectId, setProjectId] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setTitle(''); setPriority('medium'); setProjectId('') }
  }, [open])

  if (!open) return null

  const save = () => {
    if (!title.trim()) { onClose(); return }
    const pid = projectId || INBOX_PROJECT_ID
    quickAddTask(title.trim(), pid, 'todo')
    setTitle('')
    // Stay open for another quick capture — Esc to close
    inputRef.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100">
          <Zap size={14} className="text-brand-600" />
          <span className="text-sm font-medium text-gray-700">Captura rápida</span>
          <span className="text-[10px] text-gray-400 ml-auto">Enter para salvar · Esc para fechar</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors ml-2"><X size={14} /></button>
        </div>

        {/* Input */}
        <div className="px-4 pt-3 pb-2">
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={onKey}
            placeholder="O que você está pensando?"
            className="w-full text-base text-gray-800 outline-none bg-transparent placeholder:text-gray-300"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 px-4 pb-4">
          {/* Priority */}
          <div className="flex gap-1">
            {PRIORITY_OPTIONS.map(p => (
              <button
                key={p.value}
                onClick={() => setPriority(p.value)}
                title={p.label}
                className={`w-5 h-5 rounded-full border-2 transition-all ${priority === p.value ? 'scale-110' : 'opacity-40 hover:opacity-70'}`}
                style={{ borderColor: p.color, backgroundColor: priority === p.value ? p.color + '30' : 'transparent' }}
              />
            ))}
          </div>

          {/* Project */}
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 outline-none cursor-pointer flex-1"
          >
            <option value="">→ Caixa de entrada</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <button
            onClick={save}
            disabled={!title.trim()}
            className="px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-30 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
