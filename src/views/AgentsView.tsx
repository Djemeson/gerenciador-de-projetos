import React, { useMemo, useState } from 'react'
import { Bot, Plus, Play, Pencil, Trash2, Loader2, Copy, Check } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui'
import { AiKeyNotice } from '../components/ui/AiKeyNotice'
import { VIEW_ICON, VIEW_ICON_KEYS } from '../lib/viewIcons'
import { buildWorkspaceDigest, runAgent, AGENT_TEMPLATES, AGENT_CATEGORIES } from '../lib/agentEngine'
import type { Agent } from '../types'
import { INBOX_PROJECT_ID, PROJECT_COLORS } from '../types'

// ── Avatar de robô (estilo n8n): cara de robô em SVG sobre degradê colorido ──
// Cor determinística por agente (hash do nome sobre a paleta de projetos) —
// cada agente ganha uma "foto" própria sem depender de imagem externa.
function agentColor(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PROJECT_COLORS[h % PROJECT_COLORS.length]
}

export function AgentAvatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const color = agentColor(seed)
  return (
    <div className="rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}B0)`, boxShadow: `0 1px 3px ${color}55` }}>
      <svg width={size * 0.64} height={size * 0.64} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <line x1="12" y1="2.6" x2="12" y2="4.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="12" cy="2.3" r="1.1" fill="#fff"/>
        <rect x="4.6" y="5" width="14.8" height="12.6" rx="4.2" stroke="#fff" strokeWidth="1.7"/>
        <rect x="2.2" y="9.2" width="2" height="4.4" rx="1" fill="#fff"/>
        <rect x="19.8" y="9.2" width="2" height="4.4" rx="1" fill="#fff"/>
        <circle cx="9.2" cy="10.6" r="1.45" fill="#fff"/>
        <circle cx="14.8" cy="10.6" r="1.45" fill="#fff"/>
        <path d="M9 14.2 q3 2.1 6 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
    </div>
  )
}

// Agentes de IA (inspirados nos "superagentes"): instruções próprias + execução
// sob demanda sobre o retrato do workspace. Galeria de modelos por categoria;
// o modelo vira um agente SEU, com instruções editáveis (lib/agentEngine).

const fmtWhen = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function AgentsView() {
  const {
    agents: allAgents, agentRuns, tasks, projects, goals, activeWorkspaceId,
    addAgent, updateAgent, deleteAgent, saveAgentRun,
  } = useAppStore()
  const { geminiApiKey } = useSettingsStore()

  const agents = useMemo(() => allAgents.filter(a => a.workspaceId === activeWorkspaceId), [allAgents, activeWorkspaceId])
  const [editing, setEditing] = useState<Agent | 'new' | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [openOutput, setOpenOutput] = useState<string | null>(null)   // agentId com saída expandida
  const [copied, setCopied] = useState(false)

  const executar = async (agent: Agent) => {
    setRunningId(agent.id)
    try {
      const wsTasks = tasks.filter(t => t.workspaceId === activeWorkspaceId && t.projectId !== INBOX_PROJECT_ID)
      const wsProjects = projects.filter(p => p.workspaceId === activeWorkspaceId)
      const wsGoals = goals.filter(g => g.workspaceId === activeWorkspaceId)
      const digest = buildWorkspaceDigest({ tasks: wsTasks, projects: wsProjects, goals: wsGoals })
      const r = await runAgent(agent, digest, geminiApiKey)
      saveAgentRun({ agentId: agent.id, output: r.output, source: r.source })
      setOpenOutput(agent.id)
    } finally { setRunningId(null) }
  }

  const usarModelo = (tplId: string) => {
    const tpl = AGENT_TEMPLATES.find(t => t.id === tplId); if (!tpl) return
    const a = addAgent({ name: tpl.name, icon: tpl.icon, description: tpl.description, instructions: tpl.instructions, templateId: tpl.id })
    setEditing(a)
  }

  const lastRunOf = (agentId: string) => agentRuns.find(r => r.agentId === agentId)
  const usados = new Set(agents.map(a => a.templateId).filter(Boolean))

  const copiar = async (texto: string) => {
    try { await navigator.clipboard.writeText(texto); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* sem clipboard */ }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-6 py-3.5 border-b border-gray-200 bg-white flex items-center gap-3 flex-shrink-0">
        <Bot size={16} className="text-gray-400"/>
        <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900 flex-1">Agentes de IA</h1>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition-colors">
          <Plus size={14}/> Novo agente
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {!geminiApiKey && <AiKeyNotice/>}

        {/* ── Meus agentes ── */}
        {agents.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Meus agentes</p>
            <div className="space-y-2">
              {agents.map(a => {
                const run = lastRunOf(a.id)
                const aberto = openOutput === a.id && run
                return (
                  <div key={a.id} className="bg-white border border-gray-200/70 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-3">
                      <AgentAvatar seed={a.name} size={38}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-800 truncate">{a.name}</p>
                        <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{a.description}</p>
                        {run && (
                          <button onClick={() => setOpenOutput(aberto ? null : a.id)}
                            className="text-[11px] text-brand-600 hover:text-brand-700 font-medium mt-1">
                            {aberto ? 'Ocultar última execução' : `Ver última execução (${fmtWhen(run.at)}${run.source === 'local' ? ' · modo local' : ''})`}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => executar(a)} disabled={runningId === a.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 ai-gradient-bg text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity">
                          {runningId === a.id ? <Loader2 size={13} className="animate-spin"/> : <Play size={13}/>}
                          {runningId === a.id ? 'Executando…' : 'Executar'}
                        </button>
                        <button onClick={() => setEditing(a)} title="Editar"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><Pencil size={13}/></button>
                        <button onClick={() => deleteAgent(a.id)} title="Excluir"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"><Trash2 size={13}/></button>
                      </div>
                    </div>
                    {aberto && run && (
                      <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {run.source === 'ai' ? 'Resposta do agente (IA)' : 'Modo local — retrato dos dados'}
                          </span>
                          <button onClick={() => copiar(run.output)}
                            className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
                            {copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <p className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap">{run.output}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Galeria de modelos ── */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
            Galeria de agentes {agents.length === 0 && '— ative um para começar'}
          </p>
          <div className="space-y-4">
            {AGENT_CATEGORIES.map(cat => (
              <div key={cat}>
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{cat}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {AGENT_TEMPLATES.filter(t => t.category === cat).map(t => {
                    const jaUsado = usados.has(t.id)
                    return (
                      <div key={t.id} className="flex items-start gap-2.5 px-3.5 py-3 bg-white border border-gray-200/70 rounded-xl">
                        <AgentAvatar seed={t.name} size={30}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-gray-800">{t.name}</p>
                          <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{t.description}</p>
                        </div>
                        <button onClick={() => usarModelo(t.id)} disabled={jaUsado}
                          className="text-[10px] font-bold text-brand-600 hover:text-brand-700 disabled:text-gray-300 flex-shrink-0 mt-0.5">
                          {jaUsado ? 'Ativado' : 'Ativar'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && (
        <AgentEditor
          agent={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={data => {
            if (editing === 'new') addAgent(data)
            else updateAgent(editing.id, data)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function AgentEditor({ agent, onClose, onSave }: {
  agent: Agent | null
  onClose: () => void
  onSave: (data: { name: string; icon: string; description: string; instructions: string }) => void
}) {
  const [name, setName] = useState(agent?.name ?? '')
  const [icon, setIcon] = useState(agent?.icon ?? 'zap')
  const [description, setDescription] = useState(agent?.description ?? '')
  const [instructions, setInstructions] = useState(agent?.instructions ?? '')
  const HeaderIcon = VIEW_ICON[icon] ?? Bot

  return (
    <Modal open onClose={onClose} title={agent ? 'Editar agente' : 'Novo agente'} width="max-w-xl"
      icon={HeaderIcon} iconClassName="ai-gradient-bg"
      subtitle="Nome, papel e instruções — o agente segue isso a cada execução."
      footer={
        <div className="flex gap-2">
          <Button variant="default" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button variant="primary" className="flex-1" disabled={!name.trim() || !instructions.trim()}
            onClick={() => onSave({ name: name.trim(), icon, description: description.trim(), instructions: instructions.trim() })}>
            {agent ? 'Salvar' : 'Criar agente'}
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nome do agente (ex: Resumo Diário da Reunião)"
          className="w-full text-[13px] px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-brand-400"/>
        <div className="flex items-center gap-1.5 flex-wrap">
          {VIEW_ICON_KEYS.map(k => {
            const Icon = VIEW_ICON[k]
            return (
              <button key={k} onClick={() => setIcon(k)} title={k}
                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                  icon === k ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                <Icon size={14}/>
              </button>
            )
          })}
        </div>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição curta (aparece no card)"
          className="w-full text-[12px] px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-brand-400"/>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Instruções (papel e objetivo)</label>
          <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={8}
            placeholder={'O que o agente deve fazer a cada execução?\nEx: "Prepare um resumo do dia com 3 focos, começando pelos atrasos…"'}
            className="w-full text-[12px] px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-brand-400 resize-none leading-relaxed"/>
          <p className="text-[11px] text-gray-400 mt-1.5">
            A cada execução, o agente recebe um retrato do workspace (tarefas, projetos e metas) e segue estas instruções.
            Sem chave de IA, ele devolve o retrato organizado (modo local).
          </p>
        </div>
      </div>
    </Modal>
  )
}
