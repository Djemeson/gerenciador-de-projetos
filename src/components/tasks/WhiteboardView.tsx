import React, { useEffect, useRef, useState } from 'react'
import {
  MousePointer2, Pencil, Square, Diamond, Circle, ArrowRight, Type,
  Trash2, ZoomIn, ZoomOut, RotateCcw,
} from 'lucide-react'
import {
  loadWhiteboard, saveWhiteboard, WHITEBOARD_COLORS, CANVAS_W, CANVAS_H,
  type WhiteboardElement, type WhiteboardTool, type WhiteboardPoint,
} from '../../lib/whiteboard'
import { nanoid } from '../../lib/nanoid'

const TOOLS: { key: WhiteboardTool; label: string; Icon: React.ElementType }[] = [
  { key:'select',    label:'Selecionar',        Icon: MousePointer2 },
  { key:'pen',       label:'Caneta livre',      Icon: Pencil },
  { key:'rectangle', label:'Retângulo (Atividade)', Icon: Square },
  { key:'diamond',   label:'Losango (Decisão)', Icon: Diamond },
  { key:'ellipse',   label:'Elipse (Início/Fim)', Icon: Circle },
  { key:'arrow',     label:'Seta (Fluxo)',      Icon: ArrowRight },
  { key:'text',      label:'Texto',             Icon: Type },
]

const MIN_SIZE = 4
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function pointsToPath(points: WhiteboardPoint[]): string {
  if (points.length === 0) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

function box(x1: number, y1: number, x2: number, y2: number) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}

export interface WhiteboardViewProps { scopeKey: string }

export function WhiteboardView({ scopeKey }: WhiteboardViewProps) {
  const [elements, setElements] = useState<WhiteboardElement[]>(() => loadWhiteboard(scopeKey))
  const [tool,     setTool]     = useState<WhiteboardTool>('select')
  const [color,    setColor]    = useState(WHITEBOARD_COLORS[0])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft,    setDraft]    = useState<WhiteboardElement | null>(null)
  const [zoom,     setZoom]     = useState(1)
  const [confirmClear, setConfirmClear] = useState(false)
  const [editingText, setEditingText] = useState<{ id: string; x: number; y: number; value: string } | null>(null)

  const svgRef    = useRef<SVGSVGElement>(null)
  const drawing   = useRef(false)
  const shapeStart= useRef<WhiteboardPoint>({ x: 0, y: 0 })
  const dragRef   = useRef<{ id: string; startX: number; startY: number; orig: WhiteboardElement } | null>(null)

  // Recarrega ao trocar de escopo (ex.: navegar entre projetos)
  useEffect(() => {
    setElements(loadWhiteboard(scopeKey))
    setSelectedId(null); setDraft(null); setEditingText(null)
  }, [scopeKey])

  // Salva com pequeno debounce
  useEffect(() => {
    const t = setTimeout(() => saveWhiteboard(scopeKey, elements), 300)
    return () => clearTimeout(t)
  }, [scopeKey, elements])

  // Excluir com tecla Delete/Backspace (fora de campos de texto)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        setElements(p => p.filter(x => x.id !== selectedId))
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId])

  const toCanvasPoint = (clientX: number, clientY: number): WhiteboardPoint => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) * (CANVAS_W / rect.width), y: (clientY - rect.top) * (CANVAS_H / rect.height) }
  }

  const commitText = () => {
    if (!editingText) return
    const value = editingText.value.trim()
    setElements(p => {
      if (!value) return p.filter(e => e.id !== editingText.id)
      return p.map(e => e.id === editingText.id ? { ...e, text: value } : e)
    })
    setEditingText(null)
  }

  // ── Pointer handlers (fundo do quadro) ─────────────────────────────────────
  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (editingText) commitText()
    if (tool === 'select') { setSelectedId(null); return }
    const pt = toCanvasPoint(e.clientX, e.clientY)
    drawing.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)

    if (tool === 'pen') {
      setDraft({ id: 'draft', type:'pen', color, points:[pt] })
    } else if (tool === 'text') {
      const id = nanoid()
      setElements(p => [...p, { id, type:'text', color, x: pt.x, y: pt.y, text:'' }])
      setEditingText({ id, x: e.clientX, y: e.clientY, value: '' })
      drawing.current = false
    } else if (tool === 'arrow') {
      setDraft({ id:'draft', type:'arrow', color, x1:pt.x, y1:pt.y, x2:pt.x, y2:pt.y })
    } else {
      shapeStart.current = pt
      setDraft({ id:'draft', type: tool, color, x: pt.x, y: pt.y, w: 0, h: 0 })
    }
  }

  const onBackgroundPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current || !draft) return
    const pt = toCanvasPoint(e.clientX, e.clientY)
    if (draft.type === 'pen') {
      setDraft(d => d ? { ...d, points: [...(d.points ?? []), pt] } : d)
    } else if (draft.type === 'arrow') {
      setDraft(d => d ? { ...d, x2: pt.x, y2: pt.y } : d)
    } else {
      const { x: sx, y: sy } = shapeStart.current
      const b = box(sx, sy, pt.x, pt.y)
      setDraft(d => d ? { ...d, ...b } : d)
    }
  }

  const onBackgroundPointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    if (!draft) return
    let toAdd: WhiteboardElement | null = null
    if (draft.type === 'pen') {
      if ((draft.points?.length ?? 0) > 1) toAdd = { ...draft, id: nanoid() }
    } else if (draft.type === 'arrow') {
      const len = Math.hypot((draft.x2 ?? 0) - (draft.x1 ?? 0), (draft.y2 ?? 0) - (draft.y1 ?? 0))
      if (len > MIN_SIZE) toAdd = { ...draft, id: nanoid() }
    } else if ((draft.w ?? 0) > MIN_SIZE && (draft.h ?? 0) > MIN_SIZE) {
      toAdd = { ...draft, id: nanoid() }
    }
    if (toAdd) setElements(p => [...p, toAdd as WhiteboardElement])
    setDraft(null)
  }

  // ── Seleção / arraste de um elemento existente ─────────────────────────────
  const onElementPointerDown = (e: React.PointerEvent, el: WhiteboardElement) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setSelectedId(el.id)
    const pt = toCanvasPoint(e.clientX, e.clientY)
    dragRef.current = { id: el.id, startX: pt.x, startY: pt.y, orig: el }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onElementPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const pt = toCanvasPoint(e.clientX, e.clientY)
    const dx = pt.x - dragRef.current.startX, dy = pt.y - dragRef.current.startY
    const orig = dragRef.current.orig
    setElements(p => p.map(el => {
      if (el.id !== dragRef.current!.id) return el
      if (el.type === 'pen') return { ...el, points: (orig.points ?? []).map(pp => ({ x: pp.x+dx, y: pp.y+dy })) }
      if (el.type === 'arrow') return { ...el, x1: orig.x1!+dx, y1: orig.y1!+dy, x2: orig.x2!+dx, y2: orig.y2!+dy }
      return { ...el, x: orig.x!+dx, y: orig.y!+dy }
    }))
  }
  const onElementPointerUp = () => { dragRef.current = null }

  const recolorSelected = (c: string) => {
    if (!selectedId) return
    setElements(p => p.map(el => el.id===selectedId ? { ...el, color:c } : el))
  }
  const deleteSelected = () => {
    if (!selectedId) return
    setElements(p => p.filter(el => el.id !== selectedId))
    setSelectedId(null)
  }
  const clearAll = () => {
    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return }
    setElements([]); setSelectedId(null); setConfirmClear(false)
  }

  const zoomIn  = () => setZoom(z => ZOOM_STEPS[Math.min(ZOOM_STEPS.length-1, ZOOM_STEPS.indexOf(z)+1)] ?? z)
  const zoomOut = () => setZoom(z => ZOOM_STEPS[Math.max(0, ZOOM_STEPS.indexOf(z)-1)] ?? z)

  const renderElement = (el: WhiteboardElement, isDraft = false) => {
    const common = { onPointerDown: isDraft ? undefined : (e: React.PointerEvent) => onElementPointerDown(e, el) }
    const selected = !isDraft && selectedId === el.id
    const selStroke = selected ? { strokeDasharray: '5 3' } : {}
    if (el.type === 'pen') {
      return <path {...common} d={pointsToPath(el.points ?? [])} fill="none" stroke={el.color} strokeWidth={2.5}
        strokeLinecap="round" strokeLinejoin="round" style={{ cursor: tool==='select' ? 'grab' : undefined }}/>
    }
    if (el.type === 'rectangle') {
      return <rect {...common} x={el.x} y={el.y} width={el.w} height={el.h} rx={8} fill={el.color+'12'} stroke={el.color} strokeWidth={2} {...selStroke}
        style={{ cursor: tool==='select' ? 'grab' : undefined }}/>
    }
    if (el.type === 'diamond') {
      const x=el.x!, y=el.y!, w=el.w!, h=el.h!
      const pts = `${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`
      return <polygon {...common} points={pts} fill={el.color+'12'} stroke={el.color} strokeWidth={2} {...selStroke}
        style={{ cursor: tool==='select' ? 'grab' : undefined }}/>
    }
    if (el.type === 'ellipse') {
      const x=el.x!, y=el.y!, w=el.w!, h=el.h!
      return <ellipse {...common} cx={x+w/2} cy={y+h/2} rx={w/2} ry={h/2} fill={el.color+'12'} stroke={el.color} strokeWidth={2} {...selStroke}
        style={{ cursor: tool==='select' ? 'grab' : undefined }}/>
    }
    if (el.type === 'arrow') {
      const idx = WHITEBOARD_COLORS.indexOf(el.color)
      return <line {...common} x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={el.color} strokeWidth={2.5}
        strokeLinecap="round" markerEnd={`url(#wb-arrow-${idx>=0?idx:0})`} style={{ cursor: tool==='select' ? 'grab' : undefined }}/>
    }
    if (el.type === 'text') {
      return (
        <text {...common} x={el.x} y={(el.y ?? 0)+14} fill={el.color} fontSize={15} fontWeight={500}
          style={{ cursor: tool==='select' ? 'grab' : 'text', userSelect:'none' }}>
          {el.text || ' '}
        </text>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50/60">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-white flex-wrap">
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {TOOLS.map(({ key, label, Icon }) => (
            <button key={key} title={label} onClick={() => { setTool(key); setSelectedId(null) }}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${tool===key ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={14}/>
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200 mx-1"/>

        {/* Color */}
        <div className="flex items-center gap-1">
          {WHITEBOARD_COLORS.map(c => (
            <button key={c} title={c} onClick={() => { setColor(c); if (selectedId) recolorSelected(c) }}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${color===c ? 'border-gray-700 scale-110' : 'border-white shadow-sm'}`}
              style={{ background: c }}/>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200 mx-1"/>

        {/* Zoom */}
        <button onClick={zoomOut} title="Diminuir zoom" className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"><ZoomOut size={14}/></button>
        <span className="text-[11px] text-gray-500 w-10 text-center">{Math.round(zoom*100)}%</span>
        <button onClick={zoomIn} title="Aumentar zoom" className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"><ZoomIn size={14}/></button>
        <button onClick={() => setZoom(1)} title="Restaurar zoom" className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"><RotateCcw size={12}/></button>

        <div className="flex-1"/>

        {selectedId && (
          <button onClick={deleteSelected} className="flex items-center gap-1 text-[11px] px-2 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors mr-1">
            <Trash2 size={11}/> Excluir seleção
          </button>
        )}
        <button onClick={clearAll}
          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-colors ${confirmClear ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          <Trash2 size={11}/> {confirmClear ? 'Confirmar?' : 'Limpar tudo'}
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto relative">
        <svg
          ref={svgRef}
          width={CANVAS_W*zoom} height={CANVAS_H*zoom}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="bg-white"
          style={{
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize: `${24*zoom}px ${24*zoom}px`,
            cursor: tool==='select' ? 'default' : tool==='text' ? 'text' : 'crosshair',
          }}
          onPointerDown={onBackgroundPointerDown}
          onPointerMove={e => { if (dragRef.current) onElementPointerMove(e); else onBackgroundPointerMove(e) }}
          onPointerUp={() => { onBackgroundPointerUp(); onElementPointerUp() }}
          onPointerLeave={() => { onBackgroundPointerUp(); onElementPointerUp() }}
        >
          <defs>
            {WHITEBOARD_COLORS.map((c, i) => (
              <marker key={c} id={`wb-arrow-${i}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={c}/>
              </marker>
            ))}
          </defs>

          {elements.length === 0 && !draft && (
            <text x={CANVAS_W/2} y={80} textAnchor="middle" fill="#c9ccd1" fontSize={13}>
              Desenhe livremente ou use as formas (retângulo, losango, elipse, seta) para montar fluxos — inclusive BPMN.
            </text>
          )}

          {elements.map(el => <React.Fragment key={el.id}>{renderElement(el)}</React.Fragment>)}
          {draft && renderElement(draft, true)}
        </svg>

        {/* Edição de texto (input flutuante sobre o canvas) */}
        {editingText && (
          <input
            autoFocus
            value={editingText.value}
            onChange={e => setEditingText(t => t ? { ...t, value: e.target.value } : t)}
            onBlur={commitText}
            onKeyDown={e => { if (e.key==='Enter') commitText(); if (e.key==='Escape') { setElements(p=>p.filter(x=>x.id!==editingText.id)); setEditingText(null) } }}
            placeholder="Texto..."
            style={{ position:'absolute', left: editingText.x - (svgRef.current?.getBoundingClientRect().left ?? 0), top: editingText.y - (svgRef.current?.getBoundingClientRect().top ?? 0) - 12 }}
            className="text-[15px] font-medium px-1.5 py-0.5 border-2 border-brand-400 rounded-md outline-none bg-white shadow-sm min-w-[100px]"
          />
        )}
      </div>
    </div>
  )
}
