import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Star, Mail, Phone, Globe, User, Sparkles, RefreshCw, Key } from 'lucide-react'
import type { Task, ColumnDef } from '../../types'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'

interface Props { task: Task; column: ColumnDef }

export function CustomFieldCell({ task, column }: Props) {
  const { updateCustomField, isAIGenerating, regenerateAISummary } = useAppStore()
  const { geminiApiKey, updateSetting } = useSettingsStore()
  const value = task.customFields?.[column.id]
  const [dropOpen, setDropOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropOpen) return
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const update = (v: unknown) => updateCustomField(task.id, column.id, v)

  // ── Resumo de conclusão (IA) — estilo Gemini ─────────────────────────────
  if (column.type === 'ai_summary') {
    const text = String(value ?? '')
    const generating = isAIGenerating(task.id, column.id)
    return (
      <AISummaryCell
        task={task} column={column} text={text} generating={generating}
        hasKey={!!geminiApiKey}
        onRegenerate={() => regenerateAISummary(task.id, column.id)}
        onSaveKey={(k) => updateSetting('geminiApiKey', k)}
      />
    )
  }

  // ── Dropdown com cores ───────────────────────────────────────────────────
  if (column.type === 'dropdown') {
    const selected = column.dropdownOptions.find(o => o.label === value)
    return (
      <div ref={ref} className="relative w-full">
        <button
          onClick={e => { e.stopPropagation(); setDropOpen(v => !v) }}
          className="flex items-center gap-1.5 w-full text-left"
        >
          {selected ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium truncate"
              style={{ background: selected.color + '25', color: selected.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: selected.color }}/>
              {selected.label}
            </span>
          ) : (
            <span className="text-gray-300 text-[11px]">—</span>
          )}
          <ChevronDown size={9} className="text-gray-400 flex-shrink-0 ml-auto"/>
        </button>

        {dropOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]"
            onClick={e => e.stopPropagation()}>
            {/* Clear */}
            <button onClick={() => { update(''); setDropOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:bg-gray-50 transition-colors">
              — Nenhuma
            </button>
            <div className="h-px bg-gray-100 my-1"/>
            {column.dropdownOptions.map(opt => (
              <button key={opt.id} onClick={() => { update(opt.label); setDropOpen(false) }}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: opt.color }}/>
                <span className="text-[12px] text-gray-700 flex-1">{opt.label}</span>
                {value === opt.label && <Check size={11} className="text-brand-500 flex-shrink-0"/>}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Rótulos (seleção múltipla) ───────────────────────────────────────────
  if (column.type === 'labels') {
    const selectedLabels: string[] = Array.isArray(value) ? value as string[] : []
    const toggle = (label: string) => update(
      selectedLabels.includes(label) ? selectedLabels.filter(l => l !== label) : [...selectedLabels, label]
    )
    return (
      <div ref={ref} className="relative w-full">
        <button onClick={e => { e.stopPropagation(); setDropOpen(v => !v) }} className="flex items-center gap-1 w-full text-left flex-wrap">
          {selectedLabels.length > 0 ? (
            <div className="flex gap-1 flex-wrap flex-1 min-w-0">
              {selectedLabels.slice(0,2).map(l => {
                const opt = column.dropdownOptions.find(o => o.label === l)
                return <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium truncate" style={{ background: (opt?.color ?? '#888780')+'25', color: opt?.color ?? '#888780' }}>{l}</span>
              })}
              {selectedLabels.length > 2 && <span className="text-[10px] text-gray-400">+{selectedLabels.length-2}</span>}
            </div>
          ) : <span className="text-gray-300 text-[11px]">—</span>}
          <ChevronDown size={9} className="text-gray-400 flex-shrink-0 ml-auto"/>
        </button>

        {dropOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]"
            onClick={e => e.stopPropagation()}>
            {column.dropdownOptions.map(opt => {
              const on = selectedLabels.includes(opt.label)
              return (
                <button key={opt.id} onClick={() => toggle(opt.label)}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${on ? 'bg-brand-500 border-brand-500' : 'border-gray-300'}`}>
                    {on && <Check size={9} className="text-white" strokeWidth={3}/>}
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: opt.color }}/>
                  <span className="text-[12px] text-gray-700 flex-1">{opt.label}</span>
                </button>
              )
            })}
            {column.dropdownOptions.length === 0 && <p className="text-[11px] text-gray-400 px-3 py-2">Nenhuma opção cadastrada.</p>}
          </div>
        )}
      </div>
    )
  }

  // ── Avaliação (estrelas) ─────────────────────────────────────────────────
  if (column.type === 'rating') {
    const rating = Number(value) || 0
    return (
      <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => update(rating === n ? 0 : n)} className="transition-transform hover:scale-110">
            <Star size={11} className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}/>
          </button>
        ))}
      </div>
    )
  }

  // ── Caixa ────────────────────────────────────────────────────────────────
  if (column.type === 'checkbox') {
    return (
      <input type="checkbox" checked={!!value}
        onChange={e => { e.stopPropagation(); update(e.target.checked) }}
        onClick={e => e.stopPropagation()}
        className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 cursor-pointer accent-brand-600"/>
    )
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  if (column.type === 'date') {
    return (
      <input type="date" value={String(value ?? '')}
        onChange={e => { e.stopPropagation(); update(e.target.value) }}
        onClick={e => e.stopPropagation()}
        className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 cursor-pointer"/>
    )
  }

  // ── Número / Dinheiro ────────────────────────────────────────────────────
  if (column.type === 'number' || column.type === 'money') {
    return (
      <div className="flex items-center gap-0.5 w-full">
        {column.type === 'money' && <span className="text-[10px] text-gray-400 flex-shrink-0">R$</span>}
        <input type="number" value={String(value ?? '')}
          onChange={e => { e.stopPropagation(); update(e.target.value) }}
          onClick={e => e.stopPropagation()}
          placeholder="0"
          className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 min-w-0"/>
      </div>
    )
  }

  // ── Link / Site ──────────────────────────────────────────────────────────
  if (column.type === 'url' || column.type === 'website') {
    const url = String(value ?? '')
    return url ? (
      <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
        className="flex items-center gap-1 text-[11px] text-brand-600 hover:underline truncate w-full">
        {column.type === 'website' && <Globe size={10} className="flex-shrink-0"/>}
        {url.replace(/^https?:\/\//, '')}
      </a>
    ) : (
      <input type="url" value={url}
        onChange={e => { e.stopPropagation(); update(e.target.value) }}
        onClick={e => e.stopPropagation()}
        placeholder="https://..."
        className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 placeholder:text-gray-300"/>
    )
  }

  // ── E-mail ───────────────────────────────────────────────────────────────
  if (column.type === 'email') {
    const email = String(value ?? '')
    return email ? (
      <a href={`mailto:${email}`} onClick={e => e.stopPropagation()}
        className="flex items-center gap-1 text-[11px] text-brand-600 hover:underline truncate w-full">
        <Mail size={10} className="flex-shrink-0"/>{email}
      </a>
    ) : (
      <input type="email" value={email}
        onChange={e => { e.stopPropagation(); update(e.target.value) }}
        onClick={e => e.stopPropagation()}
        placeholder="nome@empresa.com"
        className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 placeholder:text-gray-300"/>
    )
  }

  // ── Telefone ─────────────────────────────────────────────────────────────
  if (column.type === 'phone') {
    const phone = String(value ?? '')
    return phone ? (
      <a href={`tel:${phone.replace(/\D/g,'')}`} onClick={e => e.stopPropagation()}
        className="flex items-center gap-1 text-[11px] text-brand-600 hover:underline truncate w-full">
        <Phone size={10} className="flex-shrink-0"/>{phone}
      </a>
    ) : (
      <input type="tel" value={phone}
        onChange={e => { e.stopPropagation(); update(e.target.value) }}
        onClick={e => e.stopPropagation()}
        placeholder="(00) 00000-0000"
        className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 placeholder:text-gray-300"/>
    )
  }

  // ── Pessoas ──────────────────────────────────────────────────────────────
  if (column.type === 'people') {
    const names = String(value ?? '')
    return (
      <div className="flex items-center gap-1.5 min-w-0 w-full">
        {names && <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[9px] font-medium flex items-center justify-center flex-shrink-0">{names.slice(0,2).toUpperCase()}</span>}
        {!names && <User size={11} className="text-gray-300 flex-shrink-0"/>}
        <input value={names} onChange={e => { e.stopPropagation(); update(e.target.value) }}
          onClick={e => e.stopPropagation()}
          placeholder="Nome(s)"
          className="min-w-0 flex-1 bg-transparent border-none outline-none text-[11px] text-gray-600 placeholder:text-gray-300"/>
      </div>
    )
  }

  // ── Área de texto (texto longo, com popover) ────────────────────────────
  if (column.type === 'longtext') {
    const text = String(value ?? '')
    return (
      <div ref={ref} className="relative w-full">
        <button onClick={e => { e.stopPropagation(); setDropOpen(v => !v) }}
          className="w-full text-left text-[11px] text-gray-600 truncate">
          {text || <span className="text-gray-300">—</span>}
        </button>
        {dropOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-[220px]"
            onClick={e => e.stopPropagation()}>
            <textarea autoFocus defaultValue={text} rows={4}
              onBlur={e => { update(e.target.value); setDropOpen(false) }}
              onKeyDown={e => { if (e.key==='Escape') setDropOpen(false) }}
              placeholder="Escreva aqui..."
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-brand-400 resize-none"/>
          </div>
        )}
      </div>
    )
  }

  // ── Texto (padrão) ───────────────────────────────────────────────────────
  return (
    <input type="text" value={String(value ?? '')}
      onChange={e => { e.stopPropagation(); update(e.target.value) }}
      onClick={e => e.stopPropagation()}
      placeholder="—"
      className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 placeholder:text-gray-300"/>
  )
}

// ── Célula de "Resumo de conclusão" (IA, estilo Gemini) ─────────────────────
interface AISummaryCellProps {
  task: Task; column: ColumnDef; text: string; generating: boolean; hasKey: boolean
  onRegenerate: () => void; onSaveKey: (key: string) => void
}

function AISummaryCell({ task, text, generating, hasKey, onRegenerate, onSaveKey }: AISummaryCellProps) {
  const [open, setOpen] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [showKeyForm, setShowKeyForm] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const saveKey = () => { if (keyInput.trim()) { onSaveKey(keyInput.trim()); setKeyInput(''); setShowKeyForm(false) } }

  return (
    <div ref={ref} className="relative w-full">
      <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="flex items-center gap-1.5 w-full text-left min-w-0">
        {generating ? (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ai-gradient-bg text-white ai-generating">
            <Sparkles size={10}/> Gerando…
          </span>
        ) : text ? (
          <span className="inline-flex items-center gap-1 min-w-0 text-[11px] px-2 py-0.5 rounded-full font-medium truncate"
            style={{ boxShadow: '0 0 0 1px rgba(155,114,203,0.4)', color: '#6B4FBB' }}>
            <Sparkles size={10} className="flex-shrink-0 ai-gradient-text"/>
            <span className="truncate">{text}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-300">
            <Sparkles size={10}/> {task.status === 'done' ? 'Sem resumo' : 'Gera ao concluir'}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 elevate p-3 w-[300px]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="ai-gradient-text flex-shrink-0"/>
            <p className="text-[11px] font-semibold ai-gradient-text flex-1">Resumo de conclusão</p>
            <button onClick={onRegenerate} disabled={generating}
              title="Gerar novamente" className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40">
              <RefreshCw size={12} className={generating ? 'animate-spin' : ''}/>
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto text-xs text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-2.5 mb-2">
            {generating ? 'Gerando resumo…' : text || 'Ainda sem resumo — clique em gerar ou conclua a tarefa.'}
          </div>

          {!text && !generating && (
            <button onClick={onRegenerate}
              className="w-full mb-2 py-1.5 text-[11px] font-medium ai-gradient-bg text-white rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
              <Sparkles size={11}/> Gerar agora
            </button>
          )}

          {!hasKey && (
            showKeyForm ? (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-1.5 flex items-center gap-1"><Key size={10}/> Chave da API do Gemini:</p>
                <div className="flex gap-1.5">
                  <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveKey()}
                    placeholder="AIza..."
                    className="flex-1 min-w-0 text-[11px] px-2 py-1 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"/>
                  <button onClick={saveKey} className="text-[11px] px-2 py-1 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex-shrink-0">Salvar</button>
                </div>
                <p className="text-[9px] text-gray-400 mt-1">Armazenada localmente no navegador. Sem chave, o resumo é montado a partir dos dados da tarefa (sem IA generativa).</p>
              </div>
            ) : (
              <button onClick={() => setShowKeyForm(true)}
                className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 pt-1">
                <Key size={9}/> Usar Gemini de verdade (configurar chave)
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
