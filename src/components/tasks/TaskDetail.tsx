import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  X, Flag, Calendar, User, CheckSquare, Trash2, Plus, ListChecks, GitBranch, Tag,
  Maximize2, Minimize2, ChevronDown, Check, TrendingUp,
  MessageCircle, Paperclip, Mic, MicOff, FileText, Pencil, Image as ImageIcon,
  ChevronRight, ArrowUpFromLine, Download, Send, Wand2, Loader2,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import type { Priority, TaskStatus, TaskOpenMode, ContentBlock } from '../../types'
import { TYPE_ICON } from '../../lib/taskTypeIcons'
import { Button } from '../ui'
import { Select, PRIORITY_OPTIONS, STATUS_OPTIONS } from '../ui/Select'
import { TagInput } from '../ui/TagInput'
import { DueDatePicker } from '../ui/DueDatePicker'
import { AssigneePicker } from '../ui/AssigneePicker'
import { ProjectIcon } from '../ui/EntityBadges'
import { taskProgress } from '../../lib/taskProgress'
import { QuickAddRow } from './QuickAddRow'
import { BlockEditor, openData } from './BlockEditor'
import { nanoid } from '../../lib/nanoid'
import { TaskInsights } from './TaskInsights'
import { generateChecklistItems, generateProjectEnrichment } from '../../lib/aiProjectGen'
import { createTaskTree } from '../../lib/aiTaskCreate'

interface Props {
  mode?: TaskOpenMode
  onChangeMode?: (mode: TaskOpenMode) => void
}

function humanSize(bytes?: number) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function blockTypeForFile(file: File): 'image' | 'audio' | 'file' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'file'
}

function getAvatarBg(name: string) {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colors = [
    'from-indigo-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-sky-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-violet-500 to-fuchsia-600',
  ]
  return colors[hash % colors.length]
}

export function TaskDetail({ mode: propMode, onChangeMode }: Props) {
  const {
    tasks, projects, selectedTaskId, setSelectedTask,
    updateTask, deleteTask, updateBlocks, addTask,
    addChecklist, renameChecklist, removeChecklist, addChecklistItem, renameChecklistItem,
    toggleChecklistItem, removeChecklistItem,
    addComment, removeComment,
    getSubtasks, setTaskOpenMode,
  } = useAppStore()
  const { openAIKey, geminiApiKey } = useSettingsStore()

  // Determine active task and its project for open mode settings
  const task = tasks.find(t => t.id === selectedTaskId)
  const project = projects.find(p => p.id === task?.projectId)

  // Track the open mode locally so non-project tasks and all views benefit from it
  const [localMode, setLocalMode] = useState<TaskOpenMode>('center')

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const titleTextareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto'
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`
    }
  }, [selectedTaskId, task?.title])

  useEffect(() => {
    let modeToUse: TaskOpenMode = 'center'
    if (propMode) {
      modeToUse = propMode
    } else if (project?.taskOpenMode) {
      modeToUse = project.taskOpenMode
    }
    // Normalize 'side' to 'center'
    if (modeToUse === 'side') {
      modeToUse = 'center'
    }
    setLocalMode(modeToUse)
  }, [propMode, project?.id, project?.taskOpenMode, selectedTaskId])

  const activeMode = (propMode === 'side' ? 'center' : propMode) ?? localMode

  const handleModeChange = (newMode: TaskOpenMode) => {
    const updatedMode = newMode === 'side' ? 'center' : newMode
    setLocalMode(updatedMode)
    if (project) {
      setTaskOpenMode(project.id, updatedMode)
    }
    if (onChangeMode) {
      onChangeMode(updatedMode)
    }
  }

  // ── Resize (side mode only) ──────
  const [width, setWidth]  = useState(() => {
    try { const saved = Number(localStorage.getItem('tf_taskpanel_width')); if (saved >= 420) return saved } catch {}
    return typeof window !== 'undefined'
      ? Math.min(960, Math.max(560, Math.round(window.innerWidth * 0.55)))
      : 640
  })
  useEffect(() => { try { localStorage.setItem('tf_taskpanel_width', String(width)) } catch {} }, [width])
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragging.current = true; startX.current = e.clientX; startW.current = width
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const max = typeof window !== 'undefined' ? window.innerWidth * 0.85 : 1100
      setWidth(Math.max(420, Math.min(max, startW.current + (startX.current - ev.clientX))))
    }
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [width])

  // ── Checklist state ──────────────────────────────────────────────────────
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemValue, setEditingItemValue] = useState('')
  const [editingItemChecklistId, setEditingItemChecklistId] = useState<string | null>(null)
  const [addingSubtask,    setAddingSubtask]     = useState(false)
  const [siblingsMenuOpen, setSiblingsMenuOpen]  = useState(false)
  const [renamingChecklistId, setRenamingChecklistId] = useState<string | null>(null)
  const [checklistRenameDraft, setChecklistRenameDraft] = useState('')
  const [subtaskEditMode,   setSubtaskEditMode]   = useState(false)
  const [commentEditMode,   setCommentEditMode]   = useState(false)
  const [checklistEditMode, setChecklistEditMode]  = useState<Record<string, boolean>>({})
  const [subtasksSectionCollapsed, setSubtasksSectionCollapsed] = useState(false)
  const [checklistsSectionCollapsed, setChecklistsSectionCollapsed] = useState(false)
  const [commentsSectionCollapsed, setCommentsSectionCollapsed] = useState(false)
  const [checklistCollapsed, setChecklistCollapsed] = useState<Record<string, boolean>>({})
  const [isDescExpanded, setIsDescExpanded] = useState(false)

  // ── Sugestões por IA (checklist / subtarefas) ─────────────────────────
  const [aiChecklistLoading, setAiChecklistLoading] = useState(false)
  const [aiSubtaskLoading,   setAiSubtaskLoading]   = useState(false)
  const [aiNotice, setAiNotice] = useState('')

  // ── Comentários ───────────────────────────────────────────────────────
  const [commentDraft, setCommentDraft] = useState('')
  const [recordingComment, setRecordingComment] = useState(false)
  const [pendingCommentAttachment, setPendingCommentAttachment] = useState<{ name: string; data: string; mimeType: string } | null>(null)
  const [pendingCommentAudio, setPendingCommentAudio] = useState<{ data: string } | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const commentMediaRef  = useRef<MediaRecorder | null>(null)
  const commentChunksRef = useRef<Blob[]>([])
  const commentFileRef   = useRef<HTMLInputElement>(null)

  // ── Anexos (seção unificada) ──────────────────────────────────────────
  const [anexosCollapsed, setAnexosCollapsed] = useState(false)
  const [anexosEditMode, setAnexosEditMode] = useState(false)
  const attachmentFileRef = useRef<HTMLInputElement>(null)
  const attachmentMediaRef = useRef<MediaRecorder | null>(null)
  const attachmentChunksRef = useRef<Blob[]>([])
  const [recordingAttachment, setRecordingAttachment] = useState(false)

  const subtasks = task ? getSubtasks(task.id) : []
  const parent    = task?.parentId ? tasks.find(t => t.id === task.parentId) : undefined
  const siblings  = parent ? getSubtasks(parent.id) : []

  if (!task) return null

  const statusColorOf = (s: TaskStatus) => s==='done' ? '#1D9E75' : s==='in_progress' ? '#378ADD' : '#888780'

  const handleCreateChecklist = () => {
    const nextNum = task.checklists.length + 1
    const title = nextNum === 1 ? 'Checklist' : `Checklist ${nextNum}`
    const newClId = nanoid()
    addChecklist(task.id, title, newClId)
    
    // Create first empty item in edit mode immediately
    const newItemId = nanoid()
    addChecklistItem(task.id, newClId, '', newItemId)
    
    setEditingItemId(newItemId)
    setEditingItemValue('')
    setEditingItemChecklistId(newClId)
  }

  const taskDescriptionText = () => {
    const block = task.blocks.find(b => b.type === 'text' && (b.region ?? 'body') === 'body')
    return (block?.text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const handleAISuggestChecklist = async () => {
    if (aiChecklistLoading) return
    setAiChecklistLoading(true); setAiNotice('')
    try {
      const targetCl = task.checklists[0]
      const existingItems = targetCl ? targetCl.items.map(i => i.text) : []
      const { items } = await generateChecklistItems(
        { title: task.title, description: taskDescriptionText() }, existingItems, '', { openAIKey, geminiApiKey }
      )
      if (items.length === 0) {
        setAiNotice('Configure uma chave de IA em Configurações para gerar sugestões automáticas.')
        return
      }
      let clId = targetCl?.id
      if (!clId) {
        clId = nanoid()
        addChecklist(task.id, 'Checklist', clId)
      }
      items.forEach(text => addChecklistItem(task.id, clId!, text, nanoid()))
    } finally {
      setAiChecklistLoading(false)
    }
  }

  const handleAISuggestSubtasks = async () => {
    if (aiSubtaskLoading || !task.projectId) return
    setAiSubtaskLoading(true); setAiNotice('')
    try {
      const existing = subtasks.map(s => ({ title: s.title, taskType: s.taskType ?? ('task' as const), isSubtask: false }))
      const { tasks: more } = await generateProjectEnrichment(
        { name: task.title, description: taskDescriptionText() }, existing, '', { openAIKey, geminiApiKey }
      )
      if (more.length === 0) {
        setAiNotice('Configure uma chave de IA em Configurações para gerar sugestões automáticas.')
        return
      }
      for (const t of more) createTaskTree(addTask, task.projectId, task.id, t)
    } finally {
      setAiSubtaskLoading(false)
    }
  }

  const handleAddNewItem = (clId: string) => {
    const newItemId = nanoid()
    addChecklistItem(task.id, clId, '', newItemId)
    setEditingItemId(newItemId)
    setEditingItemValue('')
    setEditingItemChecklistId(clId)
  }

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, clId: string, itemId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = editingItemValue.trim()
      if (trimmed) {
        renameChecklistItem(task.id, clId, itemId, trimmed)
        
        // Add another empty item for next input
        const nextItemId = nanoid()
        addChecklistItem(task.id, clId, '', nextItemId)
        
        setEditingItemId(nextItemId)
        setEditingItemValue('')
        setEditingItemChecklistId(clId)
      } else {
        // If they hit enter on an empty item, discard it and stop editing
        removeChecklistItem(task.id, clId, itemId)
        setEditingItemId(null)
        setEditingItemValue('')
        setEditingItemChecklistId(null)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      const trimmed = editingItemValue.trim()
      if (trimmed) {
        renameChecklistItem(task.id, clId, itemId, trimmed)
      } else {
        removeChecklistItem(task.id, clId, itemId)
      }
      setEditingItemId(null)
      setEditingItemValue('')
      setEditingItemChecklistId(null)
    }
  }

  const handleItemBlur = (clId: string, itemId: string) => {
    const trimmed = editingItemValue.trim()
    if (trimmed) {
      renameChecklistItem(task.id, clId, itemId, trimmed)
    } else {
      removeChecklistItem(task.id, clId, itemId)
    }
    setEditingItemId(null)
    setEditingItemValue('')
    setEditingItemChecklistId(null)
  }

  const postComment = () => {
    if (!commentDraft.trim() && !pendingCommentAttachment && !pendingCommentAudio) return
    addComment(task.id, {
      text: commentDraft.trim() || undefined,
      attachment: pendingCommentAttachment || undefined,
      audio: pendingCommentAudio || undefined
    })
    setCommentDraft('')
    setPendingCommentAttachment(null)
    setPendingCommentAudio(null)
    setMicError(null)
  }
  const pickCommentAttachment = () => commentFileRef.current?.click()
  const onCommentAttachPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPendingCommentAttachment({
        name: file.name,
        data: reader.result as string,
        mimeType: file.type
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const startCommentRecording = async () => {
    setMicError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicError('Gravação de áudio não suportada neste navegador.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      commentChunksRef.current = []
      mr.ondataavailable = e => commentChunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(commentChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => {
          setPendingCommentAudio({
            data: reader.result as string
          })
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      commentMediaRef.current = mr
      setRecordingComment(true)
    } catch (err: any) {
      console.error(err)
      setMicError('Permissão de microfone negada ou indisponível.')
    }
  }
  const stopCommentRecording = () => {
    commentMediaRef.current?.stop()
    setRecordingComment(false)
  }
  const formatCommentTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })

  // ── Anexos unificados ──
  const attachments = task.blocks.filter(b => (b.region ?? 'body') === 'attachment')

  const pickAttachment = () => attachmentFileRef.current?.click()
  const onAttachmentPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const type = blockTypeForFile(file)
      const reader = new FileReader()
      reader.onload = () => {
        const newBlock: ContentBlock = {
          id: nanoid(),
          type,
          data: reader.result as string,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          region: 'attachment',
          display: type === 'image' ? 'full' : 'title'
        }
        updateBlocks(task.id, [...task.blocks, newBlock])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const startAttachmentRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      attachmentChunksRef.current = []
      mr.ondataavailable = e => attachmentChunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(attachmentChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => {
          const newBlock: ContentBlock = {
            id: nanoid(),
            type: 'audio',
            data: reader.result as string,
            name: 'Áudio gravado',
            mimeType: 'audio/webm',
            size: blob.size,
            region: 'attachment',
            display: 'title'
          }
          updateBlocks(task.id, [...task.blocks, newBlock])
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      attachmentMediaRef.current = mr
      setRecordingAttachment(true)
    } catch {
      alert('Permissão de microfone negada.')
    }
  }

  const stopAttachmentRecording = () => {
    attachmentMediaRef.current?.stop()
    setRecordingAttachment(false)
  }

  const removeAttachment = (id: string) => {
    updateBlocks(task.id, task.blocks.filter(b => b.id !== id))
  }

  const containerClass = activeMode === 'full'
    ? 'flex flex-col flex-1 bg-white h-full overflow-hidden'
    : activeMode === 'center'
    ? 'flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden'
    : 'relative flex flex-col border-l border-gray-200 bg-white h-full overflow-hidden flex-shrink-0'

  const containerStyle = activeMode === 'full'
    ? { width: '100vw', height: '100vh' }
    : activeMode === 'center'
    ? { width: '1200px', maxWidth: '96vw', height: '90vh', maxHeight: '900px' }
    : { width }

  const statusColor = task.status==='done' ? '#1D9E75' : task.status==='in_progress' ? '#378ADD' : '#888780'

  const projectOptions = projects.map(p => ({ value: p.id, label: p.name, color: p.color }))
  const priorityOptions = PRIORITY_OPTIONS.map(o => ({ ...o, icon: Flag }))

  const content = (
    <>
      {/* Draggable divider (side mode only) */}
      {activeMode === 'side' && (
        <div onMouseDown={onDragStart}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-400 z-20 transition-colors"
          title="Arrastar para redimensionar"/>
      )}

      {/* Breadcrumb — se for subtarefa */}
      {parent && (
        <div className="relative flex items-center gap-2 px-6 py-2 bg-gray-50/70 border-b border-gray-100 flex-shrink-0">
          <span className="w-2 h-2 rounded-full border-2 flex-shrink-0" style={{ borderColor: statusColorOf(parent.status) }}/>
          <button onClick={() => setSelectedTask(parent.id)}
            className="text-xs font-semibold text-gray-600 hover:text-brand-600 hover:underline truncate min-w-0 flex-1 text-left">
            {parent.title}
          </button>
          {siblings.length > 1 && (
            <button onClick={() => setSiblingsMenuOpen(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-[11px] font-bold text-gray-600 flex-shrink-0 transition-colors">
              <GitBranch size={11}/>{siblings.length}<ChevronDown size={10}/>
            </button>
          )}
          {siblingsMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSiblingsMenuOpen(false)}/>
              <div className="absolute top-full right-4 mt-1 w-[230px] max-h-[280px] overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-xl p-1.5 z-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Subtarefas</p>
                {siblings.map(sb => (
                  <button key={sb.id} onClick={() => { setSelectedTask(sb.id); setSiblingsMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                    <span className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center" style={{ borderColor: statusColorOf(sb.status) }}>
                      {sb.status==='done' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColorOf(sb.status) }}/>}
                    </span>
                    <span className={`flex-1 text-xs truncate ${sb.status==='done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{sb.title}</span>
                    {sb.id===task.id && <Check size={13} className="text-brand-600 flex-shrink-0" strokeWidth={2.6}/>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Header com o título da tarefa */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white gap-4">
        <div className="flex-1 min-w-0">
          <textarea
            ref={titleTextareaRef}
            rows={1}
            value={task.title}
            onChange={e => {
              updateTask(task.id, { title: e.target.value })
              if (titleTextareaRef.current) {
                titleTextareaRef.current.style.height = 'auto'
                titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`
              }
            }}
            placeholder="Nome da tarefa"
            className="w-full font-bold text-xl md:text-2xl text-gray-900 leading-snug outline-none bg-transparent placeholder:text-gray-300 py-1 px-2 -ml-2 rounded-lg hover:bg-gray-50/50 focus:bg-white focus:ring-1 focus:ring-brand-400 border-none resize-none overflow-hidden block"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Strategic Focus Button */}
          <button
            onClick={() => handleModeChange(activeMode === 'full' ? 'center' : 'full')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm cursor-pointer ${
              activeMode === 'full'
                ? 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100 ring-1 ring-brand-200/50'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
            title={activeMode === 'full' ? 'Sair do modo foco' : 'Focar na tarefa (Preenchimento total)'}
          >
            {activeMode === 'full' ? (
              <>
                <Minimize2 size={13} className="text-brand-600" />
                <span className="hidden sm:inline">Sair do Foco</span>
              </>
            ) : (
              <>
                <Maximize2 size={13} className="text-gray-500" />
                <span className="hidden sm:inline">Focar Tarefa</span>
              </>
            )}
          </button>

          <button onClick={() => setSelectedTask(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex-shrink-0 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Corpo — duas colunas */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-hidden">
        {/* Coluna principal (Descrição, checklists, subtarefas, anexos, comentários) */}
        <div className="flex-1 min-w-0 md:overflow-y-auto px-4 md:px-8 py-6 space-y-6 bg-white scrollbar-none">
          
          {/* DESCRIÇÃO */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descrição</span>
              <button
                onClick={() => setIsDescExpanded(true)}
                className="transition-all p-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-bold shadow-sm cursor-pointer select-none text-gray-500 bg-white border-gray-200 hover:bg-gray-50"
                title="Expandir descrição em painel completo"
              >
                <Maximize2 size={13} className="text-gray-400" />
                <span>Expandir</span>
              </button>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 transition-colors focus-within:bg-white focus-within:border-gray-200 focus-within:shadow-xs h-[140px] overflow-y-auto">
              <BlockEditor
                blocks={task.blocks}
                onChange={blocks => updateBlocks(task.id, blocks)}
                placeholder="Escreva uma descrição... Selecione qualquer texto para ver opções flutuantes estilo Word."
              />
            </div>

            {isDescExpanded && (
              <div className="fixed inset-0 z-[60] flex flex-col bg-white animate-fade-in">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                  <h2 className="text-sm font-semibold text-gray-900">Descrição — {task.title}</h2>
                  <button onClick={() => setIsDescExpanded(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer">
                    <X size={16}/>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 md:px-16 py-8">
                  <div className="max-w-3xl mx-auto">
                    <BlockEditor
                      blocks={task.blocks}
                      onChange={blocks => updateBlocks(task.id, blocks)}
                      placeholder="Escreva uma descrição... Selecione qualquer texto para ver opções flutuantes estilo Word."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Botoes de acao rápida */}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleCreateChecklist} className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold text-xs rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-sm">
                <Plus size={12} /> Checklist
              </button>
              <button onClick={handleAISuggestChecklist} disabled={aiChecklistLoading} title="Sugerir itens de checklist com IA"
                className="w-7 h-7 flex items-center justify-center border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-brand-600 rounded-full transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-wait">
                {aiChecklistLoading ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>}
              </button>
              <button onClick={() => setAddingSubtask(true)} className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold text-xs rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-sm">
                <Plus size={12} /> Subtarefas
              </button>
              {task.projectId && (
                <button onClick={handleAISuggestSubtasks} disabled={aiSubtaskLoading} title="Sugerir subtarefas com IA"
                  className="w-7 h-7 flex items-center justify-center border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-brand-600 rounded-full transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-wait">
                  {aiSubtaskLoading ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>}
                </button>
              )}
            </div>
            {aiNotice && <p className="text-[10.5px] text-amber-600">{aiNotice}</p>}
          </div>

          {/* SUBTAREFAS (se ativas ou presentes) */}
          {(addingSubtask || subtasks.length > 0) && (
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <button onClick={() => setSubtasksSectionCollapsed(v => !v)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <ChevronDown size={11} className={`transition-transform ${subtasksSectionCollapsed ? '-rotate-90' : ''}`}/>
                  <GitBranch size={11} /> Subtarefas
                  {subtasks.length > 0 && <span className="ml-1">({subtasks.filter(s => s.status==='done').length}/{subtasks.length})</span>}
                </button>
                <div className="flex items-center gap-2">
                  {task.projectId && (
                    <button onClick={handleAISuggestSubtasks} disabled={aiSubtaskLoading} title="Sugerir subtarefas com IA"
                      className="text-gray-300 hover:text-brand-600 transition-colors disabled:opacity-50 disabled:cursor-wait">
                      {aiSubtaskLoading ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>}
                    </button>
                  )}
                  {subtasks.length > 0 && (
                    <button onClick={() => setSubtaskEditMode(v => !v)} title="Editar itens"
                      className={subtaskEditMode ? 'text-brand-600' : 'text-gray-300 hover:text-gray-500 transition-colors'}>
                      <Pencil size={12}/>
                    </button>
                  )}
                </div>
              </div>
              
              {!subtasksSectionCollapsed && (
                <>
                  {subtasks.length > 0 && (
                    <div className="space-y-1">
                      {subtasks.map(s => {
                        const sColor = s.status==='done' ? '#1D9E75' : s.status==='in_progress' ? '#378ADD' : '#888780'
                        const sPrio  = PRIORITY_OPTIONS.find(o => o.value===s.priority)
                        return (
                          <div key={s.id} onClick={() => setSelectedTask(s.id)}
                            className="w-full flex items-center justify-between text-left px-3 py-2 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 cursor-pointer group transition-all">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  updateTask(s.id, { status: s.status === 'done' ? 'todo' : 'done' })
                                }}
                                className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:scale-110 active:scale-95 focus:outline-none"
                                style={{ borderColor: sColor }}
                                title={s.status === 'done' ? 'Marcar como a fazer' : 'Marcar como concluído'}
                              >
                                {s.status==='done' && <span className="w-2 h-2 rounded-full" style={{ background: sColor }} />}
                              </button>
                              <span className={`text-sm truncate font-medium ${s.status==='done' ? 'line-through text-gray-400 font-normal' : 'text-gray-700'}`}>{s.title}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {sPrio && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                  style={{ background: sPrio.color+'15', color: sPrio.color }}>{sPrio.label}</span>
                              )}
                              {subtaskEditMode && (
                                <button onClick={e => { e.stopPropagation(); deleteTask(s.id) }} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {addingSubtask && task.projectId && (
                    <div className="pt-1">
                      <QuickAddRow projectId={task.projectId} status="todo" parentId={task.id} onDone={() => setAddingSubtask(false)} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* CHECKLISTS (se ativas ou presentes) */}
          {task.checklists.length > 0 && (
            <div className="pt-5 border-t border-gray-100/80 space-y-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setChecklistsSectionCollapsed(v => !v)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors select-none">
                  <ChevronDown size={11} className={`text-gray-400 transition-transform ${checklistsSectionCollapsed ? '-rotate-90' : ''}`} />
                  <ListChecks size={11} className="text-gray-400" /> Checklists ({task.checklists.length})
                </button>
                <button onClick={handleAISuggestChecklist} disabled={aiChecklistLoading}
                  className="p-1 text-gray-400 hover:text-brand-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                  title="Sugerir itens com IA"
                >
                  {aiChecklistLoading ? <Loader2 size={14} className="animate-spin"/> : <Wand2 size={14} />}
                </button>
                <button
                  onClick={handleCreateChecklist}
                  className="p-1 text-gray-400 hover:text-brand-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                  title="Criar novo Checklist"
                >
                  <Plus size={16} />
                </button>
              </div>

              {!checklistsSectionCollapsed && (
                <div className="space-y-4">
                  {task.checklists.map(cl => {
                    const done = cl.items.filter(i => i.done && i.text.trim() !== '').length
                    const total = cl.items.filter(i => i.text.trim() !== '' || editingItemId === i.id).length
                    const clCollapsed = !!checklistCollapsed[cl.id]
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0

                    return (
                      <div key={cl.id} className="border border-gray-100 rounded-xl p-4 bg-white/60 shadow-sm hover:shadow-md transition-all space-y-3">
                        {/* Checklist Header */}
                        <div className="flex items-center justify-between group/header">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {renamingChecklistId === cl.id ? (
                              <input
                                autoFocus
                                value={checklistRenameDraft}
                                onChange={e => setChecklistRenameDraft(e.target.value)}
                                onBlur={() => {
                                  renameChecklist(task.id, cl.id, checklistRenameDraft.trim() || cl.title)
                                  setRenamingChecklistId(null)
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    renameChecklist(task.id, cl.id, checklistRenameDraft.trim() || cl.title)
                                    setRenamingChecklistId(null)
                                  }
                                  if (e.key === 'Escape') setRenamingChecklistId(null)
                                }}
                                className="text-sm font-semibold text-gray-800 border-b-2 border-brand-500 outline-none bg-transparent py-0.5 px-1 max-w-[200px]"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <button
                                  onClick={() => setChecklistCollapsed(p => ({ ...p, [cl.id]: !p[cl.id] }))}
                                  className="p-1 rounded text-gray-400 hover:bg-gray-100 transition-colors"
                                >
                                  <ChevronDown size={14} className={`transition-transform duration-200 ${clCollapsed ? '-rotate-90' : ''}`} />
                                </button>
                                <span
                                  onDoubleClick={() => {
                                    setRenamingChecklistId(cl.id)
                                    setChecklistRenameDraft(cl.title)
                                  }}
                                  className="text-sm font-bold text-gray-800 truncate cursor-pointer hover:text-brand-600 transition-colors"
                                  title="Duplo-clique para renomear"
                                >
                                  {cl.title}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Checklist Header Actions */}
                          <div className="flex items-center gap-2">
                            {total > 0 && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">
                                {done}/{total}
                              </span>
                            )}
                            <button
                              onClick={() => handleAddNewItem(cl.id)}
                              className="p-1 rounded text-gray-400 hover:text-brand-600 hover:bg-gray-50 transition-colors"
                              title="Adicionar Item"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setRenamingChecklistId(cl.id)
                                setChecklistRenameDraft(cl.title)
                              }}
                              className="p-1 rounded text-gray-400 hover:text-brand-600 hover:bg-gray-50 transition-colors"
                              title="Renomear Checklist"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => removeChecklist(task.id, cl.id)}
                              className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Excluir Checklist"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {!clCollapsed && total > 0 && (
                          <div className="flex items-center gap-2.5 select-none">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tabnum transition-all
                              ${pct === 100 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' 
                                : 'text-slate-500 bg-slate-50 border border-slate-100'}`}>
                              {pct}%
                            </span>
                          </div>
                        )}

                        {/* Checklist Items */}
                        {!clCollapsed && (
                          <div className="space-y-1 pl-1">
                            {cl.items.map(item => {
                              const isEditing = editingItemId === item.id
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50/50 group/item transition-all"
                                >
                                  {/* Checkbox */}
                                  <button
                                    onClick={() => toggleChecklistItem(task.id, cl.id, item.id)}
                                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                                      item.done
                                        ? 'bg-brand-500 border-brand-500 text-white'
                                        : 'border-gray-300 hover:border-brand-500 bg-white shadow-sm'
                                    }`}
                                  >
                                    {item.done && (
                                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>

                                  {/* Item text or edit input */}
                                  {isEditing ? (
                                    <input
                                      autoFocus
                                      value={editingItemValue}
                                      onChange={e => setEditingItemValue(e.target.value)}
                                      onBlur={() => handleItemBlur(cl.id, item.id)}
                                      onKeyDown={e => handleItemKeyDown(e, cl.id, item.id)}
                                      placeholder="Nome do item..."
                                      className="flex-1 text-sm text-gray-700 outline-none bg-transparent border-b border-brand-400 py-0.5"
                                    />
                                  ) : (
                                    <span
                                      onClick={() => {
                                        setEditingItemId(item.id)
                                        setEditingItemValue(item.text)
                                        setEditingItemChecklistId(cl.id)
                                      }}
                                      className={`flex-1 text-sm cursor-pointer select-none transition-colors ${
                                        item.done
                                          ? 'line-through text-gray-400 font-normal'
                                          : 'text-gray-700 font-medium hover:text-brand-600'
                                      }`}
                                      title="Clique para editar"
                                    >
                                      {item.text || <span className="text-gray-300 italic text-xs">Novo item (clique para editar)</span>}
                                    </span>
                                  )}

                                  {/* Action button on hover */}
                                  {!isEditing && (
                                    <button
                                      onClick={() => removeChecklistItem(task.id, cl.id, item.id)}
                                      className="opacity-0 group-hover/item:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                                      title="Remover Item"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            {/* Quick add item trigger button */}
                            <button
                              onClick={() => handleAddNewItem(cl.id)}
                              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 px-2 py-1.5 rounded-lg hover:bg-brand-50/40 w-full text-left transition-all font-semibold mt-1"
                            >
                              <Plus size={12} /> Adicionar item
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ANEXOS */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setAnexosCollapsed(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors select-none">
                <ChevronDown size={11} className={`text-gray-400 transition-transform ${anexosCollapsed ? '-rotate-90' : ''}`} />
                <Paperclip size={11} /> Anexos {attachments.length > 0 && <span className="ml-0.5">({attachments.length})</span>}
              </button>
              
              <button onClick={() => setAnexosEditMode(v => !v)} title="Editar itens"
                className={`transition-colors ${anexosEditMode ? 'text-brand-600' : 'text-gray-300 hover:text-gray-500'}`}>
                <Pencil size={12}/>
              </button>
            </div>

            {!anexosCollapsed && (
              <div className="space-y-2">
                {attachments.map(b => {
                  const isPdfFile = b.mimeType === 'application/pdf' || (b.name ?? '').toLowerCase().endsWith('.pdf')
                  const isAudioFile = b.type === 'audio'
                  
                  let cardClass = "bg-gray-50 border border-gray-100 hover:bg-gray-100/50"
                  let iconColor = "text-gray-400"
                  if (isPdfFile) {
                    cardClass = "bg-[#f5f6ff] border border-[#e4e7ff]/60 hover:bg-[#ebeeff]/60"
                    iconColor = "text-[#4F46E5]"
                  } else if (isAudioFile) {
                    cardClass = "bg-[#fff2f4] border border-[#ffe4e8]/60 hover:bg-[#ffe2e7]/60"
                    iconColor = "text-[#E11D48]"
                  }

                  return (
                    <div key={b.id} className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${cardClass}`}>
                      <button onClick={() => openData(b.data, b.mimeType)} className="flex items-center gap-3 min-w-0 text-left flex-1">
                        <FileText size={16} className={`${iconColor} flex-shrink-0`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-700 truncate">{b.name || 'Arquivo'}</p>
                        </div>
                      </button>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {isAudioFile ? (
                          <span className="text-xs font-bold text-rose-400">0:42</span>
                        ) : b.size ? (
                          <span className="text-xs font-semibold text-gray-400">{humanSize(b.size)}</span>
                        ) : null}

                        {anexosEditMode && (
                          <button onClick={() => removeAttachment(b.id)} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                <div className="flex items-center gap-1.5 pt-1">
                  <button onClick={pickAttachment} className="px-2.5 py-1 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-500 font-medium text-[11px] rounded-full transition-colors flex items-center gap-1 cursor-pointer">
                    <Paperclip size={11} /> Adicionar anexo
                  </button>
                  <input ref={attachmentFileRef} type="file" multiple className="hidden" onChange={onAttachmentPicked} />

                  <button onClick={() => (recordingAttachment ? stopAttachmentRecording() : startAttachmentRecording())}
                    className={`px-2.5 py-1 border text-[11px] font-medium rounded-full transition-colors flex items-center gap-1 cursor-pointer ${recordingAttachment ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'}`}>
                    <Mic size={11} /> {recordingAttachment ? 'Parar gravação' : 'Gravar áudio'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* COMENTÁRIOS */}
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setCommentsSectionCollapsed(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">
                <ChevronDown size={11} className={`text-gray-400 transition-transform ${commentsSectionCollapsed ? '-rotate-90' : ''}`}/>
                <MessageCircle size={11} /> Comentários
                {task.comments.length > 0 && <span className="ml-1">({task.comments.length})</span>}
              </button>
              {task.comments.length > 0 && (
                <button onClick={() => setCommentEditMode(v => !v)} title="Editar itens"
                  className={`transition-colors ${commentEditMode ? 'text-brand-600' : 'text-gray-300 hover:text-gray-500'}`}>
                  <Pencil size={12}/>
                </button>
              )}
            </div>

            {!commentsSectionCollapsed && (
              <div className="space-y-4">
                {task.comments.length > 0 && (
                  <div className="space-y-4">
                    {task.comments.map(cm => (
                      <div key={cm.id} className="flex gap-3 group items-start">
                        <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarBg(cm.author)} text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm border border-white/10`}>
                          {cm.author.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0 bg-gray-50/40 border border-gray-100/80 rounded-xl px-4 py-3 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-700">{cm.author}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 font-semibold">{formatCommentTime(cm.createdAt)}</span>
                              {commentEditMode && (
                                <button onClick={() => removeComment(task.id, cm.id)}
                                  className="text-gray-300 hover:text-red-500 p-0.5 rounded transition-colors"><X size={11} /></button>
                              )}
                            </div>
                          </div>
                          {cm.text && <p className="text-sm text-gray-600 leading-relaxed mt-1 whitespace-pre-wrap">{cm.text}</p>}
                          {cm.attachment && (
                            <button onClick={() => openData(cm.attachment!.data, cm.attachment!.mimeType)}
                              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 transition-all border border-indigo-100/40 shadow-xs">
                              <FileText size={12} />{cm.attachment.name}
                            </button>
                          )}
                          {cm.audio && <audio src={cm.audio.data} controls className="mt-2 h-8 max-w-[240px] rounded-lg" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending attachments/audio inside comment section */}
                {(pendingCommentAttachment || pendingCommentAudio || recordingComment || micError) && (
                  <div className="ml-11 p-3 bg-gray-50 border border-gray-100/60 rounded-xl space-y-2 text-xs">
                    {micError && (
                      <div className="flex items-center justify-between text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-100">
                        <span>{micError}</span>
                        <button onClick={() => setMicError(null)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                      </div>
                    )}
                    {recordingComment && (
                      <div className="flex items-center justify-between bg-red-50 text-red-600 px-3 py-2 rounded-lg animate-pulse border border-red-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          <span className="font-bold">Gravando áudio do comentário...</span>
                        </div>
                        <button onClick={stopCommentRecording} className="bg-red-600 text-white font-bold text-[10px] px-2 py-1 rounded hover:bg-red-700 transition-colors uppercase tracking-wider">
                          Parar
                        </button>
                      </div>
                    )}
                    {pendingCommentAudio && (
                      <div className="flex items-center justify-between bg-rose-50/70 border border-rose-100/60 p-2 rounded-xl">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="p-1.5 bg-rose-100 text-rose-600 rounded-lg"><Mic size={14} /></span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-rose-700 truncate">Áudio Gravado</p>
                            <audio src={pendingCommentAudio.data} controls className="h-6 mt-1 max-w-full" />
                          </div>
                        </div>
                        <button onClick={() => setPendingCommentAudio(null)} className="text-rose-400 hover:text-rose-600 p-1" title="Remover áudio">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    {pendingCommentAttachment && (
                      <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100/60 p-2 rounded-xl">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><FileText size={14} /></span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-indigo-700 truncate">{pendingCommentAttachment.name}</p>
                            <p className="text-[10px] text-indigo-400 font-semibold uppercase">Anexo pronto para enviar</p>
                          </div>
                        </div>
                        <button onClick={() => setPendingCommentAttachment(null)} className="text-indigo-400 hover:text-indigo-600 p-1" title="Remover anexo">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Caixa de texto de comentário com novo fluxo de anexo e gravação */}
                <div className="flex items-center gap-3 pt-2">
                  <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarBg('DJ')} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm border border-white/10`}>
                    DJ
                  </span>
                  <div className="flex-1 relative flex items-center">
                    <input
                      value={commentDraft}
                      onChange={e => setCommentDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); postComment() } }}
                      placeholder="Escreva um comentário..."
                      className="w-full text-sm pl-4 pr-24 py-2.5 border border-gray-200 rounded-full outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 bg-white"
                    />
                    <div className="absolute right-3.5 flex items-center gap-2 text-gray-400">
                      <button onClick={pickCommentAttachment} className="hover:text-gray-600 transition-colors p-1" title="Anexar arquivo">
                        <Paperclip size={14} />
                      </button>
                      <input ref={commentFileRef} type="file" className="hidden" onChange={onCommentAttachPicked} />
                      
                      <button onClick={() => (recordingComment ? stopCommentRecording() : startCommentRecording())}
                        className={`transition-colors p-1 ${recordingComment ? 'text-red-500 animate-pulse' : 'hover:text-gray-600'}`} title="Gravar áudio">
                        {recordingComment ? <MicOff size={14} /> : <Mic size={14} />}
                      </button>

                      <button onClick={postComment} className="p-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-full transition-colors flex items-center justify-center cursor-pointer shadow-sm" title="Enviar">
                        <Send size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Coluna lateral de propriedades (Projeto, Status, Prioridade, Responsável, Prazo, Etiquetas) */}
        <aside className="w-full md:w-80 flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-100 bg-white p-6 space-y-5 md:overflow-y-auto scrollbar-none">
          <SideProp label="Projeto">
            {projectOptions.length > 0 ? (
              <Select value={task.projectId ?? ''} options={projectOptions} ariaLabel="Projeto" pill
                onChange={v => updateTask(task.id, { projectId: v })} />
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </SideProp>

          <SideProp label="Status">
            <Select value={task.status} options={STATUS_OPTIONS} ariaLabel="Status" variant="default"
              buttonClassName="w-full text-sm py-2 px-3 bg-white border border-gray-200/80 rounded-xl text-gray-700 font-semibold flex justify-between items-center"
              onChange={v => updateTask(task.id, { status: v as TaskStatus })}/>
          </SideProp>

          <SideProp label="Prioridade">
            <Select value={task.priority} options={priorityOptions} ariaLabel="Prioridade" variant="default"
              buttonClassName="w-full text-sm py-2 px-3 bg-white border border-gray-200/80 rounded-xl text-gray-700 font-semibold flex justify-between items-center"
              onChange={v => updateTask(task.id, { priority: v as Priority })}/>
          </SideProp>

          <SideProp label="Responsável">
            <AssigneePicker value={task.assignee} onChange={v => updateTask(task.id, { assignee: v })} variant="side"/>
          </SideProp>

          <SideProp label="Prazo">
            <DueDatePicker value={task.dueDate} onChange={v => updateTask(task.id, { dueDate: v })}
              overdue={!!task.dueDate && task.status!=='done' && new Date(task.dueDate) < new Date()} variant="side"/>
          </SideProp>

          {(() => { const prog = taskProgress(task, subtasks); return prog && (
            <SideProp label="Progresso">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${prog.pct}%` }}/>
                </div>
                <span className="text-[11px] text-gray-400 font-bold tabnum flex-shrink-0">{prog.done}/{prog.total}</span>
              </div>
            </SideProp>
          )})()}

          <SideProp label="Etiquetas">
            <TagInput value={task.tags} onChange={tags => updateTask(task.id, { tags })} />
          </SideProp>

          <TaskInsights task={task} />

          {/* Botão excluir integrado no rodapé da barra lateral de forma muito limpa */}
          <div className="pt-4 mt-6 border-t border-gray-100">
            <button onClick={() => { setSelectedTask(null); deleteTask(task.id) }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all border border-transparent hover:border-red-100">
              <Trash2 size={14} /> Excluir tarefa
            </button>
          </div>
        </aside>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex items-stretch justify-stretch bg-black/50 backdrop-blur-sm animate-overlay-in"
        onClick={() => setSelectedTask(null)}>
        <div className="flex flex-col flex-1 bg-white h-full overflow-hidden w-full" onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    )
  }

  if (activeMode === 'center') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-overlay-in"
        onClick={() => setSelectedTask(null)}>
        <div className={containerClass} style={containerStyle} onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    )
  }

  if (activeMode === 'full') {
    return (
      <div className="fixed inset-0 z-50 flex items-stretch justify-stretch bg-black/50 backdrop-blur-sm animate-overlay-in"
        onClick={() => setSelectedTask(null)}>
        <div className={containerClass} style={containerStyle} onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    )
  }

  return (
    <aside className={containerClass} style={containerStyle}>
      {content}
    </aside>
  )
}

// Linha de propriedade da coluna direita
function SideProp({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</div>
      {children}
    </div>
  )
}
