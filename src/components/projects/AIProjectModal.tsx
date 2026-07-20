import React, { useEffect, useRef, useState } from 'react'
import { Sparkles, Mic, Square, Loader2, ChevronLeft, X, Plus, Info, Wand2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui'
import { Select } from '../ui/Select'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { generateProjectPlan, generateProjectEnrichment, flattenGeneratedTasks, type AIGeneratedProject, type AIGeneratedTask } from '../../lib/aiProjectGen'
import { createTaskTree, countTaskTree } from '../../lib/aiTaskCreate'
import { TYPE_ICON, TYPE_ICON_COLOR } from '../../lib/taskTypeIcons'
import { PROJECT_COLORS } from '../../types'

// Web Speech API — tipos mínimos (não faz parte do lib.dom.d.ts padrão).
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

export function AIProjectModal() {
  const { aiProjectModal, aiProjectCtx, closeAIProject, addProject, addTask, spaces: allSpaces, folders, activeWorkspaceId, setView } = useAppStore()
  const { openAIKey, geminiApiKey } = useSettingsStore()
  const spaces = allSpaces.filter(s => s.workspaceId === activeWorkspaceId)

  const [step, setStep]               = useState<Step>('input')
  const [instructions, setInstructions] = useState('')
  const [spaceId, setSpaceId]         = useState('')
  const [folderId, setFolderId]       = useState('')
  const [listening, setListening]     = useState(false)
  const [error, setError]             = useState('')
  const [plan, setPlan]               = useState<AIGeneratedProject | null>(null)
  const [usedAI, setUsedAI]           = useState(false)
  const [generatingMore, setGeneratingMore] = useState(false)
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null)
  const speechSupported = !!getSpeechRecognition()

  useEffect(() => {
    if (aiProjectModal) {
      setStep('input'); setInstructions(''); setError(''); setPlan(null); setUsedAI(false)
      setSpaceId(aiProjectCtx.spaceId ?? ''); setFolderId(aiProjectCtx.folderId ?? '')
    }
  }, [aiProjectModal, aiProjectCtx.spaceId, aiProjectCtx.folderId])

  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  if (!aiProjectModal) return null

  const availableFolders = folders.filter(f => f.spaceId === spaceId)

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
      setInstructions(prev => {
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
    closeAIProject()
  }

  const handleGenerate = async () => {
    if (!instructions.trim()) return
    recognitionRef.current?.stop(); setListening(false)
    setStep('loading'); setError('')
    try {
      const { plan: generated, usedAI: ai } = await generateProjectPlan(instructions.trim(), { openAIKey, geminiApiKey })
      setPlan(generated); setUsedAI(ai); setStep('preview')
    } catch {
      setError('Não foi possível gerar o plano. Tente novamente.')
      setStep('input')
    }
  }

  const handleGenerateMore = async () => {
    if (!plan || generatingMore) return
    setGeneratingMore(true); setError('')
    try {
      const existing = flattenGeneratedTasks(plan.tasks)
      const { tasks: more, usedAI: ai } = await generateProjectEnrichment(
        { name: plan.name, description: plan.description }, existing, instructions.trim(), { openAIKey, geminiApiKey }
      )
      if (more.length > 0) {
        setPlan({ ...plan, tasks: [...plan.tasks, ...more] })
      } else {
        setError(ai ? 'A IA não encontrou nada novo para sugerir.' : 'Nada novo para sugerir a partir do mesmo texto no modo local — edite as instruções ou configure uma chave de IA.')
      }
      if (ai) setUsedAI(true)
    } finally {
      setGeneratingMore(false)
    }
  }

  const updateTaskAt = (path: number[], patch: Partial<AIGeneratedTask>) => {
    if (!plan) return
    const tasks = structuredClone(plan.tasks) as AIGeneratedTask[]
    let list = tasks
    for (let i = 0; i < path.length - 1; i++) list = list[path[i]].subtasks ?? (list[path[i]].subtasks = [])
    const idx = path[path.length - 1]
    list[idx] = { ...list[idx], ...patch }
    setPlan({ ...plan, tasks })
  }

  const removeTaskAt = (path: number[]) => {
    if (!plan) return
    const tasks = structuredClone(plan.tasks) as AIGeneratedTask[]
    let list = tasks
    for (let i = 0; i < path.length - 1; i++) list = list[path[i]].subtasks ?? []
    list.splice(path[path.length - 1], 1)
    setPlan({ ...plan, tasks })
  }

  const handleCreate = () => {
    if (!plan) return
    const project = addProject(plan.name || 'Novo projeto', PROJECT_COLORS[0], plan.description, spaceId || undefined, folderId || undefined)
    for (const t of plan.tasks) {
      createTaskTree(addTask, project.id, null, t)
    }
    closeAIProject()
    setView('project_detail', project.id)
  }

  const totalTasks = plan ? countTaskTree(plan.tasks) : 0

  return (
    <Modal open={aiProjectModal} onClose={handleClose} title="" width="max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg ai-gradient-bg text-white flex items-center justify-center flex-shrink-0">
          <Wand2 size={17}/>
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">Criar projeto com IA</h2>
          <p className="text-[11px] text-gray-400">Dê o contexto por texto ou voz — a IA sugere o projeto, as tarefas e subtarefas.</p>
        </div>
      </div>

      {step === 'input' && (
        <div className="space-y-4">
          <div className="relative">
            <textarea
              autoFocus value={instructions} onChange={e => setInstructions(e.target.value)}
              placeholder="Ex: Preciso lançar a nova versão do app até o fim do mês, com redesign da tela inicial e testes de QA. Não precisa listar as tarefas — só descreva o contexto e o objetivo, a IA sugere o que precisa ser feito."
              rows={6}
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
          {listening && <p className="text-[11px] text-red-500 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/> Ouvindo... fale suas instruções.</p>}
          {!speechSupported && <p className="text-[10.5px] text-gray-400">Ditado por voz não é suportado neste navegador — use o texto.</p>}

          {spaces.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Espaço</label>
                <Select value={spaceId} onChange={v => { setSpaceId(v); setFolderId('') }} ariaLabel="Espaço"
                  options={[{ value:'', label:'Nenhum' }, ...spaces.map(s => ({ value:s.id, label:s.name }))]}/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Pasta</label>
                <Select value={folderId} onChange={setFolderId} ariaLabel="Pasta"
                  disabled={!spaceId || availableFolders.length===0}
                  options={[{ value:'', label:'Nenhuma' }, ...availableFolders.map(f => ({ value:f.id, label:f.name }))]}/>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
            <Info size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10.5px] text-gray-500 leading-relaxed">
              {(openAIKey || geminiApiKey)
                ? 'Sua chave de IA configurada em Configurações será usada para sugerir as tarefas.'
                : 'Nenhuma chave de IA configurada — as tarefas serão sugeridas localmente a partir do seu contexto. Adicione uma chave em Configurações para usar um modelo de IA real.'}
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="default" onClick={handleClose} className="flex-1">Cancelar</Button>
            <Button type="button" variant="primary" className="flex-1" disabled={!instructions.trim()} onClick={handleGenerate} icon={<Sparkles size={13}/>}>
              Gerar projeto com IA
            </Button>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 size={24} className="text-brand-500 animate-spin"/>
          <p className="text-sm text-gray-500">Organizando o projeto a partir das suas instruções...</p>
        </div>
      )}

      {step === 'preview' && plan && (
        <div className="space-y-4">
          <button onClick={() => setStep('input')} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700">
            <ChevronLeft size={13}/> Voltar e editar instruções
          </button>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nome do projeto</label>
            <input value={plan.name} onChange={e => setPlan({ ...plan, name: e.target.value })}
              className="w-full text-sm font-semibold px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"/>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Descrição</label>
            <textarea value={plan.description} onChange={e => setPlan({ ...plan, description: e.target.value })} rows={2}
              className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 resize-none"/>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tarefas geradas ({totalTasks})</label>
              {!usedAI && <span className="text-[9.5px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Plano local</span>}
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {plan.tasks.map((t, i) => (
                <TaskNode key={i} item={t} path={[i]} depth={0} onUpdate={updateTaskAt} onRemove={removeTaskAt}/>
              ))}
            </div>
            <button type="button" onClick={handleGenerateMore} disabled={generatingMore}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-gray-500 hover:text-brand-600 bg-gray-50/50 hover:bg-brand-50/40 border border-dashed border-gray-200 hover:border-brand-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-wait">
              {generatingMore ? <Loader2 size={12} className="animate-spin"/> : <Plus size={12}/>}
              {generatingMore ? 'Gerando mais tarefas...' : 'Gerar mais tarefas'}
            </button>
            {error && <p className="text-[10.5px] text-amber-600 mt-1.5">{error}</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="default" onClick={handleClose} className="flex-1">Cancelar</Button>
            <Button type="button" variant="primary" className="flex-1" onClick={handleCreate} icon={<Plus size={13}/>}>
              Criar projeto
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// Nó recursivo do preview — mostra o ícone do tipo (marco/meta/objetivo/erro/
// solicitação/tarefa, os mesmos usados no resto do app) e renderiza subtarefas
// em qualquer profundidade, com indentação crescente.
function TaskNode({ item, path, depth, onUpdate, onRemove }: {
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
            <TaskNode key={j} item={sub} path={[...path, j]} depth={depth + 1} onUpdate={onUpdate} onRemove={onRemove}/>
          ))}
        </div>
      )}
    </div>
  )
}
