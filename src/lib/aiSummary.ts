import type { Task, Checklist } from '../types'

const GEMINI_MODEL = 'gemini-2.0-flash'

function stripHtml(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function bodyText(task: Task): string {
  const block = task.blocks.find(b => b.type === 'text' && (b.region ?? 'body') === 'body')
  return block?.text ? stripHtml(block.text) : ''
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

/** Resumo local determinístico — sempre disponível, sem chamada externa. */
export function buildLocalSummary(task: Task, subtasks: Task[]): string {
  const lines: string[] = []
  lines.push(`Resumo de conclusão — ${task.title}`)
  lines.push(`Concluída em ${fmtDate(task.updatedAt)}.`)

  const desc = bodyText(task)
  if (desc) {
    lines.push('')
    lines.push('Contexto:')
    lines.push(desc.length > 400 ? desc.slice(0, 400).trim() + '…' : desc)
  }

  if (subtasks.length > 0) {
    const done = subtasks.filter(s => s.status === 'done')
    lines.push('')
    lines.push(`Subtarefas (${done.length}/${subtasks.length} concluídas):`)
    subtasks.forEach(s => lines.push(`• [${s.status === 'done' ? 'x' : ' '}] ${s.title}`))
  }

  if (task.checklists.length > 0) {
    task.checklists.forEach((cl: Checklist) => {
      const total = cl.items.length
      const done  = cl.items.filter(i => i.done).length
      lines.push('')
      lines.push(`Checklist "${cl.title}" (${done}/${total}):`)
      cl.items.forEach(i => lines.push(`• [${i.done ? 'x' : ' '}] ${i.text}`))
    })
  }

  if (subtasks.length === 0 && task.checklists.length === 0 && !desc) {
    lines.push('')
    lines.push('Tarefa concluída sem subtarefas, checklists ou descrição registradas.')
  }

  return lines.join('\n')
}

function buildPrompt(task: Task, subtasks: Task[]): string {
  const desc = bodyText(task)
  const subtaskLines = subtasks.map(s => `- [${s.status === 'done' ? 'feita' : 'não feita'}] ${s.title}`).join('\n')
  const checklistLines = task.checklists
    .map(cl => `${cl.title}:\n` + cl.items.map(i => `  - [${i.done ? 'x' : ' '}] ${i.text}`).join('\n'))
    .join('\n')

  return `Você é um assistente que escreve resumos curtos de conclusão de tarefas para reunião de apresentação de resultados.
Escreva em português (Brasil), em prosa corrida, 3 a 6 frases, direto ao ponto, sem emojis, sem markdown, tom profissional.
Foque no que foi entregue/realizado — não liste tudo mecanicamente, sintetize.

Tarefa: ${task.title}
${desc ? `Descrição: ${desc}\n` : ''}${subtasks.length ? `Subtarefas:\n${subtaskLines}\n` : ''}${task.checklists.length ? `Checklists:\n${checklistLines}\n` : ''}
Escreva agora o resumo de conclusão:`
}

async function callGemini(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch {
    return null
  }
}

/** Híbrido: usa o Gemini de verdade se houver chave configurada; senão (ou em caso
 *  de falha da chamada) cai para o resumo local determinístico. */
export async function generateCompletionSummary(task: Task, subtasks: Task[], geminiApiKey: string): Promise<string> {
  if (geminiApiKey.trim()) {
    const prompt = buildPrompt(task, subtasks)
    const result = await callGemini(prompt, geminiApiKey.trim())
    if (result) return result
  }
  return buildLocalSummary(task, subtasks)
}
