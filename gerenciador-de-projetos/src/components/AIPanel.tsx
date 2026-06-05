import React, { useState, useRef, useEffect } from 'react'
import { X, Send, Sparkles, Loader2, Key, Bot } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { useSettingsStore } from '../stores/useSettingsStore'

interface Message { role: 'user'|'assistant'; content: string }

function buildContext(tasks: ReturnType<typeof useAppStore.getState>['tasks'], projects: ReturnType<typeof useAppStore.getState>['projects']) {
  const active  = tasks.filter(t=>t.status!=='done').slice(0,30)
  const overdue = tasks.filter(t=>t.dueDate&&t.status!=='done'&&new Date(t.dueDate)<new Date()).length
  return `Você é um assistente de produtividade integrado ao TaskFlow. Contexto atual:
- ${projects.filter(p=>!p.archived).length} projetos ativos
- ${active.length} tarefas ativas, ${overdue} em atraso
- Projetos: ${projects.filter(p=>!p.archived).map(p=>`${p.name}(GUT:${p.gut.score})`).join(', ')}
- Tarefas urgentes: ${tasks.filter(t=>t.priority==='urgent'&&t.status!=='done').map(t=>t.title).join(', ')||'nenhuma'}

Quando o usuário pedir para criar tarefas, responda com JSON no formato:
{"action":"create_task","title":"...","projectId":"...","priority":"medium","status":"todo"}

Quando pedir resumo da semana, analise os dados e responda com insights claros.
Seja conciso, direto e sempre em português.`
}

export function AIPanel() {
  const { aiPanelOpen, toggleAIPanel, tasks, projects, quickAddTask } = useAppStore()
  const { openAIKey, updateSetting } = useSettingsStore()
  const [messages,    setMessages]   = useState<Message[]>([])
  const [input,       setInput]      = useState('')
  const [loading,     setLoading]    = useState(false)
  const [apiKeyInput, setApiKeyInput]= useState('')
  const [showKeyForm, setShowKeyForm]= useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  if (!aiPanelOpen) return null

  const hasKey = !!openAIKey

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role:'user', content: input.trim() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization':`Bearer ${openAIKey}`, 'Content-Type':'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role:'system', content: buildContext(tasks, projects) },
            ...history.map(m=>({ role:m.role, content:m.content }))
          ],
          temperature: 0.7,
          max_tokens: 800,
        })
      })
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content ?? 'Erro ao obter resposta.'

      // Try to parse action
      try {
        const json = JSON.parse(reply.match(/\{.*\}/s)?.[0] ?? '')
        if (json.action==='create_task' && json.title) {
          const pid = json.projectId || projects.filter(p=>!p.archived)[0]?.id || ''
          quickAddTask(json.title, pid, json.status||'todo')
          setMessages(p=>[...p, { role:'assistant', content:`✅ Tarefa criada: **${json.title}**\n\n${reply.replace(/\{.*\}/s,'').trim()}` }])
        } else {
          setMessages(p=>[...p, { role:'assistant', content:reply }])
        }
      } catch {
        setMessages(p=>[...p, { role:'assistant', content:reply }])
      }
    } catch (err) {
      setMessages(p=>[...p, { role:'assistant', content:'❌ Erro ao conectar com a OpenAI. Verifique sua API key.' }])
    }
    setLoading(false)
  }

  const saveKey = () => {
    if (apiKeyInput.trim()) { updateSetting('openAIKey', apiKeyInput.trim()); setShowKeyForm(false); setApiKeyInput('') }
  }

  const SUGGESTIONS = [
    'Quais tarefas estão em atraso?',
    'Resuma o status desta semana',
    'Quais são as prioridades urgentes?',
    'Crie uma tarefa para revisar o relatório no projeto Lançamento v2.0',
  ]

  return (
    <aside className="w-80 min-w-[320px] border-l border-gray-200 bg-white flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Sparkles size={15} className="text-brand-600"/>
        <span className="text-sm font-medium text-gray-800 flex-1">Pergunte à IA</span>
        <button onClick={() => setShowKeyForm(v=>!v)} className="text-gray-400 hover:text-gray-600 transition-colors" title="Configurar API key">
          <Key size={13}/>
        </button>
        <button onClick={toggleAIPanel} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={14}/>
        </button>
      </div>

      {showKeyForm && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[11px] text-gray-500 mb-2">OpenAI API Key (sk-...):</p>
          <div className="flex gap-2">
            <input type="password" value={apiKeyInput} onChange={e=>setApiKeyInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&saveKey()}
              placeholder="sk-..."
              className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"/>
            <button onClick={saveKey} className="text-xs px-2 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700">Salvar</button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Armazenado localmente no navegador.</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Bot size={14} className="text-brand-500"/>
              Olá! Como posso ajudar com suas tarefas?
            </div>
            {!hasKey && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                Configure sua OpenAI API key clicando no ícone de chave acima para usar o assistente.
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Sugestões</p>
              {SUGGESTIONS.map(s=>(
                <button key={s} onClick={()=>{setInput(s)}} className="w-full text-left text-xs px-3 py-2 bg-gray-50 hover:bg-brand-50 hover:text-brand-700 rounded-lg transition-colors text-gray-600 border border-gray-100">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m,i)=>(
          <div key={i} className={`flex gap-2 ${m.role==='user'?'justify-end':''}`}>
            {m.role==='assistant'&&<div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0"><Sparkles size={11} className="text-brand-600"/></div>}
            <div className={`max-w-[85%] text-xs leading-relaxed px-3 py-2 rounded-xl whitespace-pre-wrap
              ${m.role==='user'?'bg-brand-600 text-white rounded-br-sm':'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading&&(
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
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}}}
          placeholder="Pergunte algo..."
          disabled={!hasKey}
          className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button onClick={sendMessage} disabled={!input.trim()||loading||!hasKey}
          className="w-8 h-8 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700 disabled:opacity-40 transition-colors">
          <Send size={13}/>
        </button>
      </div>
    </aside>
  )
}
