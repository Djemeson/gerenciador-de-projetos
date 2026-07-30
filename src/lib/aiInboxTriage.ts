import type { Task, Project } from '../types'
import { callGemini } from './aiSummary'

// ── Triagem da caixa de entrada ─────────────────────────────────────────────
// Sugere para qual projeto cada captura deve ir. Local: afinidade de texto
// entre o título da captura e o nome/descrição/tarefas de cada projeto —
// determinística, sem chamada externa. Com chave Gemini, refina em lote.

export interface TriageSuggestion { projectId: string; confident: boolean }

const STOPWORDS = new Set([
  'de','da','do','das','dos','para','pra','pro','o','a','e','em','no','na','nos','nas',
  'com','um','uma','uns','umas','os','as','que','por','ao','aos','se','ou','ver','fazer',
])

/** Minúsculas sem acento, só letras/números — base de comparação da afinidade. */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ')
}

function tokens(s: string): string[] {
  return normalize(s).split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))
    // Singular/plural simples: "chamados" e "chamado" precisam casar
    .map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
}

/**
 * Afinidade local de uma captura com cada projeto: palavra do título que aparece
 * no NOME do projeto vale 3, na descrição 2, em títulos de tarefas do projeto 1.
 * Sugere o melhor projeto com pontuação >= 2; `confident` quando bateu no nome.
 */
export function suggestProjectLocal(
  task: Pick<Task, 'title'>,
  projects: Pick<Project, 'id' | 'name' | 'description'>[],
  tasksByProject: Map<string, Pick<Task, 'title'>[]>,
): TriageSuggestion | null {
  const words = tokens(task.title)
  if (words.length === 0) return null

  let best: { projectId: string; score: number; nameHit: boolean } | null = null
  for (const p of projects) {
    const nameTokens = new Set(tokens(p.name))
    const descTokens = new Set(tokens(p.description ?? ''))
    const taskTokens = new Set((tasksByProject.get(p.id) ?? []).flatMap(t => tokens(t.title)))
    let score = 0
    let nameHit = false
    for (const w of words) {
      if (nameTokens.has(w)) { score += 3; nameHit = true }
      else if (descTokens.has(w)) score += 2
      else if (taskTokens.has(w)) score += 1
    }
    if (score > 0 && (!best || score > best.score)) best = { projectId: p.id, score, nameHit }
  }
  if (!best || best.score < 2) return null
  return { projectId: best.projectId, confident: best.nameHit }
}

/**
 * Triagem em lote via Gemini (JSON estrito). Devolve um mapa taskId → projectId
 * apenas com as classificações válidas; qualquer falha devolve mapa vazio —
 * quem chama mantém as sugestões locais para o que ficou de fora.
 */
export async function suggestProjectsAI(
  inboxTasks: Pick<Task, 'id' | 'title'>[],
  projects: Pick<Project, 'id' | 'name' | 'description'>[],
  geminiApiKey: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!geminiApiKey.trim() || inboxTasks.length === 0 || projects.length === 0) return out

  const prompt = `Classifique cada captura da caixa de entrada no projeto mais adequado.
Projetos disponíveis:
${projects.map(p => `- id "${p.id}": ${p.name}${p.description ? ` (${p.description})` : ''}`).join('\n')}

Capturas:
${inboxTasks.map(t => `- id "${t.id}": ${t.title}`).join('\n')}

Responda SOMENTE com JSON válido: {"atribuicoes": [{"taskId": "...", "projectId": "..."}]}.
Só inclua a captura se houver um projeto claramente adequado — na dúvida, deixe de fora.`

  const raw = await callGemini(prompt, geminiApiKey.trim())
  if (!raw) return out
  try {
    const json = JSON.parse(raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''))
    const validProject = new Set(projects.map(p => p.id))
    const validTask = new Set(inboxTasks.map(t => t.id))
    for (const item of json.atribuicoes ?? []) {
      if (validTask.has(item?.taskId) && validProject.has(item?.projectId)) out.set(item.taskId, item.projectId)
    }
  } catch { /* JSON inválido — mapa vazio, sugestões locais permanecem */ }
  return out
}
