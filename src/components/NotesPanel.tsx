import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, StickyNote, Trash2, Pencil } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { nanoid } from '../lib/nanoid'

interface Note { id: string; title: string; body: string; updatedAt: string }

const NOTES_KEY = 'tf_notes'

function loadNotes(): Note[] {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]') } catch { return [] }
}
function saveNotes(notes: Note[]) {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)) } catch { /* noop */ }
}
function emptyNote(n = 1): Note {
  return { id: nanoid(), title: `Nota ${n}`, body: '', updatedAt: new Date().toISOString() }
}

export function NotesPanel() {
  const { toggleNotesPanel } = useAppStore()
  const [notes, setNotes] = useState<Note[]>(() => {
    const loaded = loadNotes()
    return loaded.length ? loaded : [emptyNote(1)]
  })
  const [activeId, setActiveId] = useState<string>(() => {
    const loaded = loadNotes()
    return (loaded[0]?.id) ?? ''
  })
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Garante um activeId válido na montagem/quando as notas mudam.
  useEffect(() => {
    if (!notes.find(n => n.id === activeId)) setActiveId(notes[0]?.id ?? '')
  }, [notes, activeId])

  const persist = (next: Note[]) => { setNotes(next); saveNotes(next) }
  const active = notes.find(n => n.id === activeId)

  const addNote = () => {
    const n = emptyNote(notes.length + 1)
    persist([...notes, n])
    setActiveId(n.id)
    setTimeout(() => bodyRef.current?.focus(), 0)
  }
  const removeNote = (id: string) => {
    const next = notes.filter(n => n.id !== id)
    const finalNext = next.length ? next : [emptyNote(1)]
    persist(finalNext)
    if (activeId === id) setActiveId(finalNext[0].id)
  }
  const updateBody = (body: string) => {
    persist(notes.map(n => n.id === activeId ? { ...n, body, updatedAt: new Date().toISOString() } : n))
  }
  const commitRename = () => {
    if (!renamingId) return
    const v = renameDraft.trim()
    if (v) persist(notes.map(n => n.id === renamingId ? { ...n, title: v } : n))
    setRenamingId(null)
  }

  return (
    <aside className="w-80 min-w-[320px] border-l border-gray-200 bg-white flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <StickyNote size={15} className="text-amber-500"/>
        <span className="text-sm font-semibold text-gray-800 flex-1">Bloco de notas</span>
        <button onClick={addNote} title="Nova nota" className="text-gray-400 hover:text-brand-600 transition-colors">
          <Plus size={16}/>
        </button>
        <button onClick={toggleNotesPanel} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={14}/>
        </button>
      </div>

      {/* Abas (uma por nota) */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 overflow-x-auto scrollbar-none">
        {notes.map(n => (
          <div key={n.id}
            className={`group flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors flex-shrink-0
              ${n.id === activeId ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'text-gray-500 hover:bg-gray-50 border border-transparent'}`}
            onClick={() => setActiveId(n.id)}>
            {renamingId === n.id ? (
              <input autoFocus value={renameDraft}
                onChange={e => setRenameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                onClick={e => e.stopPropagation()}
                className="w-20 bg-transparent outline-none border-b border-amber-400"/>
            ) : (
              <span onDoubleClick={e => { e.stopPropagation(); setRenamingId(n.id); setRenameDraft(n.title) }} className="max-w-[100px] truncate" title="Duplo-clique para renomear">
                {n.title}
              </span>
            )}
            {notes.length > 1 && (
              <button onClick={e => { e.stopPropagation(); removeNote(n.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                <X size={11}/>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Corpo da nota ativa */}
      {active && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
            <button onClick={() => { setRenamingId(active.id); setRenameDraft(active.title) }}
              className="flex items-center gap-1.5 text-[13px] font-bold text-gray-800 hover:text-brand-600 transition-colors group">
              {active.title}
              <Pencil size={11} className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity"/>
            </button>
            <div className="flex-1"/>
            {notes.length > 1 && (
              <button onClick={() => removeNote(active.id)} title="Excluir nota" className="text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={13}/>
              </button>
            )}
          </div>
          <textarea
            ref={bodyRef}
            value={active.body}
            onChange={e => updateBody(e.target.value)}
            placeholder="Escreva sua nota aqui..."
            className="flex-1 w-full resize-none outline-none px-4 py-2 text-[13px] text-gray-700 leading-relaxed bg-transparent placeholder:text-gray-300"
          />
          <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
            Salvo automaticamente · {new Date(active.updatedAt).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
          </div>
        </div>
      )}
    </aside>
  )
}
