import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Plus, StickyNote, Trash2, Search, Pin, PinOff, ChevronLeft,
  ListChecks, MoreHorizontal, Check, Copy,
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { Select } from './ui/Select'
import { noteDisplayTitle } from '../types'
import type { Note } from '../types'

/**
 * Bloco de notas.
 *
 * Reformulado em 29/07/2026. O que existia era um Notepad embutido: as notas ficavam
 * soltas no `localStorage` (não sincronizavam — escrever no computador e não achar no
 * celular), viviam em **abas** (que não escalam numa coluna de 320px), nasciam com nome
 * "Nota 1" e não tinham como virar nada. Três decisões guiaram a reformulação:
 *
 * 1. **Sincroniza** — a nota agora vive no estado do app, junto com o resto (ver store).
 * 2. **Tem destino** — "Transformar em tarefa" é a ponte que faltava entre anotar e fazer.
 * 3. **Lista com busca**, no lugar das abas, para escalar de 3 para 30 notas.
 *
 * Em painel estreito o padrão é mestre-detalhe: a lista ocupa tudo; ao abrir uma nota o
 * editor toma a área e a volta é explícita. Não empilhar lista e editor ao mesmo tempo.
 */

const LARGURA_KEY = 'tf_notes_width'
const SALVO_MS = 500   // pausa de digitação antes de gravar

export function NotesPanel() {
  const {
    toggleNotesPanel, notes: todas, activeWorkspaceId, projects: todosProjetos,
    addNote, updateNote, deleteNote, toggleNotePin, noteToTask,
    setView, setSelectedTask,
  } = useAppStore()

  const notes = useMemo(
    () => todas.filter(n => n.workspaceId === activeWorkspaceId)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [todas, activeWorkspaceId],
  )
  const projetos = useMemo(() => todosProjetos.filter(p => p.workspaceId === activeWorkspaceId && !p.archived), [todosProjetos, activeWorkspaceId])

  const [abertaId, setAbertaId] = useState<string | null>(null)
  const [busca, setBusca]       = useState('')
  const [menuId, setMenuId]     = useState<string | null>(null)
  const [width, setWidth]       = useState<number>(() => { try { return Number(localStorage.getItem(LARGURA_KEY)) || 360 } catch { return 360 } })
  useEffect(() => { try { localStorage.setItem(LARGURA_KEY, String(width)) } catch {} }, [width])

  const aberta = notes.find(n => n.id === abertaId) ?? null

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(n => `${noteDisplayTitle(n)} ${n.body}`.toLowerCase().includes(q))
  }, [notes, busca])

  const novaNota = () => { const n = addNote(); setAbertaId(n.id) }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = width
    const move = (ev: MouseEvent) => setWidth(Math.min(560, Math.max(300, w0 - (ev.clientX - x0))))
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.body.style.cursor = '' }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
    document.body.style.cursor = 'col-resize'
  }

  return (
    <aside
      style={{ width }}
      className="fixed inset-0 z-40 md:relative md:inset-auto md:z-auto border-l border-gray-200 bg-white flex flex-col h-full flex-shrink-0 max-md:!w-full">
      {/* Alça de redimensionar — o painel era fixo em 320px, ao contrário do resto do app */}
      <div onMouseDown={startResize} title="Arraste para redimensionar"
        className="hidden md:block absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-200 transition-colors" />

      {/* ── Cabeçalho ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 flex-shrink-0">
        {aberta ? (
          <button onClick={() => setAbertaId(null)} title="Todas as notas"
            className="flex items-center gap-1 text-[12px] font-semibold text-gray-500 hover:text-gray-800 transition-colors">
            <ChevronLeft size={14} /> Notas
          </button>
        ) : (
          <>
            <StickyNote size={16} className="text-gray-400" />
            <span className="text-[14px] font-extrabold tracking-tight text-gray-900 flex-1">Notas</span>
            <span className="text-[10px] text-gray-500 tabnum">{notes.length}</span>
          </>
        )}
        <div className="flex-1" />
        {!aberta && (
          <button onClick={novaNota} title="Nova nota"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-brand-600 transition-colors">
            <Plus size={16} />
          </button>
        )}
        <button onClick={toggleNotesPanel} title="Fechar"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <X size={14} />
        </button>
      </div>

      {aberta
        ? <Editor
            note={aberta} projetos={projetos}
            onChange={patch => updateNote(aberta.id, patch)}
            onPin={() => toggleNotePin(aberta.id)}
            onDelete={() => { deleteNote(aberta.id); setAbertaId(null) }}
            onConvert={projectId => {
              const t = noteToTask(aberta.id, projectId)
              setAbertaId(null)
              if (t) { setView('project_detail', projectId); setSelectedTask(t.id) }
            }}
          />
        : <Lista
            notes={filtradas} total={notes.length} busca={busca} onBusca={setBusca}
            menuId={menuId} onMenu={setMenuId}
            onAbrir={setAbertaId} onNova={novaNota}
            onPin={toggleNotePin} onDelete={deleteNote}
          />}
    </aside>
  )
}

// ── Lista ────────────────────────────────────────────────────────────────────

function Lista({ notes, total, busca, onBusca, menuId, onMenu, onAbrir, onNova, onPin, onDelete }: {
  notes: Note[]; total: number; busca: string; onBusca: (v: string) => void
  menuId: string | null; onMenu: (id: string | null) => void
  onAbrir: (id: string) => void; onNova: () => void
  onPin: (id: string) => void; onDelete: (id: string) => void
}) {
  if (total === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-3">
          <StickyNote size={18} className="text-gray-400" />
        </div>
        <p className="text-[13px] font-bold text-gray-800">Nenhuma nota ainda</p>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          Use para o que ainda não é tarefa: ideia solta, recado de reunião, rascunho.
          Depois, um clique transforma em tarefa no projeto certo.
        </p>
        <button onClick={onNova}
          className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-bold rounded-lg transition-colors">
          <Plus size={14} /> Escrever a primeira
        </button>
      </div>
    )
  }

  return (
    <>
      {total > 4 && (
        <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => onBusca(e.target.value)} placeholder="Buscar nas notas..."
              className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="px-4 py-8 text-[12px] text-gray-500 text-center">Nada encontrado.</p>
        ) : notes.map(n => {
          const previa = n.body.split('\n').slice(n.title.trim() ? 0 : 1).join(' ').trim()
          return (
            <div key={n.id} className="group relative border-b border-gray-100">
              <button onClick={() => onAbrir(n.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-1.5">
                  {n.pinned && <Pin size={12} className="text-brand-500 flex-shrink-0" />}
                  <span className="text-[12.5px] font-semibold text-gray-800 truncate flex-1">{noteDisplayTitle(n)}</span>
                </div>
                {previa && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{previa}</p>}
                <span className="text-[10px] text-gray-400 mt-1 block">{quando(n.updatedAt)}</span>
              </button>

              <div className="absolute right-2 top-2.5">
                <button onClick={() => onMenu(menuId === n.id ? null : n.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                  <MoreHorizontal size={14} />
                </button>
                {menuId === n.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => onMenu(null)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 animate-scale-in">
                      <ItemMenu icon={n.pinned ? PinOff : Pin} label={n.pinned ? 'Desafixar' : 'Fixar no topo'}
                        onClick={() => { onPin(n.id); onMenu(null) }} />
                      <ItemMenu icon={Trash2} label="Excluir nota" danger
                        onClick={() => { onDelete(n.id); onMenu(null) }} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Editor ───────────────────────────────────────────────────────────────────

function Editor({ note, projetos, onChange, onPin, onDelete, onConvert }: {
  note: Note
  projetos: { id: string; name: string; color: string }[]
  onChange: (patch: Partial<Note>) => void
  onPin: () => void
  onDelete: () => void
  onConvert: (projectId: string) => void
}) {
  const [rascunho, setRascunho] = useState(note.body)
  const [titulo,   setTitulo]   = useState(note.title)
  const [salvo,    setSalvo]    = useState(true)
  const [converter, setConverter] = useState(false)
  const [destino,   setDestino]   = useState(note.projectId ?? projetos[0]?.id ?? '')
  const corpoRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setRascunho(note.body); setTitulo(note.title); setSalvo(true) }, [note.id])
  useEffect(() => { if (!note.body && !note.title) corpoRef.current?.focus() }, [note.id])

  // Grava numa pausa da digitação. Antes cada tecla escrevia no armazenamento — com a
  // sincronização ligada isso viraria uma rajada de escritas na nuvem.
  useEffect(() => {
    if (rascunho === note.body && titulo === note.title) return
    setSalvo(false)
    const t = setTimeout(() => { onChange({ body: rascunho, title: titulo }); setSalvo(true) }, SALVO_MS)
    return () => clearTimeout(t)
  }, [rascunho, titulo])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <input
          value={titulo} onChange={e => setTitulo(e.target.value)}
          placeholder={noteDisplayTitle({ ...note, title: '' })}
          className="flex-1 min-w-0 text-[14px] font-extrabold tracking-tight text-gray-900 bg-transparent outline-none placeholder:text-gray-400 placeholder:font-semibold" />
        <button onClick={onPin} title={note.pinned ? 'Desafixar' : 'Fixar no topo'}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${note.pinned ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:bg-gray-100'}`}>
          <Pin size={14} />
        </button>
        <button onClick={onDelete} title="Excluir nota"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-danger-50 hover:text-danger-600 transition-colors flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      <textarea
        ref={corpoRef} value={rascunho} onChange={e => setRascunho(e.target.value)}
        placeholder="Escreva aqui. A primeira linha vira o título."
        className="flex-1 w-full resize-none outline-none px-4 py-2 text-[13px] text-gray-700 leading-relaxed bg-transparent placeholder:text-gray-400" />

      {/* ── Rodapé: destino da nota ── */}
      <div className="border-t border-gray-200 px-4 py-2.5 flex-shrink-0 space-y-2">
        {converter ? (
          <div className="space-y-2 animate-fade-in">
            <p className="text-[11px] font-semibold text-gray-600">Criar tarefa em qual projeto?</p>
            <Select value={destino} onChange={setDestino} ariaLabel="Projeto de destino" searchable
              options={projetos.map(p => ({ value: p.id, label: p.name, color: p.color }))} />
            <div className="flex items-center gap-2">
              <button onClick={() => destino && onConvert(destino)} disabled={!destino}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-[12px] font-bold rounded-lg transition-colors">
                <Check size={14} /> Criar tarefa
              </button>
              <button onClick={() => setConverter(false)}
                className="px-3 py-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-700 transition-colors">
                Cancelar
              </button>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              A nota sai daqui e vira tarefa: título na primeira linha, o resto na descrição.
            </p>
          </div>
        ) : (
          <>
            <button onClick={() => setConverter(true)} disabled={projetos.length === 0}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-gray-200 rounded-lg text-[12px] font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-600 disabled:opacity-40 transition-colors">
              <ListChecks size={14} /> Transformar em tarefa
            </button>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">
                {salvo ? `Salvo · ${quando(note.updatedAt)}` : 'Salvando…'}
              </span>
              <button onClick={() => navigator.clipboard?.writeText(`${noteDisplayTitle(note)}\n\n${note.body}`)}
                title="Copiar nota" className="text-[10px] font-semibold text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1">
                <Copy size={12} /> Copiar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ItemMenu({ icon: Icon, label, onClick, danger }: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors ${danger ? 'text-danger-600 hover:bg-danger-50' : 'text-gray-700 hover:bg-gray-50'}`}>
      <Icon size={14} className={danger ? '' : 'text-gray-400'} /> {label}
    </button>
  )
}

/** "agora", "há 20 min", "hoje 14:32" ou a data — o rodapé antigo mostrava sempre a data cheia. */
function quando(iso: string): string {
  const d = new Date(iso), agora = new Date()
  const min = Math.round((agora.getTime() - d.getTime()) / 60000)
  if (min < 1)  return 'agora'
  if (min < 60) return `há ${min} min`
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dia  = new Date(d); dia.setHours(0, 0, 0, 0)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (dia.getTime() === hoje.getTime()) return `hoje ${hora}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
