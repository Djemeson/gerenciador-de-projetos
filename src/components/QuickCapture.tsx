import React, { useState, useEffect, useRef, useMemo } from 'react'
import { X, Zap, CalendarDays, Check, Sparkles, Mic, MicOff, FolderOpen, Tag, User, Shapes } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { Select, PRIORITY_OPTIONS } from './ui/Select'
import { isoDate } from '../lib/dateFilter'
import { parseSmartCapture, type SmartMatch } from '../lib/smartCapture'
import { suportaFala, ouvirFala, type OuvinteDeFala } from '../lib/speech'
import { INBOX_PROJECT_ID } from '../types'
import type { Priority } from '../types'

interface QuickCaptureProps {
  open:    boolean
  onClose: () => void
}

/** Como cada coisa entendida aparece na prévia. */
const ROTULO_ENTENDIDO: Record<SmartMatch['kind'], { Icon: React.ReactNode; texto: (l: string) => string }> = {
  date:     { Icon: <CalendarDays size={12}/>, texto: l => `prazo ${l}` },
  priority: { Icon: <Zap size={12}/>,          texto: l => `prioridade ${l}` },
  project:  { Icon: <FolderOpen size={12}/>,   texto: l => `projeto ${l}` },
  tag:      { Icon: <Tag size={12}/>,          texto: l => l },
  assignee: { Icon: <User size={12}/>,         texto: l => l },
  type:     { Icon: <Shapes size={12}/>,       texto: l => l },
}

// Prazos de um clique — clicar de novo desmarca.
const DUE_CHIPS: { key: string; label: string; days: number }[] = [
  { key: 'today',    label: 'Hoje',         days: 0 },
  { key: 'tomorrow', label: 'Amanhã',       days: 1 },
  { key: 'week',     label: 'Próx. semana', days: 7 },
]

export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const { quickAddTask, updateTask, projects: allProjects, activeWorkspaceId, tasks: todasTarefas } = useAppStore()
  const projects = allProjects.filter(p => p.workspaceId === activeWorkspaceId)
  const [title,     setTitle]     = useState('')
  const [priority,  setPriority]  = useState<Priority>('medium')
  const [dueChip,   setDueChip]   = useState<string | null>(null)
  const [projectId, setProjectId] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [ouvindo,   setOuvindo]   = useState(false)
  const [erroFala,  setErroFala]  = useState<string | null>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const ouvinteRef = useRef<OuvinteDeFala | null>(null)
  const temMicrofone = suportaFala()

  /**
   * Liga/desliga o ditado. O texto reconhecido substitui o campo enquanto se fala; ao
   * encerrar, o parser já mostra o que entendeu, e o Enter salva.
   */
  const alternarDitado = () => {
    setErroFala(null)
    if (ouvindo) { ouvinteRef.current?.parar(); return }
    const ouvinte = ouvirFala({
      aoTranscrever: (texto) => setTitle(texto),
      aoTerminar:    () => { setOuvindo(false); inputRef.current?.focus() },
      aoFalhar:      (motivo) => { setErroFala(motivo); setOuvindo(false) },
    })
    if (!ouvinte) { setErroFala('Este navegador não faz reconhecimento de fala.'); return }
    ouvinteRef.current = ouvinte
    setOuvindo(true)
  }

  // Fechar a janela no meio da fala não pode deixar o microfone ligado.
  useEffect(() => () => ouvinteRef.current?.cancelar(), [])
  useEffect(() => { if (!open) { ouvinteRef.current?.cancelar(); setOuvindo(false); setErroFala(null) } }, [open])

  /**
   * Abertura pelo atalho do ícone do app (`/?acao=voz`): já começa escutando, para o
   * caminho ser "segurar o ícone → falar". É o mais perto de um widget que dá para chegar
   * sem app nativo.
   */
  useEffect(() => {
    if (!open || !temMicrofone) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('acao') !== 'voz') return
    // Limpa o parâmetro para uma recarga não reabrir o microfone sozinha.
    window.history.replaceState({}, '', window.location.pathname)
    const t = setTimeout(alternarDitado, 250)
    return () => clearTimeout(t)
  }, [open, temMicrofone])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setTitle(''); setPriority('medium'); setDueChip(null); setProjectId(''); setSavedCount(0)
    }
  }, [open])

  // Captura inteligente: entende "amanhã", "sexta", "15/08", "urgente", o nome do projeto,
  // #etiquetas, @responsável e o tipo — no próprio texto.
  // Escolha manual (prioridade/chip de prazo/projeto) sempre vence o que foi detectado.
  const vocab = useMemo(() => ({
    projetos: projects.map(p => ({ id: p.id, name: p.name })),
    responsaveis: [...new Set(todasTarefas.map(t => t.assignee).filter(Boolean))],
  }), [projects, todasTarefas])
  const parsed = useMemo(() => parseSmartCapture(title, new Date(), vocab), [title, vocab])

  if (!open) return null

  const save = () => {
    if (!title.trim()) { onClose(); return }
    // Ordem do destino: escolha manual > projeto dito no texto > Caixa de entrada. O
    // fallback para o inbox é o pedido explícito ("se eu não falar projeto fica no inbox").
    const pid = projectId || parsed.projectId || INBOX_PROJECT_ID
    const effTitle = (parsed.title || title).trim()
    const t = quickAddTask(effTitle, pid, 'todo')
    // quickAddTask nasce com prioridade média e sem prazo — aplica escolha manual ou detecção.
    const chip = DUE_CHIPS.find(c => c.key === dueChip)
    const patch: Parameters<typeof updateTask>[1] = {}
    if (priority !== 'medium') patch.priority = priority
    else if (parsed.priority && parsed.priority !== 'medium') patch.priority = parsed.priority
    if (chip) { const d = new Date(); d.setDate(d.getDate() + chip.days); patch.dueDate = isoDate(d) }
    else if (parsed.dueDate) patch.dueDate = parsed.dueDate
    if (parsed.tags.length) patch.tags = parsed.tags
    if (parsed.assignee)    patch.assignee = parsed.assignee
    if (parsed.taskType)    patch.taskType = parsed.taskType
    if (Object.keys(patch).length) updateTask(t.id, patch)
    setTitle('')
    setSavedCount(n => n + 1)
    // Continua aberto para capturar a próxima — prioridade/prazo/projeto ficam como estão.
    inputRef.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-[3px] animate-overlay-in" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl border border-gray-200/80 shadow-2xl overflow-hidden animate-scale-in">
        {/* Cabeçalho */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-brand-600/30">
            <Zap size={14}/>
          </div>
          <span className="text-sm font-semibold text-gray-800">Captura rápida</span>
          {savedCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-success-600 bg-success-50 px-2 py-0.5 rounded-full animate-fade-in">
              <Check size={12}/> {savedCount} {savedCount === 1 ? 'criada' : 'criadas'}
            </span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">Enter salva · Esc fecha</span>
          {temMicrofone && (
            <button onClick={alternarDitado} aria-pressed={ouvindo}
              title={ouvindo ? 'Parar de ouvir' : 'Ditar a tarefa'}
              className={`p-1.5 rounded-lg transition-colors ${
                ouvindo ? 'bg-danger-50 text-danger-600' : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50'}`}>
              {ouvindo ? <MicOff size={15}/> : <Mic size={15}/>}
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar"
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-1"><X size={14}/></button>
        </div>

        {/* Título da tarefa */}
        <div className="px-4 pt-3 pb-2">
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={onKey}
            placeholder="O que você está pensando? (entende &quot;amanhã&quot;, &quot;sexta&quot;, &quot;urgente&quot;…)"
            className="w-full text-base text-gray-800 outline-none bg-transparent placeholder:text-gray-300"
          />
          {erroFala && (
            <p className="text-[11px] text-danger-600 mt-2 animate-fade-in">{erroFala}</p>
          )}
          {ouvindo && (
            <p className="flex items-center gap-1.5 text-[11px] text-brand-600 mt-2 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-ping"/>
              Ouvindo… fale a tarefa e toque no microfone para encerrar.
            </p>
          )}
          {parsed.matched.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap animate-fade-in">
              <Sparkles size={12} className="ai-gradient-text flex-shrink-0"/>
              <span className="text-[11px] text-gray-500">Entendi:</span>
              {parsed.matched.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
                  {ROTULO_ENTENDIDO[m.kind].Icon}
                  {ROTULO_ENTENDIDO[m.kind].texto(m.label)}
                </span>
              ))}
              <span className="text-[11px] text-gray-400">— sai do título ao salvar</span>
            </div>
          )}
        </div>

        {/* Prioridade + prazo rápido */}
        <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
          <div className="flex gap-1">
            {PRIORITY_OPTIONS.map(p => {
              const active = priority === p.value
              return (
                <button key={p.value} onClick={() => setPriority(p.value as Priority)} title={p.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${
                    active ? 'border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  style={active ? { background: p.color + '18', color: p.textColor ?? p.color } : undefined}>
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }}/>
                  {p.label}
                </button>
              )
            })}
          </div>
          <div className="w-px h-4 bg-gray-200 mx-1"/>
          <div className="flex gap-1">
            {DUE_CHIPS.map(c => {
              const active = dueChip === c.key
              return (
                <button key={c.key} onClick={() => setDueChip(active ? null : c.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${
                    active ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  <CalendarDays size={12}/> {c.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Projeto + salvar */}
        <div className="flex items-center gap-3 px-4 pb-4">
          <Select value={projectId} onChange={setProjectId} ariaLabel="Projeto" className="flex-1"
            searchable searchPlaceholder="Buscar projeto..."
            options={[{ value:'', label:'Caixa de entrada' }, ...projects.map(p => ({ value:p.id, label:p.name, color:p.color }))]}/>
          <button
            onClick={save}
            disabled={!title.trim()}
            className="px-3.5 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-30 transition-colors shadow-sm shadow-brand-600/30"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
