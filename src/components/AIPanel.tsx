import React, { useState, useRef, useEffect } from 'react'
import {
  X, Send, Sparkles, Loader2, Bot, History, MessageSquarePlus, ChevronLeft, Trash2,
  Check, AlertTriangle, Search, Info, Settings as SettingsIcon,
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { AI_TOOLS, executeTool, type ToolName } from '../lib/aiTools'
import {
  type ChatMessage, type ChatConversation, type ChatToolCall,
  loadConversations, upsertConversation, deleteConversation,
  newConversationId, getCurrentConversationId, setCurrentConversationId,
  formatRelativeDate,
} from '../lib/aiChatHistory'

const OPENAI_MODEL = 'gpt-4o-mini'
const GEMINI_MODEL = 'gemini-2.0-flash'
const MAX_TOOL_ROUNDS = 5

type View = 'chat' | 'history'
type Mode = 'openai' | 'gemini' | 'local' | 'none'

function emptyConversation(): ChatConversation {
  const now = new Date().toISOString()
  return { id: newConversationId(), title: 'Nova conversa', createdAt: now, updatedAt: now, messages: [] }
}

// ── Modo local (sem nenhuma chave) — reconhece alguns comandos diretos em vez
// de simplesmente recusar. Mesma filosofia "sempre funciona" do resto do app. ─
// Remove um prefixo opcional "(a) tarefa " que sobra da captura genérica —
// assim "excluir tarefa X" e "exclua a tarefa X" resolvem para o mesmo título.
function stripTaskNoun(s: string): string {
  return s.replace(/^(?:a\s+)?tarefa\s+/i, '').trim()
}

// Sem uma IA de verdade para narrar o resultado, o modo local mostra o dado
// cru — um pequeno texto de introdução por ferramenta deixa isso legível.
const LOCAL_INTROS: Partial<Record<ToolName, string>> = {
  list_tasks: 'Encontrei estas tarefas:',
  list_projects: 'Projetos do workspace:',
}

function tryLocalCommand(text: string): { tool: ToolName; args: any } | null {
  const t = text.trim()
  let m
  if ((m = t.match(/^criar tarefa[:\-]?\s*(.+)/i))) return { tool: 'create_task', args: { title: stripTaskNoun(m[1]) } }
  if ((m = t.match(/^(?:concluir|finalizar|marcar como conclu[ií]da)\s+(.+)/i))) return { tool: 'complete_task', args: { taskTitle: stripTaskNoun(m[1]) } }
  if ((m = t.match(/^exclu(?:ir|a)\s+(.+)/i))) return { tool: 'delete_task', args: { taskTitle: stripTaskNoun(m[1]) } }
  if ((m = t.match(/^resum[oa]\s*(?:do projeto)?[:\-]?\s*(.*)/i))) return { tool: 'get_summary', args: { projectName: m[1] || undefined } }
  if (/atrasad/i.test(t)) return { tool: 'list_tasks', args: { overdueOnly: true } }
  if (/urgente/i.test(t)) return { tool: 'list_tasks', args: { priority: 'urgent', status: 'all' } }
  if (/projetos?/i.test(t) && /(quais|listar?|mostrar?)/i.test(t)) return { tool: 'list_projects', args: {} }
  return null
}

function systemPrompt(): string {
  return `Você é o assistente de produtividade integrado ao TaskFlow (app de gestão de tarefas estilo ClickUp). Você tem ferramentas reais para consultar e modificar projetos, tarefas, subtarefas e checklists do usuário — use-as sempre que precisar de dados atuais ou for pedido para realizar uma ação, nunca invente.
Regras:
- Se não tiver certeza do nome exato de um projeto ou tarefa, use list_projects/list_tasks primeiro para confirmar antes de agir.
- Ações destrutivas (excluir tarefa) exigem confirmação do usuário na própria interface — apenas chame a ferramenta; nunca diga que já foi excluída.
- Seja direto, conciso e sempre em português (Brasil). Não repita informação óbvia nem liste dados que o usuário não pediu.`
}

export function AIPanel() {
  const { toggleAIPanel, tasks, projects, activeWorkspaceId, addTask, quickAddTask, updateTask, deleteTask, addChecklist, addChecklistItem, addProject } = useAppStore()
  const { openAIKey, geminiApiKey, openSettings } = useSettingsStore()

  const [view, setView] = useState<View>('chat')
  const [conv, setConv] = useState<ChatConversation>(emptyConversation)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const mode: Mode = openAIKey ? 'openai' : geminiApiKey ? 'gemini' : 'none'

  // Restaura a conversa em andamento (sobrevive a fechar/abrir o painel).
  useEffect(() => {
    const currentId = getCurrentConversationId()
    const all = loadConversations()
    const found = currentId ? all.find(c => c.id === currentId) : undefined
    if (found) setConv(found)
    setConversations(all)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [conv.messages, view])

  const persist = (next: ChatConversation) => {
    setConv(next)
    if (next.messages.length > 0) {
      upsertConversation(next)
      setCurrentConversationId(next.id)
      setConversations(loadConversations())
    }
  }

  const ctx = {
    tasks, projects, activeWorkspaceId,
    addTask, quickAddTask, updateTask, deleteTask, addChecklist, addChecklistItem, addProject,
  }

  const runTool = (toolName: ToolName, rawArgs: string) => executeTool(toolName, rawArgs, ctx)

  const callOpenAI = async (history: ChatMessage[]): Promise<{ text: string; toolCalls: ChatToolCall[]; pendingConfirm?: ChatMessage['pendingConfirm'] }> => {
    const collected: ChatToolCall[] = []
    let pendingConfirm: ChatMessage['pendingConfirm']
    let working: any[] = [
      { role: 'system', content: systemPrompt() },
      ...history.map(m => ({ role: m.role, content: m.content })),
    ]
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAIKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OPENAI_MODEL, messages: working, tools: AI_TOOLS, tool_choice: 'auto', temperature: 0.4, max_tokens: 900 }),
      })
      if (!res.ok) throw new Error(`Erro da OpenAI (${res.status})`)
      const data = await res.json()
      const msg = data.choices?.[0]?.message
      if (!msg) throw new Error('Resposta vazia da OpenAI')
      if (msg.tool_calls?.length) {
        working.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })
        for (const tc of msg.tool_calls) {
          const result = runTool(tc.function.name as ToolName, tc.function.arguments)
          collected.push({ summary: result.summary, kind: result.kind })
          if (result.pendingConfirm) pendingConfirm = result.pendingConfirm
          working.push({ role: 'tool', tool_call_id: tc.id, content: result.forModel })
        }
        continue
      }
      return { text: msg.content ?? '', toolCalls: collected, pendingConfirm }
    }
    return { text: 'Isso exigiu muitas etapas — tente reformular seu pedido de forma mais direta.', toolCalls: collected, pendingConfirm }
  }

  const callGemini = async (history: ChatMessage[]): Promise<{ text: string; toolCalls: ChatToolCall[] }> => {
    const active = tasks.filter(t => t.workspaceId === activeWorkspaceId && t.status !== 'done').slice(0, 30)
    const overdue = active.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length
    const wsProjects = projects.filter(p => p.workspaceId === activeWorkspaceId && !p.archived)
    const contextBlurb = `Contexto (somente consulta, sem execução de ações): ${wsProjects.length} projetos ativos; ${active.length} tarefas ativas; ${overdue} atrasadas. Projetos: ${wsProjects.map(p => p.name).join(', ') || 'nenhum'}.`
    const transcript = history.map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n')
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt()}\n${contextBlurb}\n\n${transcript}` }] }] }),
    })
    if (!res.ok) throw new Error(`Erro do Gemini (${res.status})`)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Não obtive resposta.'
    return { text, toolCalls: [] }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    let working = { ...conv, messages: [...conv.messages, userMsg] }
    persist(working)
    setInput(''); setLoading(true)

    try {
      if (mode === 'openai') {
        const { text, toolCalls, pendingConfirm } = await callOpenAI(working.messages)
        working = { ...working, messages: [...working.messages, { role: 'assistant', content: text, toolCalls, pendingConfirm }] }
      } else if (mode === 'gemini') {
        const { text, toolCalls } = await callGemini(working.messages)
        working = { ...working, messages: [...working.messages, { role: 'assistant', content: text, toolCalls }] }
      } else {
        const cmd = tryLocalCommand(userMsg.content)
        if (cmd) {
          const result = runTool(cmd.tool, JSON.stringify(cmd.args))
          const intro = LOCAL_INTROS[cmd.tool]
          const content = result.pendingConfirm ? '' : (intro ? `${intro}\n\n${result.forModel}` : result.forModel)
          working = { ...working, messages: [...working.messages, { role: 'assistant', content, toolCalls: [{ summary: result.summary, kind: result.kind }], pendingConfirm: result.pendingConfirm }] }
        } else {
          working = { ...working, messages: [...working.messages, { role: 'assistant', content: 'Sem uma chave de IA configurada, só reconheço comandos diretos (ex.: "criar tarefa X", "concluir tarefa Y", "resumo do projeto Z"). Configure uma chave em Configurações para conversar livremente.' }] }
        }
      }
    } catch (err: any) {
      working = { ...working, messages: [...working.messages, { role: 'assistant', content: `❌ ${err.message || 'Erro ao conectar com a IA.'}` }] }
    }
    persist(working)
    setLoading(false)
  }

  const resolveConfirm = (msgIndex: number, confirmed: boolean) => {
    const msg = conv.messages[msgIndex]
    if (!msg.pendingConfirm) return
    if (confirmed) deleteTask(msg.pendingConfirm.taskId)
    const messages = conv.messages.map((m, i) => i === msgIndex ? { ...m, pendingConfirm: { ...m.pendingConfirm!, resolved: confirmed ? 'confirmed' as const : 'cancelled' as const } } : m)
    persist({ ...conv, messages })
  }

  const startNewConversation = () => {
    const fresh = emptyConversation()
    setConv(fresh)
    setCurrentConversationId(fresh.id)
    setView('chat')
  }

  const openConversation = (c: ChatConversation) => {
    setConv(c)
    setCurrentConversationId(c.id)
    setView('chat')
  }

  const removeConversation = (id: string) => {
    deleteConversation(id)
    setConversations(loadConversations())
    if (conv.id === id) startNewConversation()
  }

  const SUGGESTIONS = [
    'Quais tarefas estão atrasadas?',
    'Resuma o projeto Lançamento v2.0',
    'Crie uma tarefa urgente para revisar o contrato',
    'Marque a tarefa "Escrever testes de integração" como concluída',
  ]

  const modeLabel: Record<Mode, string> = {
    openai: 'IA com ferramentas ativas',
    gemini: 'Gemini · somente consulta',
    local: 'Modo local',
    none: 'Sem chave configurada',
  }

  const toolIcon = (kind: ChatToolCall['kind']) => {
    if (kind === 'success') return <Check size={10} className="text-emerald-600"/>
    if (kind === 'error') return <X size={10} className="text-red-500"/>
    if (kind === 'warning') return <AlertTriangle size={10} className="text-amber-500"/>
    return <Search size={10} className="text-gray-400"/>
  }

  return (
    <aside className="w-80 min-w-[320px] border-l border-gray-200 bg-white flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        {view === 'history' ? (
          <button onClick={() => setView('chat')} className="text-gray-400 hover:text-gray-600 transition-colors"><ChevronLeft size={15}/></button>
        ) : (
          <Sparkles size={15} className="text-brand-600"/>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-800 block">{view === 'history' ? 'Histórico de conversas' : 'Pergunte à IA'}</span>
          {view === 'chat' && <span className="text-[10px] text-gray-400">{modeLabel[mode]}</span>}
        </div>
        {view === 'chat' && (
          <>
            <button onClick={startNewConversation} title="Nova conversa" className="text-gray-400 hover:text-brand-600 transition-colors">
              <MessageSquarePlus size={15}/>
            </button>
            <button onClick={() => { setConversations(loadConversations()); setView('history') }} title="Histórico" className="text-gray-400 hover:text-brand-600 transition-colors">
              <History size={14}/>
            </button>
          </>
        )}
        <button onClick={toggleAIPanel} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={14}/>
        </button>
      </div>

      {view === 'history' ? (
        /* ── Histórico ─────────────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <button onClick={startNewConversation} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50/30 text-xs font-semibold text-gray-500 hover:text-brand-600 transition-all mb-2">
            <MessageSquarePlus size={13}/> Nova conversa
          </button>
          {conversations.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-8">Nenhuma conversa salva ainda.</p>
          )}
          {conversations.map(c => (
            <div key={c.id}
              onClick={() => openConversation(c)}
              className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${c.id === conv.id ? 'border-brand-300 bg-brand-50/40' : 'border-gray-100 hover:bg-gray-50'}`}>
              <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center flex-shrink-0">
                <Bot size={13}/>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-800 truncate">{c.title}</p>
                <p className="text-[10px] text-gray-400">{formatRelativeDate(c.updatedAt)} · {c.messages.length} mensagens</p>
              </div>
              <button onClick={e => { e.stopPropagation(); removeConversation(c.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                <Trash2 size={12}/>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {conv.messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Bot size={14} className="text-brand-500"/>
                  Olá! Posso consultar e organizar suas tarefas — peça e eu executo.
                </div>
                {mode === 'none' && (
                  <button onClick={openSettings} className="w-full flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-left hover:bg-amber-100/60 transition-colors">
                    <SettingsIcon size={13} className="text-amber-600 mt-0.5 flex-shrink-0"/>
                    <span className="text-xs text-amber-700">Configure uma chave de IA em Configurações para conversar livremente. Por enquanto, reconheço só alguns comandos diretos.</span>
                  </button>
                )}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Sugestões</p>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => setInput(s)} className="w-full text-left text-xs px-3 py-2 bg-gray-50 hover:bg-brand-50 hover:text-brand-700 rounded-lg transition-colors text-gray-600 border border-gray-100">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {conv.messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0"><Sparkles size={11} className="text-brand-600"/></div>}
                <div className={`max-w-[85%] space-y-1.5 ${m.role === 'user' ? '' : 'flex-1 min-w-0'}`}>
                  {!!m.toolCalls?.length && (
                    <div className="flex flex-col gap-1">
                      {m.toolCalls.map((tc, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[10.5px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 w-fit">
                          {toolIcon(tc.kind)} {tc.summary}
                        </div>
                      ))}
                    </div>
                  )}
                  {m.content && (
                    <div className={`text-xs leading-relaxed px-3 py-2 rounded-xl whitespace-pre-wrap
                      ${m.role === 'user' ? 'bg-brand-600 text-white rounded-br-sm ml-auto w-fit max-w-full' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                      {m.content}
                    </div>
                  )}
                  {m.pendingConfirm && !m.pendingConfirm.resolved && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 space-y-2">
                      <p className="text-[11px] text-red-700 flex items-center gap-1.5"><AlertTriangle size={12}/> Excluir "{m.pendingConfirm.title}"? Isso não pode ser desfeito.</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => resolveConfirm(i, false)} className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white transition-colors">Cancelar</button>
                        <button onClick={() => resolveConfirm(i, true)} className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">Excluir</button>
                      </div>
                    </div>
                  )}
                  {m.pendingConfirm?.resolved && (
                    <p className="text-[10.5px] text-gray-400 flex items-center gap-1">
                      {m.pendingConfirm.resolved === 'confirmed' ? <><Trash2 size={10}/> Excluída</> : <><Info size={10}/> Cancelado</>}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center">
                  <Loader2 size={11} className="text-brand-600 animate-spin"/>
                </div>
                <div className="bg-gray-100 rounded-xl px-3 py-2 text-xs text-gray-500">Pensando...</div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={mode === 'none' ? 'Comandos diretos (ex: criar tarefa...)' : 'Pergunte ou peça uma ação...'}
              className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading}
              className="w-8 h-8 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700 disabled:opacity-40 transition-colors flex-shrink-0">
              <Send size={13}/>
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
