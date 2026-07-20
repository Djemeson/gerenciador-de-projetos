import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  X, ImagePlus, Mic, MicOff, Paperclip, FileText, Download, UploadCloud,
  Bold, Italic, Underline, Strikethrough, Highlighter, Image as ImageIcon, Eye, Type, ArrowUpFromLine,
  ExternalLink, ZoomIn, ZoomOut, Maximize2, Plus, ChevronDown, Pencil,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Minus,
} from 'lucide-react'
import type { ContentBlock } from '../../types'
import { nanoid } from '../../lib/nanoid'

interface BlockEditorProps {
  blocks: ContentBlock[]
  onChange: (blocks: ContentBlock[]) => void
  placeholder?: string
  onFocus?: () => void
  onBlur?: () => void
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

const isPdf = (b: ContentBlock) => b.mimeType === 'application/pdf' || (b.name ?? '').toLowerCase().endsWith('.pdf')

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function defaultDisplay(type: string): 'full' | 'title' {
  return type === 'image' ? 'full' : 'title'
}

// Abre uma dataURL em nova aba (via blob, mais robusto que abrir data: direto).
// Exportada para reuso fora do BlockEditor (ex.: anexos de comentário no TaskDetail).
export function openData(dataUrl?: string, mimeHint?: string) {
  if (!dataUrl) return
  try {
    const [head, b64] = dataUrl.split(',')
    const mime = mimeHint || head.match(/:(.*?);/)?.[1] || 'application/octet-stream'
    const bin = atob(b64)
    let n = bin.length
    const u8 = new Uint8Array(n)
    while (n--) u8[n] = bin.charCodeAt(n)
    const url = URL.createObjectURL(new Blob([u8], { type: mime }))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch { window.open(dataUrl, '_blank') }
}

// HTML inline de um bloco de mídia (usado ao inserir/migrar para o corpo).
function mediaToHtml(b: ContentBlock): string {
  if (b.type === 'image') return `<img src="${b.data}" alt="${esc(b.name)}">`
  if (b.type === 'audio') return `<audio src="${b.data}" controls contenteditable="false"></audio>`
  return `<a class="file-chip" href="${b.data}" data-name="${esc(b.name)}" data-mime="${esc(b.mimeType)}" contenteditable="false">📎 ${esc(b.name || 'Arquivo')}</a>`
}

export function BlockEditor({ blocks, onChange, placeholder = 'Adicione notas, contexto, links…', onFocus, onBlur }: BlockEditorProps) {
  const [recording, setRecording] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string; name?: string } | null>(null)
  const [anexosCollapsed, setAnexosCollapsed] = useState(false)
  const [attachEditMode, setAttachEditMode] = useState(false)
  const [toolbar, setToolbar] = useState<{ x: number; y: number } | null>(null)
  const [adjustedLeft, setAdjustedLeft] = useState<number>(0)
  const [plusTop, setPlusTop] = useState<number | null>(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const editorRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (!toolbar) return
    const el = toolbarRef.current
    const wrap = wrapRef.current
    if (!el || !wrap) return
    const tbWidth = el.getBoundingClientRect().width
    const wrapWidth = wrap.getBoundingClientRect().width
    
    const halfWidth = tbWidth / 2
    const minX = halfWidth + 8
    const maxX = wrapWidth - halfWidth - 8
    
    let x = toolbar.x
    if (maxX > minX) {
      x = Math.max(minX, Math.min(x, maxX))
    } else {
      x = wrapWidth / 2
    }
    setAdjustedLeft(x)
  }, [toolbar])

  // ── Blocos: corpo (texto rico único) + anexos ──
  const bodyTextIdx = blocks.findIndex(b => b.type === 'text' && (b.region ?? 'body') === 'body')
  const leadHtml = bodyTextIdx >= 0 ? (blocks[bodyTextIdx].text ?? '') : ''
  const attachments = blocks
    .map((b, idx) => ({ b, idx }))
    .filter(({ b }) => (b.region ?? 'body') === 'attachment')

  const setBodyHtml = (html: string) => {
    if (bodyTextIdx >= 0) onChange(blocks.map((b, i) => (i === bodyTextIdx ? { ...b, text: html } : b)))
    else onChange([{ id: nanoid(), type: 'text', text: html, region: 'body' }, ...blocks])
  }
  const updateAttach = (idx: number, patch: Partial<ContentBlock>) =>
    onChange(blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)))
  const removeBlock = (idx: number) => onChange(blocks.filter((_, i) => i !== idx))

  // ── Migração: dobra mídia solta do corpo (modelo antigo) para dentro do texto ──
  useEffect(() => {
    const hasLooseBodyMedia = blocks.some(b => (b.region ?? 'body') === 'body' && b.type !== 'text')
    if (!hasLooseBodyMedia) return
    let html = ''
    blocks.forEach(b => {
      if ((b.region ?? 'body') !== 'body') return
      if (b.type === 'text') html += b.text ?? ''
      else html += mediaToHtml(b)
    })
    const lead: ContentBlock = bodyTextIdx >= 0
      ? { ...blocks[bodyTextIdx], text: html }
      : { id: nanoid(), type: 'text', text: html, region: 'body' }
    onChange([lead, ...blocks.filter(b => (b.region ?? 'body') === 'attachment')])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks])

  // ── Sincroniza HTML externo → DOM só quando fora de foco (não salta o cursor) ──
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (document.activeElement !== el && el.innerHTML !== (leadHtml || '')) {
      el.innerHTML = leadHtml || ''
      el.setAttribute('data-empty', el.textContent?.trim() || el.querySelector('img,audio,hr,.file-chip') ? 'false' : 'true')
    }
  }, [leadHtml])

  const flush = () => {
    const el = editorRef.current
    if (!el) return
    el.setAttribute('data-empty', el.textContent?.trim() || el.querySelector('img,audio,hr,.file-chip') ? 'false' : 'true')
    setBodyHtml(el.innerHTML)
  }

  // ── Atalhos estilo Markdown (como Notion/TickTick): "- "/"* " → lista, "1. " → lista
  // numerada, "#"/"##"/"###" + espaço → título, "> " → citação, "---" → linha horizontal.
  // Detecta o texto do bloco da linha atual a cada tecla; se bater um gatilho, apaga o
  // texto-gatilho e aplica o formatBlock/lista correspondente. Retorna true se tratou.
  const AUTOFORMAT_TRIGGERS: [RegExp, () => void][] = [
    [/^[-*]\s$/, () => document.execCommand('insertUnorderedList')],
    [/^1\.\s$/,  () => document.execCommand('insertOrderedList')],
    [/^###\s$/,  () => document.execCommand('formatBlock', false, 'H3')],
    [/^##\s$/,   () => document.execCommand('formatBlock', false, 'H2')],
    [/^#\s$/,    () => document.execCommand('formatBlock', false, 'H1')],
    [/^>\s$/,    () => document.execCommand('formatBlock', false, 'BLOCKQUOTE')],
    [/^---$/,    () => document.execCommand('insertHorizontalRule')],
  ]
  const autoformat = (): boolean => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0 || !sel.isCollapsed) return false
    const range = sel.getRangeAt(0)
    if (!el.contains(range.startContainer)) return false

    let block: Node | null = range.startContainer
    let blockEl: HTMLElement = block.nodeType === 1 ? block as HTMLElement : (block.parentElement ?? el)
    while (blockEl.parentElement !== el && blockEl !== el) blockEl = blockEl.parentElement as HTMLElement

    const text = blockEl.textContent || ''
    for (const [re, apply] of AUTOFORMAT_TRIGGERS) {
      if (!re.test(text)) continue
      const r = document.createRange()
      r.selectNodeContents(blockEl)
      r.setEnd(range.startContainer, range.startOffset)
      sel.removeAllRanges(); sel.addRange(r)
      document.execCommand('delete')
      apply()
      flush()
      return true
    }
    return false
  }
  const onEditorInput = () => { if (!autoformat()) flush() }

  // ── Seleção: barra flutuante (bold/itálico) + posição do "+" + range salvo ──
  useEffect(() => {
    const handler = () => {
      const el = editorRef.current, wrap = wrapRef.current
      const sel = window.getSelection()
      if (!el || !wrap || !sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      if (!el.contains(range.commonAncestorContainer)) return
      savedRange.current = range.cloneRange()

      // barra bold/itálico
      if (!sel.isCollapsed) {
        const r = range.getBoundingClientRect(), w = wrap.getBoundingClientRect()
        setToolbar({ x: r.left - w.left + r.width / 2, y: r.top - w.top })
      } else setToolbar(null)

      // posição do "+" na linha atual
      let node: Node | null = range.startContainer
      let block: HTMLElement | null = node.nodeType === 1 ? node as HTMLElement : node.parentElement
      while (block && block.parentElement !== el && block !== el) block = block.parentElement
      if (block && block !== el) {
        const b = block.getBoundingClientRect(), w = wrap.getBoundingClientRect()
        setPlusTop(b.top - w.top)
      } else setPlusTop(0)
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  const restoreSelection = () => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel) return
    if (savedRange.current && el.contains(savedRange.current.commonAncestorContainer)) {
      sel.removeAllRanges(); sel.addRange(savedRange.current)
    } else {
      const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
      sel.removeAllRanges(); sel.addRange(r)
    }
  }

  const exec = (cmd: string, val?: string) => { restoreSelection(); document.execCommand(cmd, false, val); flush() }
  const insertInline = (html: string) => { restoreSelection(); document.execCommand('insertHTML', false, html); flush() }
  const format = (cmd: 'bold' | 'italic') => { document.execCommand(cmd); flush() }

  // ── Inserir mídia no corpo ──
  const insertFileInline = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => insertInline(mediaToHtml({ id: '', type: blockTypeForFile(file), data: reader.result as string, name: file.name, mimeType: file.type }))
    reader.readAsDataURL(file)
  }

  // ── Adicionar como anexo (seção separada) ──
  const addAttachment = (file: File) => {
    const type = blockTypeForFile(file)
    const reader = new FileReader()
    reader.onload = () => onChange([...blocks, {
      id: nanoid(), type, data: reader.result as string, name: file.name,
      mimeType: file.type, size: file.size, region: 'attachment', display: defaultDisplay(type),
    }])
    reader.readAsDataURL(file)
  }

  // ── Arrastar-soltar / colar → imagens inline; outros → anexos ──
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    Array.from(e.dataTransfer.files || []).forEach(f => f.type.startsWith('image/') ? insertFileInline(f) : addAttachment(f))
  }
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); setDragOver(true) }
  }
  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'))
    if (imgs.length) { e.preventDefault(); imgs.forEach(insertFileInline) }
  }

  // ── Cliques dentro do editor (checkbox / imagem / chip de arquivo) ──
  const onEditorClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    const box = t.closest('.todo-box')
    if (box) {
      const item = box.closest('.todo-item') as HTMLElement | null
      if (item) { item.setAttribute('data-checked', item.getAttribute('data-checked') === 'true' ? 'false' : 'true'); flush() }
      return
    }
    const chip = t.closest('.file-chip') as HTMLAnchorElement | null
    if (chip) { e.preventDefault(); openData(chip.getAttribute('href') || '', chip.getAttribute('data-mime') || undefined); return }
    if (t.tagName === 'IMG') { setLightbox({ src: (t as HTMLImageElement).src, name: t.getAttribute('alt') || '' }); return }
  }

  // ── Áudio ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => insertInline(`<audio src="${reader.result}" controls contenteditable="false"></audio>`)
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start(); mediaRef.current = mr; setRecording(true)
    } catch { alert('Permissão de microfone negada.') }
  }
  const stopRecording = () => { mediaRef.current?.stop(); setRecording(false) }

  // ── Menu "+" (estilo TickTick) ──
  const menuItems: { icon: React.ReactNode; label: string; run: () => void }[] = [
    { icon: <Heading1 size={15} />, label: 'Título 1', run: () => exec('formatBlock', 'H1') },
    { icon: <Heading2 size={15} />, label: 'Título 2', run: () => exec('formatBlock', 'H2') },
    { icon: <Heading3 size={15} />, label: 'Título 3', run: () => exec('formatBlock', 'H3') },
    { icon: <List size={15} />, label: 'Lista com marcadores', run: () => exec('insertUnorderedList') },
    { icon: <ListOrdered size={15} />, label: 'Lista numerada', run: () => exec('insertOrderedList') },
    {
      icon: <CheckSquare size={15} />, label: 'Item de verificação', run: () => {
        const id = 'tt' + nanoid()
        insertInline(`<div class="todo-item" data-checked="false"><span class="todo-box" contenteditable="false"></span><span class="todo-text" id="${id}">​</span></div>`)
        const span = document.getElementById(id)
        if (span) {
          span.removeAttribute('id')
          const sel = window.getSelection(); const r = document.createRange()
          r.selectNodeContents(span); r.collapse(false)
          sel?.removeAllRanges(); sel?.addRange(r)
        }
      },
    },
    { icon: <Quote size={15} />, label: 'Citação', run: () => exec('formatBlock', 'BLOCKQUOTE') },
    { icon: <Minus size={15} />, label: 'Linha horizontal', run: () => exec('insertHorizontalRule') },
    { icon: <ImageIcon size={15} />, label: 'Imagem', run: () => imgInputRef.current?.click() },
    { icon: <Paperclip size={15} />, label: 'Anexo', run: () => fileInputRef.current?.click() },
  ]
  const runItem = (run: () => void) => { setMenuOpen(false); run() }

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => {
      const wrap = wrapRef.current
      if (wrap && !(e.target as HTMLElement).closest('[data-plusmenu]')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`relative rounded-xl transition-colors ${dragOver ? 'bg-brand-50 ring-2 ring-brand-300 ring-inset' : ''}`}
    >
      {/* Área do editor (com espaço à esquerda para o "+") */}
      <div ref={wrapRef} className="relative pl-7">
        {/* Barra flutuante de formatação (estilo Word) */}
        {toolbar && (
          <div
            ref={toolbarRef}
            className="absolute z-30 flex items-center gap-1 bg-[#1e293b] text-white rounded-xl shadow-xl px-2 py-1 animate-scale-in border border-[#334155]"
            style={{ left: adjustedLeft || toolbar.x, top: toolbar.y - 48, transform: 'translateX(-50%)' }}
            onMouseDown={e => e.preventDefault()}
          >
            <button onClick={() => exec('bold')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white" title="Negrito (Ctrl+B)">
              <Bold size={13} />
            </button>
            <button onClick={() => exec('italic')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white" title="Itálico (Ctrl+I)">
              <Italic size={13} />
            </button>
            <button onClick={() => exec('underline')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white" title="Sublinhado (Ctrl+U)">
              <Underline size={13} />
            </button>
            <button onClick={() => exec('strikeThrough')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white" title="Tachado">
              <Strikethrough size={13} />
            </button>
            
            <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

            <button onClick={() => exec('formatBlock', 'H1')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white font-bold" title="Título 1">
              <Heading1 size={13} />
            </button>
            <button onClick={() => exec('formatBlock', 'H2')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white font-bold" title="Título 2">
              <Heading2 size={13} />
            </button>
            <button onClick={() => exec('formatBlock', 'P')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white" title="Texto Normal">
              <Type size={13} />
            </button>

            <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

            <button onClick={() => exec('insertUnorderedList')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white" title="Marcadores">
              <List size={13} />
            </button>
            <button onClick={() => exec('insertOrderedList')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white" title="Lista Numerada">
              <ListOrdered size={13} />
            </button>
            <button onClick={() => exec('formatBlock', 'BLOCKQUOTE')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white" title="Citação">
              <Quote size={13} />
            </button>

            <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

            <button onClick={() => exec('backColor', '#FEF08A')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-yellow-300" title="Destacar (Amarelo)">
              <Highlighter size={13} />
            </button>
            <button onClick={() => exec('removeFormat')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-gray-400 hover:text-white" title="Limpar Formatação">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Botão "+" na linha atual */}
        {plusTop != null && (
          <div className="absolute left-0 z-20" style={{ top: plusTop - 1 }} data-plusmenu onMouseDown={e => e.preventDefault()}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-brand-600 hover:bg-gray-100 transition-colors"
              title="Inserir…"
            ><Plus size={15} /></button>

            {menuOpen && (
              <div className="absolute left-0 top-6 z-40 w-56 bg-white rounded-xl shadow-2xl border border-gray-200/70 py-1 animate-scale-in max-h-72 overflow-y-auto">
                {menuItems.map(it => (
                  <button
                    key={it.label}
                    onClick={() => runItem(it.run)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="text-gray-400">{it.icon}</span>{it.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Editor rico único (texto + mídia inline, estilo TickTick) */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          data-placeholder={placeholder}
          data-empty={leadHtml ? 'false' : 'true'}
          onInput={onEditorInput}
          onPaste={onPaste}
          onClick={onEditorClick}
          onFocus={onFocus}
          onBlur={onBlur}
          className="rich-text w-full text-sm text-gray-700 leading-relaxed min-h-[3rem] py-1"
        />

        {/* Inputs ocultos do menu "+" */}
        <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { Array.from(e.target.files || []).forEach(insertFileInline); e.target.value = '' }} />
        <input ref={fileInputRef} type="file" multiple className="hidden"
          onChange={e => { Array.from(e.target.files || []).forEach(addAttachment); e.target.value = '' }} />
      </div>

      {/* Overlay ao arrastar */}
      {dragOver && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none bg-brand-50/70">
          <div className="flex items-center gap-2 text-brand-600 text-xs font-medium">
            <UploadCloud size={16} /> Solte para anexar
          </div>
        </div>
      )}

      {lightbox && <Lightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />}
    </div>
  )
}

// ── Linha de anexo (seção separada) ────────────────────────────────────────
function AttachmentRow({ b, editMode, onRename, onToggleDisplay, onExpand, onOpen, onInsert, onRemove }: {
  b: ContentBlock
  editMode: boolean
  onRename: (name: string) => void
  onToggleDisplay: () => void
  onExpand: () => void
  onOpen: () => void
  onInsert: () => void
  onRemove: () => void
}) {
  const ctrl = (onClick: () => void, title: string, node: React.ReactNode, danger = false) => (
    <button onClick={onClick} title={title}
      className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${danger ? 'text-gray-300 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-brand-600 hover:bg-gray-100'}`}>
      {node}
    </button>
  )
  const titleField = (
    <input value={b.name ?? ''} onChange={e => onRename(e.target.value)} placeholder="Título…"
      className="min-w-0 flex-1 bg-transparent outline-none truncate text-[12px] text-gray-700 font-medium focus:text-gray-900" />
  )
  const controls = (
    <div className={`flex items-center gap-0.5 transition-opacity flex-shrink-0 ${editMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
      {b.type === 'image' && ctrl(onToggleDisplay, (b.display ?? 'full') === 'full' ? 'Mostrar só o título' : 'Mostrar a imagem', (b.display ?? 'full') === 'full' ? <Type size={12} /> : <Eye size={12} />)}
      {b.type === 'image' && (b.display ?? 'full') === 'full' && ctrl(onExpand, 'Expandir', <Maximize2 size={12} />)}
      {b.type === 'file' && ctrl(onOpen, 'Abrir', <ExternalLink size={12} />)}
      {ctrl(onInsert, 'Inserir no texto', <ArrowUpFromLine size={12} />)}
      {(b.type === 'file' || b.type === 'image') && b.data && (
        <a href={b.data} download={b.name} title="Baixar"
          className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-gray-100 transition-colors"><Download size={12} /></a>
      )}
      {editMode && ctrl(onRemove, 'Remover', <X size={12} />, true)}
    </div>
  )

  if (b.type === 'image' && (b.display ?? 'full') === 'full') {
    return (
      <div className="group relative">
        <div className="flex items-center gap-1.5 mb-1">
          <ImageIcon size={12} className="text-gray-400 flex-shrink-0" />{titleField}{controls}
        </div>
        <div className="relative rounded-lg overflow-hidden border border-gray-100 inline-block max-w-full cursor-zoom-in" onClick={onExpand}>
          <img src={b.data} alt={b.name} className="max-h-64 max-w-full object-contain" />
        </div>
      </div>
    )
  }
  if (b.type === 'audio') {
    return (
      <div className="group flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
        <Mic size={13} className="text-brand-500 flex-shrink-0" />{titleField}
        <audio src={b.data} controls style={{ height: 26 }} className="flex-shrink-0 max-w-[160px]" />{controls}
      </div>
    )
  }
  return (
    <div className="group flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-100">
      <button onClick={() => (b.type === 'file' ? onOpen() : onExpand())} title={b.type === 'file' ? 'Abrir' : 'Ver imagem'} className="flex-shrink-0">
        {b.type === 'image'
          ? <ImageIcon size={15} className="text-gray-400 hover:text-brand-600 transition-colors" />
          : <FileText size={15} className={isPdf(b) ? 'text-red-400' : 'text-gray-400 hover:text-brand-600 transition-colors'} />}
      </button>
      <div className="min-w-0 flex-1">
        {titleField}
        {b.size != null && <p className="text-[10px] text-gray-400 mt-0.5">{humanSize(b.size)}{isPdf(b) ? ' · PDF' : ''}</p>}
      </div>
      {controls}
    </div>
  )
}

// ── Lightbox: expande a imagem, traz para frente, zoom in/out ──────────────
function Lightbox({ src, name, onClose }: { src: string; name?: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.25, 5))
      if (e.key === '-') setScale(s => Math.max(s - 0.25, 0.25))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center animate-overlay-in"
      onClick={onClose}
      onWheel={e => setScale(s => Math.min(Math.max(s + (e.deltaY < 0 ? 0.15 : -0.15), 0.25), 5))}
    >
      <div className="absolute top-4 right-4 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <button onClick={() => setScale(s => Math.max(s - 0.25, 0.25))} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" title="Diminuir (-)"><ZoomOut size={18} /></button>
        <span className="text-white/80 text-xs tabnum w-12 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(s + 0.25, 5))} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" title="Aumentar (+)"><ZoomIn size={18} /></button>
        <button onClick={() => setScale(1)} className="px-2.5 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center" title="Tamanho original">1:1</button>
        <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center ml-1" title="Fechar (Esc)"><X size={18} /></button>
      </div>
      {name && <div className="absolute top-5 left-5 text-white/70 text-sm max-w-[50%] truncate">{name}</div>}
      <img
        src={src} alt={name}
        onClick={e => e.stopPropagation()}
        style={{ transform: `scale(${scale})`, transition: 'transform 0.1s ease-out' }}
        className="max-h-[88vh] max-w-[88vw] object-contain select-none cursor-grab" draggable={false}
      />
    </div>
  )
}
