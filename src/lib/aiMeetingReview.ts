import type { Task, Project } from '../types'
import { callGemini } from './aiSummary'
import { parseISO } from './dateFilter'

// ── Resumo para a reunião de resultados ─────────────────────────────────────
// Mesmo padrão híbrido do resumo de conclusão (aiSummary): narrativa local
// determinística sempre disponível; com chave Gemini, o texto sai em prosa
// polida. O texto final é pensado para ser colado direto na apresentação.

export interface MeetingReviewInput {
  periodLabel:   string
  doneNow:       Task[]
  donePrevCount: number
  createdCount:  number
  overdue:       Task[]
  urgentOpen:    Task[]
  dueSoon:       Task[]
  projects:      Pick<Project, 'id' | 'name'>[]
}

const fmtDia = (iso: string) => {
  try { return parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
  catch { return iso }
}

const titulos = (tasks: Task[], max: number) => {
  const shown = tasks.slice(0, max).map(t => `"${t.title}"`).join(', ')
  return tasks.length > max ? `${shown} e mais ${tasks.length - max}` : shown
}

/** Narrativa local determinística — sempre disponível, sem chamada externa. */
export function buildLocalMeetingReview(input: MeetingReviewInput): string {
  const { periodLabel, doneNow, donePrevCount, createdCount, overdue, urgentOpen, dueSoon, projects } = input
  const lines: string[] = []
  lines.push(`Resumo do período — ${periodLabel}`)
  lines.push('')

  // Abertura: entregas × período anterior × entrada de trabalho
  if (doneNow.length === 0) {
    lines.push('Nenhuma tarefa foi concluída no período.')
  } else {
    const tendencia =
      donePrevCount === 0 ? '' :
      doneNow.length > donePrevCount ? ` — acima das ${donePrevCount} do período anterior` :
      doneNow.length < donePrevCount ? ` — abaixo das ${donePrevCount} do período anterior` :
      ' — mesmo ritmo do período anterior'
    lines.push(`Foram concluídas ${doneNow.length} tarefa${doneNow.length > 1 ? 's' : ''}${tendencia}.`)
  }
  if (createdCount > 0) {
    lines.push(`${createdCount} tarefa${createdCount > 1 ? 's' : ''} nova${createdCount > 1 ? 's' : ''} entrara${createdCount > 1 ? 'm' : 'm'} no período${createdCount > doneNow.length ? ' (entrou mais trabalho do que saiu)' : ''}.`)
  }

  // Principais entregas, agrupadas por projeto (top 3)
  if (doneNow.length > 0) {
    const porProjeto = new Map<string, Task[]>()
    for (const t of doneNow) {
      porProjeto.set(t.projectId, [...(porProjeto.get(t.projectId) ?? []), t])
    }
    const top = [...porProjeto.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
    lines.push('')
    lines.push('Principais entregas:')
    for (const [projectId, ts] of top) {
      const nome = projects.find(p => p.id === projectId)?.name ?? 'Sem projeto'
      lines.push(`• ${nome} — ${ts.length} concluída${ts.length > 1 ? 's' : ''}: ${titulos(ts, 3)}`)
    }
  }

  // Pontos de atenção
  if (overdue.length > 0 || urgentOpen.length > 0) {
    lines.push('')
    lines.push('Pontos de atenção:')
    if (overdue.length > 0)    lines.push(`• ${overdue.length} em atraso: ${titulos(overdue, 3)}`)
    if (urgentOpen.length > 0) lines.push(`• ${urgentOpen.length} urgente${urgentOpen.length > 1 ? 's' : ''} em aberto: ${titulos(urgentOpen, 3)}`)
  } else {
    lines.push('')
    lines.push('Sem pontos de atenção: nada em atraso nem urgente em aberto.')
  }

  // Próximos passos
  if (dueSoon.length > 0) {
    lines.push('')
    lines.push('Próximos 7 dias:')
    for (const t of dueSoon.slice(0, 5)) {
      lines.push(`• ${t.title}${t.dueDate ? ` (${fmtDia(t.dueDate)})` : ''}`)
    }
    if (dueSoon.length > 5) lines.push(`• …e mais ${dueSoon.length - 5} com prazo na semana`)
  }

  return lines.join('\n')
}

function buildPrompt(input: MeetingReviewInput): string {
  return `Você prepara o texto que será lido na reunião semanal de apresentação de resultados.
Reescreva os dados abaixo em português (Brasil): um parágrafo de abertura (2 a 3 frases, direto e profissional)
e depois seções curtas em tópicos — "Principais entregas", "Pontos de atenção" (se houver) e "Próximos passos" (se houver).
Sem emojis, sem markdown de cabeçalho (#), sem inventar dados que não estão abaixo.

Dados do período:
${buildLocalMeetingReview(input)}

Escreva agora o texto da reunião:`
}

/** Híbrido: Gemini com chave; senão (ou em falha), a narrativa local. */
export async function generateMeetingReview(input: MeetingReviewInput, geminiApiKey: string): Promise<string> {
  if (geminiApiKey.trim()) {
    const result = await callGemini(buildPrompt(input), geminiApiKey.trim())
    if (result) return result
  }
  return buildLocalMeetingReview(input)
}
