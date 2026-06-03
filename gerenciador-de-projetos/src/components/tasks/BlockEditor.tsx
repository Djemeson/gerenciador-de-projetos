import React, { useRef, useState } from 'react'
import { X, Image, Mic, MicOff, Type, Plus } from 'lucide-react'
import type { ContentBlock } from '../../types'
import { nanoid } from '../../lib/nanoid'

interface BlockEditorProps {
  blocks: ContentBlock[]
  onChange: (blocks: ContentBlock[]) => void
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [recording, setRecording]     = useState(false)
  const [insertAt,  setInsertAt]      = useState<number | null>(null)  // índice após o qual inserir
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const update = (idx: number, text: string) => {
    const next = blocks.map((b, i) => i === idx ? { ...b, text } : b)
    onChange(next)
  }

  const remove = (idx: number) => onChange(blocks.filter((_, i) => i !== idx))

  const insertBlock = (block: ContentBlock, afterIdx: number) => {
    const next = [...blocks]
    next.splice(afterIdx + 1, 0, block)
    onChange(next)
    setInsertAt(null)
  }

  const addText = (afterIdx: number) =>
    insertBlock({ id: nanoid(), type: 'text', text: '' }, afterIdx)

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>, afterIdx: number) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => insertBlock({ id: nanoid(), type: 'image', data: reader.result as string, name: file.name, mimeType: file.type }, afterIdx)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const startRecording = async (afterIdx: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => insertBlock({ id: nanoid(), type: 'audio', data: reader.result as string, name: `Áudio ${new Date().toLocaleTimeString('pt-BR')}`, mimeType: 'audio/webm' }, afterIdx)
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start(); mediaRef.current = mr; setRecording(true)
    } catch { alert('Permissão de microfone negada.') }
  }

  const stopRecording = () => { mediaRef.current?.stop(); setRecording(false) }

  // Se não há blocos, começa com um bloco de texto vazio
  const allBlocks = blocks.length === 0 ? [{ id: '_init', type: 'text' as const, text: '' }] : blocks

  return (
    <div className="space-y-0.5">
      {allBlocks.map((block, idx) => (
        <div key={block.id} className="group relative">
          {/* ── Bloco de texto ── */}
          {block.type === 'text' && (
            <div className="relative">
              <textarea
                value={block.text ?? ''}
                onChange={e => {
                  // auto-resize
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                  // se bloco inicial fake, cria bloco real
                  if (block.id === '_init') {
                    onChange([{ id: nanoid(), type: 'text', text: e.target.value }])
                  } else {
                    update(idx, e.target.value)
                  }
                }}
                placeholder={idx === 0 ? 'Adicione notas, contexto, links...' : 'Texto...'}
                rows={1}
                className="w-full text-xs text-gray-700 resize-none outline-none bg-transparent placeholder:text-gray-300 leading-relaxed overflow-hidden"
                style={{ minHeight: '1.5rem' }}
              />
              {block.id !== '_init' && (
                <button onClick={() => remove(idx)} className="opacity-0 group-hover:opacity-100 absolute right-0 top-0 text-gray-300 hover:text-red-400 transition-all">
                  <X size={11} />
                </button>
              )}
            </div>
          )}

          {/* ── Bloco de imagem ── */}
          {block.type === 'image' && (
            <div className="relative rounded-lg overflow-hidden border border-gray-100">
              <img src={block.data} alt={block.name} className="w-full max-h-48 object-cover" />
              <button onClick={() => remove(idx)} className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center transition-opacity">
                <X size={10} />
              </button>
            </div>
          )}

          {/* ── Bloco de áudio ── */}
          {block.type === 'audio' && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100 group">
              <Mic size={11} className="text-brand-500 flex-shrink-0" />
              <span className="text-[10px] text-gray-500 truncate flex-1">{block.name}</span>
              <audio src={block.data} controls style={{ height: 24 }} className="flex-shrink-0 max-w-[140px]" />
              <button onClick={() => remove(idx)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                <X size={11} />
              </button>
            </div>
          )}

          {/* ── Inserir entre blocos ── */}
          {block.id !== '_init' && (
            <div className="h-5 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              {insertAt === idx ? (
                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
                  <button onClick={() => addText(idx)} className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-brand-600 transition-colors">
                    <Type size={10} /> Texto
                  </button>
                  <span className="text-gray-200">|</span>
                  <label className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-brand-600 cursor-pointer transition-colors">
                    <Image size={10} /> Imagem
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImage(e, idx)} />
                  </label>
                  <span className="text-gray-200">|</span>
                  <button onClick={() => { if (recording) stopRecording(); else startRecording(idx) }}
                    className={`flex items-center gap-1 text-[10px] transition-colors ${recording ? 'text-red-500' : 'text-gray-600 hover:text-brand-600'}`}>
                    {recording ? <MicOff size={10} /> : <Mic size={10} />}
                    {recording ? 'Parar' : 'Áudio'}
                  </button>
                  <button onClick={() => setInsertAt(null)} className="text-gray-300 hover:text-gray-500 ml-1"><X size={10} /></button>
                </div>
              ) : (
                <button onClick={() => setInsertAt(idx)}
                  className="flex items-center gap-0.5 text-[10px] text-gray-300 hover:text-brand-500 transition-colors">
                  <Plus size={10} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* ── Toolbar no final ── */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-1">
        <button onClick={() => addText(allBlocks.length - 1)}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-600 transition-colors px-1.5 py-0.5 rounded hover:bg-brand-50">
          <Type size={10} /> Texto
        </button>
        <label className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-600 cursor-pointer transition-colors px-1.5 py-0.5 rounded hover:bg-brand-50">
          <Image size={10} /> Imagem
          <input type="file" accept="image/*" className="hidden" onChange={e => handleImage(e, allBlocks.length - 1)} />
        </label>
        <button
          onClick={() => { if (recording) stopRecording(); else startRecording(allBlocks.length - 1) }}
          className={`flex items-center gap-1 text-[10px] transition-colors px-1.5 py-0.5 rounded
            ${recording ? 'text-red-500 bg-red-50 animate-pulse' : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50'}`}>
          {recording ? <MicOff size={10} /> : <Mic size={10} />}
          {recording ? 'Parar gravação' : 'Áudio'}
        </button>
      </div>
    </div>
  )
}
