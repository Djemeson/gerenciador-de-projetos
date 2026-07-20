import React, { useEffect, useRef, useState } from 'react'
import { Sparkles, Mic, Square, Loader2, X, Plus, Info, Wand2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { generateProjectEnrichment, flattenGeneratedTasks, type AIGeneratedTask, type ExistingTaskSummary } from '../../lib/aiProjectGen'
import { createTaskTree, countTaskTree } from '../../lib/aiTaskCreate'
import { TYPE_ICON, TYPE_ICON_COLOR } from '../../lib/taskTypeIcons'

interface MinimalSpeechRecognition extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean
  start: () => void; stop: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => MinimalSpeechRecognition) | null {
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

type Step = 'input' | 'loading' | 'preview'

export function EnrichProjectModal() {
  const { enrichProjectModal, closeEnrichProject, projects, tasks: allTasks, addTask } = useAppStore()
  const { openAIKey, geminiApiKey } = useSettingsStore()
  const project = projects.find(p => p.id === enrichProjectModal)

  const [step, setStep] = useState<Step>('input')
  const [context, setContext] = useState('')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<AIGeneratedTask[]>([])
  const [usedAI, setUsedAI] = useState(false)
  const [generatingMore, setGeneratingMore] = useState(false)
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null)
  const speechSupported = !!getSpeechRecognition()

  useEffect(() => {
    if (enrichProjectModal) {
      setStep('input'); setContext(''); setError(''); setSuggestions([]); setUsedAI(false)
    }
  }, [enrichProjectModal])

  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  if (!enrichProjectModal || !project) return null

  const projectTasks = allTasks.filter(t => t.projectId === project.id)
  const existing: ExistingTaskSummary[] = projectTasks.map(t => ({
    title: t.title, taskType: t.taskType ?? 'task', isSubtask: !!t.parentId,
  }))

  const toggleListening = () => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) return
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    const rec = new Ctor()
    rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = true
    let finalText = ''
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += chunk + ' '
        else interim += chunk
      }
      setContext(prev => {
        const base = prev.trimEnd()
        return `${base ? base + ' ' : ''}${finalText}${interim}`.trimStart()
      })
    }
    rec.onerror = () => setListening(false)
    rec.onend   = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  const handleClose = () => {
    recognitionRef.current?.stop()
    closeEnrichProject()
  }

  const handleGenerate = async () => {
    recognitionRef.current?.stop(); setListening(false)
    setStep('loading'); setError('')
    try {
      const { tasks, usedAI: ai } = await generateProjectEnrichment(
        { name: project.name, description: project.description },
        existing, context.trim(), { openAIKey, geminiApiKey }
      )
      if (tasks.length === 0) {
        setError('Nenhuma chave de IA configurada e nenhum contexto adicional foi dado — não há como sugerir algo novo. Adicione contexto acima ou configure uma chave em Configurações.')
        setStep('input')
        return
      }
      setSuggestions(tasks); setUsedAI(ai); setStep('preview')
    } catch {
      setError('Não foi possível gerar sugestões. Tente novamente.')
      setStep('input')
    }
  }

  const handleGenerateMore = async () => {
    if (generatingMore) return
    setGeneratingMore(true); setError('')
    try {
      const combinedExisting = [...existing, ...flattenGeneratedTasks(suggestions)]
      const { tasks: more, usedAI: ai } = await generateProjectEnrichment(
        { name: project.name, description: project.description }, combinedExisting, context.trim(), { openAIKey, geminiApiKey }
      )
      if (more.length > 0) {
        setSuggestions(prev => [...prev, ...more])
      } else {
        setError(ai ? 'A IA não encontrou nada novo para sugerir.' : 'Nada novo para sugerir localmente — edite o contexto ou configure uma chave de IA.')
      }
      if (ai) setUsedAI(true)
    } finally {
      setGeneratingMore(false)
    }
  }

  const updateAt = (path: number[], patch: Partial<AIGeneratedTask>) => {
    const next = structuredClone(suggestions) as AIGeneratedTask[]
    let list = next
    for (let i = 0; i < path.length - 1; i++) list = list[path[i]].subtasks ?? (list[path[i]].subtasks = [])
    const idx = path[path.length - 1]
    list[idx] = { ...list[idx], ...patch }
    setSuggestions(next)
  }

  const removeAt = (path: number[]) => {
    const next = structuredClone(suggestions) as AIGeneratedTask[]
    let list = next
    for (let i = 0; i < path.length - 1; i++) list = list[path[i]].subtasks ?? []
    list.splice(path[path.length - 1], 1)
    setSuggestions(next)
  }

  const handleAdd = () => {
    for (const t of suggestions) {
      createTaskTree(addTask, project.id, null, t)
    }
    closeEnrichProject()
  }

  const totalNew = countTaskTree(suggestions)

  return (
    <Modal open={!!enrichProjectModal} onClose={handleClose} title="" width="max-w-xl">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg ai-gradient-bg text-white flex items-center justify-center flex-shrink-0">
          <Wand2 size={17}/>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-900">Enriquecer com IA</h2>
          <p className="text-[11px] text-gray-400 truncate">Sugere mais tarefas, subtarefas e marcos para "{project.name}".</p>
        </div>
      </div>

      {step === 'input' && (
        <div className="space-y-4">
          <div className="relative">
            <textarea
              autoFocus value={context} onChange={e => setContext(e.target.value)}
              placeholder="Opcional: dê mais contexto (ex: uma nova exigência, uma etapa que faltou). Deixe em branco e clique em gerar para a IA analisar as tarefas existentes e sugerir o que falta."
              rows={4}
              className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-brand-400 transition-all resize-none bg-gray-50/60 focus:bg-white"
            />
            {speechSupported && (
              <button type="button" onClick={toggleListening}
                title={listening ? 'Parar ditado' : 'Ditar por voz'}
                className={`absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm
                  ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {listening ? <Square size={13}/> : <Mic size={14}/>}
              </button>
            )}
          </div>
          {listening && <p className="text-[11px] text-red-500 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/> Ouvindo...</p>}

          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
            <Info size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10.5px] text-gray-500 leading-relaxed">
              {(openAIKey || geminiApiKey)
                ? `A IA vai analisar as ${existing.length} tarefas já existentes deste projeto${context.trim() ? ' e o contexto que você adicionou' : ''} para sugerir o que falta.`
                : context.trim()
                  ? 'Nenhuma chave de IA configurada — as sugestões serão organizadas localmente a partir do contexto que você digitou.'
                  : 'Nenhuma chave de IA configurada — sem uma chave, é preciso adicionar contexto acima (o modo local não consegue analisar lacunas sozinho).'}
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="default" onClick={handleClose} className="flex-1">Cancelar</Button>
            <Button type="button" variant="primary" className="flex-1" onClick={handleGenerate} icon={<Sparkles size={13}/>}>
              {context.trim() ? 'Gerar sugestões' : 'Analisar projeto e gerar'}
            </Button>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 size={24} className="text-brand-500 animate-spin"/>
          <p className="text-sm text-gray-500">Analisando o projeto e sugerindo novos itens...</p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sugestões novas ({totalNew})</label>
            {!usedAI && <span className="text-[9.5px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Plano local</span>}
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {suggestions.map((t, i) => (
              <EnrichNode key={i} item={t} path={[i]} depth={0} onUpdate={updateAt} onRemove={removeAt}/>
            ))}
          </div>
          <button type="button" onClick={handleGenerateMore} disabled={generatingMore}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-gray-500 hover:text-brand-600 bg-gray-50/50 hover:bg-brand-50/40 border border-dashed border-gray-200 hover:border-brand-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-wait">
            {generatingMore ? <Loader2 size={12} className="animate-spin"/> : <Plus size={12}/>}
            {generatingMore ? 'Gerando mais sugestões...' : 'Gerar mais sugestões'}
          </button>
          {error && <p className="text-[10.5px] text-amber-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="default" onClick={() => setStep('input')} className="flex-1">Voltar</Button>
            <Button type="button" variant="primary" className="flex-1" disabled={suggestions.length===0} onClick={handleAdd} icon={<Plus size={13}/>}>
              Adicionar ao projeto
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function EnrichNode({ item, path, depth, onUpdate, onRemove }: {
  item: AIGeneratedTask
  path: number[]
  depth: number
  onUpdate: (path: number[], patch: Partial<AIGeneratedTask>) => void
  onRemove: (path: number[]) => void
}) {
  const type = item.taskType ?? 'task'
  const Icon = TYPE_ICON[type]
  const isMilestone = type === 'milestone'

  return (
    <div className={depth === 0 ? `p-2.5 rounded-xl border ${isMilestone ? 'bg-brand-50/50 border-brand-200' : 'bg-gray-50 border-gray-100'}` : 'mt-1.5 pl-3 border-l border-gray-200'}>
      <div className="flex items-center gap-1.5">
        <Icon size={depth === 0 ? 13 : 11} style={{ color: isMilestone ? '#4F46E5' : TYPE_ICON_COLOR }} className="flex-shrink-0"/>
        <input value={item.title} onChange={e => onUpdate(path, { title: e.target.value })}
          className={`flex-1 min-w-0 bg-transparent outline-none ${depth === 0 ? 'text-xs font-semibold text-gray-800' : 'text-[11px] text-gray-600'}`}/>
        <button onClick={() => onRemove(path)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={depth === 0 ? 13 : 11}/></button>
      </div>
      {(item.subtasks ?? []).length > 0 && (
        <div className="space-y-1">
          {item.subtasks!.map((sub, j) => (
            <EnrichNode key={j} item={sub} path={[...path, j]} depth={depth + 1} onUpdate={onUpdate} onRemove={onRemove}/>
          ))}
        </div>
      )}
    </div>
  )
}
