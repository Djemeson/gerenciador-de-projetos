import type { Task, Project } from '../types'
import { callGemini } from './aiSummary'
import { parseISO } from './dateFilter'

// ── GUT sugerido por IA ─────────────────────────────────────────────────────
// Padrão híbrido (DIRETRIZES 13.3.2): heurística local determinística sobre os
// dados do projeto (prazos, prioridades, tarefas paradas); com chave Gemini, o
// modelo pondera também nome/descrição e devolve JSON estrito.

export interface GutSuggestion { g: number; u: number; t: number; reason: string }

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)))
const DIA = 86_400_000
const STALLED_DAYS = 7

/** Heurística local determinística — sempre disponível, testada. */
export function suggestGutLocal(project: Pick<Project, 'name'>, tasks: Task[], now: Date = new Date()): GutSuggestion {
  const abertas = tasks.filter(t => t.status !== 'done' && !t.parentId)

  // U (urgência): quão perto está o prazo mais apertado
  const comPrazo = abertas.filter(t => t.dueDate)
  const atrasadas = comPrazo.filter(t => parseISO(t.dueDate!) < now)
  let u = 1
  let uMotivo = 'sem prazos definidos'
  if (atrasadas.length > 0) { u = 5; uMotivo = `${atrasadas.length} tarefa${atrasadas.length > 1 ? 's' : ''} já em atraso` }
  else if (comPrazo.length > 0) {
    const dias = Math.min(...comPrazo.map(t => Math.ceil((parseISO(t.dueDate!).getTime() - now.getTime()) / DIA)))
    if (dias <= 3)       { u = 4; uMotivo = `prazo mais apertado em ${dias} dia${dias === 1 ? '' : 's'}` }
    else if (dias <= 7)  { u = 3; uMotivo = 'prazos vencendo na semana' }
    else if (dias <= 30) { u = 2; uMotivo = 'prazos ainda no mês' }
    else                 { u = 1; uMotivo = 'prazos folgados' }
  }

  // G (gravidade): peso das prioridades altas no que está aberto
  const graves = abertas.filter(t => t.priority === 'urgent' || t.priority === 'high')
  const shareGrave = abertas.length ? graves.length / abertas.length : 0
  const g = abertas.length === 0 ? 1 : clamp(1 + shareGrave * 4)
  const gMotivo = abertas.length === 0
    ? 'nenhuma tarefa aberta'
    : `${graves.length} de ${abertas.length} abertas são de prioridade alta/urgente`

  // T (tendência): tarefas paradas indicam que, sem ação, o quadro piora
  const paradas = abertas.filter(t => (now.getTime() - new Date(t.updatedAt).getTime()) / DIA >= STALLED_DAYS)
  const shareParada = abertas.length ? paradas.length / abertas.length : 0
  const t = abertas.length === 0 ? 1 : clamp(1 + shareParada * 3 + (atrasadas.length > 0 ? 1 : 0))
  const tMotivo = paradas.length > 0
    ? `${paradas.length} tarefa${paradas.length > 1 ? 's' : ''} sem movimento há ${STALLED_DAYS}+ dias`
    : 'trabalho em movimento'

  return {
    g, u, t,
    reason: `G ${g}: ${gMotivo}. U ${u}: ${uMotivo}. T ${t}: ${tMotivo}.`,
  }
}

function buildPrompt(project: Pick<Project, 'name' | 'description'>, tasks: Task[], local: GutSuggestion): string {
  const abertas = tasks.filter(t => t.status !== 'done' && !t.parentId)
  return `Você avalia prioridade de projetos pela matriz GUT (Gravidade, Urgência, Tendência), cada dimensão de 1 a 5.
Projeto: ${project.name}
${project.description ? `Descrição: ${project.description}` : ''}
Tarefas abertas (${abertas.length}): ${abertas.slice(0, 15).map(t => `"${t.title}" [${t.priority}${t.dueDate ? `, prazo ${t.dueDate}` : ''}]`).join('; ') || 'nenhuma'}
Leitura automática dos dados: ${local.reason}

Responda SOMENTE com JSON válido neste formato, com "reason" em português (1 a 2 frases):
{"g": n, "u": n, "t": n, "reason": "..."}`
}

/** Híbrido: Gemini com chave (JSON estrito); senão (ou em falha), a heurística local. */
export async function suggestGut(project: Pick<Project, 'name' | 'description'>, tasks: Task[], geminiApiKey: string, now: Date = new Date()): Promise<GutSuggestion> {
  const local = suggestGutLocal(project, tasks, now)
  if (geminiApiKey.trim()) {
    const raw = await callGemini(buildPrompt(project, tasks, local), geminiApiKey.trim())
    if (raw) {
      try {
        const json = JSON.parse(raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''))
        if (typeof json.g === 'number' && typeof json.u === 'number' && typeof json.t === 'number') {
          return { g: clamp(json.g), u: clamp(json.u), t: clamp(json.t), reason: String(json.reason ?? local.reason) }
        }
      } catch { /* JSON inválido — cai na heurística local */ }
    }
  }
  return local
}
