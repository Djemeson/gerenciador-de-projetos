import type { Task } from '../types'
import { callGemini } from './aiSummary'
import { parseISO } from './dateFilter'

// ── Briefing "Começar o dia" ────────────────────────────────────────────────
// Padrão híbrido do app (DIRETRIZES 13.3.2): narrativa local determinística
// sempre disponível; com chave Gemini, sai um plano do dia em prosa.

export interface DailyBriefingInput {
  dateLabel:   string
  dueToday:    Task[]
  overdue:     Task[]
  urgentOpen:  Task[]
  goalsAtRisk: { name: string; reason: string }[]
}

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 } as const

/** As 3 primeiras coisas do dia: atrasada mais antiga → vence hoje (por prioridade) → urgente. */
export function topPriorities(input: DailyBriefingInput): Task[] {
  const seen = new Set<string>()
  const pick = (ts: Task[]) => ts.filter(t => !seen.has(t.id)).forEach(t => { if (result.length < 3) { result.push(t); seen.add(t.id) } })
  const result: Task[] = []
  pick([...input.overdue].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')))
  pick([...input.dueToday].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]))
  pick(input.urgentOpen)
  return result
}

const fmtDia = (iso: string) => {
  try { return parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
  catch { return iso }
}

/** Narrativa local determinística. */
export function buildLocalDailyBriefing(input: DailyBriefingInput): string {
  const { dateLabel, dueToday, overdue, urgentOpen, goalsAtRisk } = input
  const lines: string[] = []
  lines.push(`Plano do dia — ${dateLabel}`)
  lines.push('')

  if (dueToday.length === 0 && overdue.length === 0 && urgentOpen.length === 0) {
    lines.push('Dia limpo: nada vence hoje, nada em atraso, nada urgente em aberto.')
  } else {
    const partes: string[] = []
    if (dueToday.length)   partes.push(`${dueToday.length} vence${dueToday.length > 1 ? 'm' : ''} hoje`)
    if (overdue.length)    partes.push(`${overdue.length} em atraso`)
    if (urgentOpen.length) partes.push(`${urgentOpen.length} urgente${urgentOpen.length > 1 ? 's' : ''} em aberto`)
    lines.push(`Radar: ${partes.join(' · ')}.`)
  }

  const top = topPriorities(input)
  if (top.length > 0) {
    lines.push('')
    lines.push('Comece por aqui:')
    top.forEach((t, i) => {
      const motivo =
        input.overdue.includes(t) ? `em atraso${t.dueDate ? ` desde ${fmtDia(t.dueDate)}` : ''}` :
        input.dueToday.includes(t) ? 'vence hoje' : 'urgente'
      lines.push(`${i + 1}. ${t.title} — ${motivo}`)
    })
  }

  if (goalsAtRisk.length > 0) {
    lines.push('')
    lines.push('Metas pedindo atenção:')
    goalsAtRisk.slice(0, 3).forEach(g => lines.push(`• ${g.name} — ${g.reason}`))
  }

  return lines.join('\n')
}

function buildPrompt(input: DailyBriefingInput): string {
  return `Você é o assistente pessoal de produtividade do usuário. Com base nos dados abaixo,
escreva um briefing matinal curto em português (Brasil): 2 a 4 frases de abertura com o panorama
do dia e depois uma lista numerada "Comece por aqui" com no máximo 3 itens (os mesmos dos dados,
pode reordenar se justificar). Tom direto e encorajador, sem emojis, sem markdown de cabeçalho,
sem inventar tarefas que não estão nos dados.

Dados:
${buildLocalDailyBriefing(input)}

Escreva agora o briefing:`
}

/** Híbrido: Gemini com chave; senão (ou em falha), a narrativa local. */
export async function generateDailyBriefing(input: DailyBriefingInput, geminiApiKey: string): Promise<string> {
  if (geminiApiKey.trim()) {
    const result = await callGemini(buildPrompt(input), geminiApiKey.trim())
    if (result) return result
  }
  return buildLocalDailyBriefing(input)
}
