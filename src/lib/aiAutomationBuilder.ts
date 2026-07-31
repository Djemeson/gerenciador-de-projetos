import type { AutomationAction, AutomationTrigger, Priority } from '../types'
import { ANY } from '../types'
import { callGemini } from './aiSummary'

// ── Construtor de automação por linguagem natural ───────────────────────────
// "quando faltar 2 dias para o prazo, me avise" → gatilho + ação prontos para
// revisão no editor (nunca salva direto). Padrão híbrido (DIRETRIZES 13.3.2):
// parser local determinístico primeiro; Gemini (JSON estrito) para frases
// mais soltas quando há chave. Falhou tudo → null, e a tela orienta.

export interface AutomationGuess {
  name: string
  projectId: string
  trigger: AutomationTrigger
  action: AutomationAction
}

interface ProjectRef { id: string; name: string }

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Projeto cujo nome (normalizado) aparece no texto. */
function findProjectIn(text: string, projects: ProjectRef[]): ProjectRef | undefined {
  const t = strip(text)
  return projects.find(p => {
    const n = strip(p.name).trim()
    return n.length >= 3 && t.includes(n)
  })
}

const PRIORITY_WORD: Record<string, Priority> = {
  urgente: 'urgent', alta: 'high', media: 'medium', baixa: 'low',
}

/** Parser local determinístico — cobre as formulações mais comuns em pt-BR. */
export function parseAutomationLocal(texto: string, projects: ProjectRef[]): AutomationGuess | null {
  const raw = texto.trim()
  if (!raw) return null
  const t = strip(raw)

  // ── Gatilho ──
  let trigger: AutomationTrigger | null = null
  const antes = t.match(/(\d+)\s*dias?\s*antes/) ?? t.match(/faltar(?:em)?\s*(\d+)\s*dias?/)
  if (antes) trigger = { type: 'due_date_reached', daysBefore: Number(antes[1]) }
  else if (/prazo chegar|no dia do prazo|prazo vencer|vencimento|prazo estourar/.test(t)) trigger = { type: 'due_date_reached', daysBefore: 0 }
  else if (/for concluida|ficar concluida|quando concluir|for finalizada|terminar uma tarefa/.test(t)) trigger = { type: 'status_changed', from: ANY, to: 'done' }
  else if (/entrar em progresso|entrar em andamento|for iniciada|comecar uma tarefa/.test(t)) trigger = { type: 'status_changed', from: ANY, to: 'in_progress' }
  else if (/(ficar|virar|for marcada como|prioridade virar|prioridade for)\s*(urgente|alta|baixa)/.test(t)) {
    const p = t.match(/(urgente|alta|baixa)/)![1]
    trigger = { type: 'priority_changed', from: ANY, to: PRIORITY_WORD[p] }
  }
  else if (/(o|a)?\s*responsavel (mudar|trocar|virar)/.test(t)) trigger = { type: 'assignee_changed', from: ANY, to: ANY }
  else if (/for criada|criar uma tarefa|tarefa nova|nova tarefa|chegar uma tarefa/.test(t)) trigger = { type: 'task_created' }
  if (!trigger) return null

  // ── Ação ── (ordem importa: padrões mais específicos primeiro)
  let action: AutomationAction | null = null
  const etiqueta = t.match(/(?:etiqueta|tag)\s+"?([a-z0-9à-ú_-]+)"?/)
  const prazoDias = t.match(/prazo (?:para|de|em) (?:daqui a )?(\d+)\s*dias?/) ?? t.match(/ganh(?:a|e|ar)\s*(\d+)\s*dias?/)
  const atribuir = t.match(/atribu(?:a|ir|i)\s+(?:a|para)\s+([a-z0-9à-ú]+)/)
  const comentar = raw.match(/coment\w*\s+"([^"]+)"/i)
  const mudarPrio = t.match(/prioridade (?:para|vira[r]?)\s*(urgente|alta|media|baixa)/)
  const mover = /(?:mova|mover|mande|mandar|envie|enviar)\s+para/.test(t)
    ? findProjectIn(t.slice(t.search(/(?:mova|mover|mande|mandar|envie|enviar)\s+para/)), projects)
    : undefined

  if (/resumo/.test(t))                                    action = { type: 'ai_enrich' }
  else if (etiqueta)                                       action = { type: 'add_tag', value: etiqueta[1] }
  else if (mover)                                          action = { type: 'move_project', value: mover.id }
  else if (prazoDias)                                      action = { type: 'set_due_date', value: Number(prazoDias[1]) }
  else if (mudarPrio)                                      action = { type: 'change_priority', value: PRIORITY_WORD[mudarPrio[1]] }
  else if (atribuir)                                       action = { type: 'assign', value: atribuir[1] }
  else if (comentar)                                       action = { type: 'add_comment', value: comentar[1] }
  else if (/(conclua|marque? como concluida|finalize)/.test(t)) action = { type: 'change_status', value: 'done' }
  else if (/(inicie|coloque em progresso|mova para progresso)/.test(t)) action = { type: 'change_status', value: 'in_progress' }
  else if (/avis|notifi|alert|lembr/.test(t)) {
    const msg = raw.match(/"([^"]+)"/)
    action = { type: 'notify', value: msg ? msg[1] : 'Atenção nesta tarefa' }
  }
  if (!action) return null

  // ── Escopo de projeto ("no projeto X" / "do projeto X") ──
  const escopoTrecho = t.match(/(?:no|do) projeto\s+(.{3,40})/)
  const escopo = escopoTrecho ? findProjectIn(escopoTrecho[1], projects) : undefined
  const projectId = escopo && escopo.id !== (action.type === 'move_project' ? action.value : '') ? escopo.id : ANY

  return {
    name: raw.length > 60 ? raw.slice(0, 57) + '…' : raw,
    projectId, trigger, action,
  }
}

const VALID_TRIGGERS = ['task_created', 'status_changed', 'priority_changed', 'assignee_changed', 'due_date_reached']
const VALID_ACTIONS  = ['change_status', 'change_priority', 'assign', 'add_tag', 'set_due_date', 'move_project', 'add_comment', 'notify', 'ai_enrich']

/** Híbrido: parser local primeiro (instantâneo); Gemini para o que ele não entendeu. */
export async function buildAutomation(texto: string, projects: ProjectRef[], geminiApiKey: string): Promise<AutomationGuess | null> {
  const local = parseAutomationLocal(texto, projects)
  if (local) return local
  if (!geminiApiKey.trim()) return null

  const prompt = `Converta a frase do usuário numa regra de automação de tarefas. Responda SOMENTE com JSON válido:
{"name": "nome curto da regra", "projectName": "nome do projeto ou vazio",
 "trigger": {"type": "task_created|status_changed|priority_changed|assignee_changed|due_date_reached", "to": "done|in_progress|todo|urgent|high|medium|low ou vazio", "daysBefore": 0},
 "action": {"type": "change_status|change_priority|assign|add_tag|set_due_date|move_project|add_comment|notify|ai_enrich", "value": "valor da ação"}}
Projetos existentes: ${projects.map(p => p.name).join('; ') || 'nenhum'}
Frase: "${texto.trim()}"`

  const raw = await callGemini(prompt, geminiApiKey.trim())
  if (!raw) return null
  try {
    const j = JSON.parse(raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''))
    if (!VALID_TRIGGERS.includes(j?.trigger?.type) || !VALID_ACTIONS.includes(j?.action?.type)) return null
    const escopo = j.projectName ? findProjectIn(strip(String(j.projectName)), projects) : undefined
    const trigger: AutomationTrigger = { type: j.trigger.type, from: ANY, to: j.trigger.to || ANY }
    if (j.trigger.type === 'due_date_reached') trigger.daysBefore = Number(j.trigger.daysBefore) || 0
    let value: unknown = j.action.value
    if (j.action.type === 'move_project') value = findProjectIn(strip(String(value ?? '')), projects)?.id ?? ''
    if (j.action.type === 'set_due_date') value = Number(value) || 7
    return {
      name: String(j.name || texto.trim()).slice(0, 60),
      projectId: escopo?.id ?? ANY,
      trigger,
      action: { type: j.action.type, value },
    }
  } catch { return null }
}
