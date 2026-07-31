import type { Agent, Task, Project, Goal } from '../types'
import { callGemini } from './aiSummary'
import { goalHealth } from './goalMetrics'
import { parseISO } from './dateFilter'

// ── Motor dos Agentes de IA ─────────────────────────────────────────────────
// Um agente é um par nome + instruções ("Role and Objective") executado sob
// demanda sobre um RETRATO do workspace montado localmente. Padrão híbrido
// (DIRETRIZES 13.3.2): com chave Gemini as instruções são seguidas de verdade;
// sem chave, a execução devolve o retrato organizado (modo local honesto).

export interface WorkspaceDigestInput {
  tasks: Task[]
  projects: Project[]
  goals: Goal[]
  now?: Date
}

const fmtDia = (iso: string) => {
  try { return parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
  catch { return iso }
}

/** Retrato compacto e determinístico do workspace — o "contexto" de toda execução. */
export function buildWorkspaceDigest({ tasks, projects, goals, now = new Date() }: WorkspaceDigestInput): string {
  const roots = tasks.filter(t => !t.parentId)
  const abertas = roots.filter(t => t.status !== 'done')
  const atrasadas = abertas.filter(t => t.dueDate && parseISO(t.dueDate) < now)
  const urgentes = abertas.filter(t => t.priority === 'urgent')
  const emProgresso = abertas.filter(t => t.status === 'in_progress')
  const seteDias = new Date(now); seteDias.setDate(seteDias.getDate() - 7)
  const concluidas7d = roots.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= seteDias)

  const lines: string[] = []
  lines.push(`Data de hoje: ${now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`)
  lines.push(`Panorama: ${abertas.length} tarefas abertas (${emProgresso.length} em progresso), ${atrasadas.length} em atraso, ${urgentes.length} urgentes, ${concluidas7d.length} concluídas nos últimos 7 dias.`)

  for (const p of projects.filter(pr => !pr.archived)) {
    const pt = abertas.filter(t => t.projectId === p.id)
    if (pt.length === 0) continue
    lines.push(`\nProjeto "${p.name}" (GUT ${p.gut.score}) — ${pt.length} abertas:`)
    for (const t of pt.slice(0, 8)) {
      const marca = [
        t.status === 'in_progress' ? 'em progresso' : null,
        t.priority !== 'medium' ? t.priority : null,
        t.dueDate ? `prazo ${fmtDia(t.dueDate)}${parseISO(t.dueDate) < now ? ' (ATRASADA)' : ''}` : null,
      ].filter(Boolean).join(', ')
      lines.push(`- ${t.title}${marca ? ` [${marca}]` : ''}`)
    }
    if (pt.length > 8) lines.push(`- …e mais ${pt.length - 8}`)
  }

  if (concluidas7d.length > 0) {
    lines.push('\nConcluídas nos últimos 7 dias:')
    concluidas7d.slice(0, 10).forEach(t => lines.push(`- ${t.title}`))
  }

  if (goals.length > 0) {
    lines.push('\nMetas:')
    for (const g of goals) {
      const h = goalHealth(g, tasks, now)
      lines.push(`- ${g.name}: ${h.progress}% — ${h.reason}`)
    }
  }
  return lines.join('\n')
}

export interface AgentRunResult { output: string; source: 'ai' | 'local' }

/** Executa o agente: Gemini segue as instruções sobre o retrato; sem chave, devolve o retrato. */
export async function runAgent(agent: Agent, digest: string, geminiApiKey: string): Promise<AgentRunResult> {
  if (geminiApiKey.trim()) {
    const prompt = `Você é um agente pessoal chamado "${agent.name}" dentro de um gerenciador de projetos.
Suas instruções (siga à risca, responda em português do Brasil, sem markdown de cabeçalho, sem inventar dados):
${agent.instructions}

Retrato atual do workspace (única fonte de dados — não invente nada além disto):
${digest}

Execute agora as suas instruções:`
    const out = await callGemini(prompt, geminiApiKey.trim())
    if (out) return { output: out, source: 'ai' }
  }
  return {
    output: `Modo local (sem chave de IA): segue o retrato do workspace que o agente usaria.\n\n${digest}`,
    source: 'local',
  }
}

// ── Galeria de modelos (inspirada no marketplace de agentes) ────────────────

export interface AgentTemplate {
  id: string
  category: string
  name: string
  icon: string           // chave de VIEW_ICON
  description: string
  instructions: string
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'resumo-diario', category: 'Produtividade pessoal',
    name: 'Resumo Diário da Reunião', icon: 'clock',
    description: 'Prepara você para a reunião diária: o que avançou, o que está em andamento e os focos do dia.',
    instructions: `Prepare um resumo claro, enxuto e fácil de escanear para a reunião diária, com três seções em tópicos:
1) O que avançou (concluídas recentes); 2) O que está em andamento (em progresso, com riscos ou pendências relevantes);
3) Focos do dia (no máximo 3, começando por atrasos e urgências). Termine com uma frase de leitura geral do dia.`,
  },
  {
    id: 'cobrador-prazos', category: 'Gestão de projetos',
    name: 'Cobrador de Prazos', icon: 'flag',
    description: 'Varre tudo que está atrasado ou vencendo e monta a lista de cobrança em ordem de gravidade.',
    instructions: `Liste as tarefas em atraso (mais antigas primeiro) e as que vencem nos próximos 7 dias, agrupadas por projeto.
Para cada uma, sugira em uma frase a próxima ação (concluir, replanejar prazo ou quebrar em partes menores).
Se não houver nada em risco, diga isso claramente e parabenize.`,
  },
  {
    id: 'relatorio-semanal', category: 'Gestão de projetos',
    name: 'Relatório Semanal de Entregas', icon: 'chart',
    description: 'Escreve o relatório da semana: entregas por projeto, ritmo e pontos de atenção.',
    instructions: `Escreva um relatório curto da semana em prosa profissional: parágrafo de abertura com o ritmo geral
(concluídas × abertas), depois as entregas por projeto em tópicos, e feche com pontos de atenção (atrasos, urgências, metas em risco).
O texto deve estar pronto para colar numa mensagem de prestação de contas.`,
  },
  {
    id: 'planejador-dia', category: 'Produtividade pessoal',
    name: 'Planejador do Dia', icon: 'target',
    description: 'Monta o plano do dia realista: 3 prioridades, o que delegar/adiar e o que ignorar hoje.',
    instructions: `Monte o plano do dia: escolha no máximo 3 prioridades (justifique cada escolha em uma frase, considerando atraso,
urgência e prazo), depois liste o que pode esperar sem culpa. Se houver mais urgência do que cabe num dia, diga o que replanejar.`,
  },
  {
    id: 'guardiao-metas', category: 'Estratégia',
    name: 'Guardião de Metas', icon: 'star',
    description: 'Analisa cada meta, diz quais estão em risco e sugere a ação da semana para cada uma.',
    instructions: `Para cada meta do retrato, avalie o progresso contra o prazo e classifique: no caminho, atenção ou risco.
Para as que não estão no caminho, sugira UMA ação concreta para esta semana. Feche com a meta que mais precisa de atenção.`,
  },
  {
    id: 'faxineiro', category: 'Utilitários',
    name: 'Faxineiro do Workspace', icon: 'pin',
    description: 'Aponta tarefas paradas, sem prazo ou vagas demais — e o que fazer com cada grupo.',
    instructions: `Faça uma auditoria de higiene do workspace: tarefas abertas sem prazo, tarefas com título vago (curto demais ou genérico)
e projetos com muitas tarefas abertas acumuladas. Para cada grupo, recomende uma ação de limpeza objetiva. Seja direto, sem rodeios.`,
  },
]

export const AGENT_CATEGORIES = [...new Set(AGENT_TEMPLATES.map(t => t.category))]
