import type { Priority, TaskType } from '../types'

// Tipos de tarefa que fazem sentido a IA GERAR ao planejar um projeto (exclui
// 'meeting_note' e 'form_response', que são preenchidos pelo usuário durante o
// uso — não algo que se planeja com antecedência).
export const AI_ASSIGNABLE_TYPES: TaskType[] = ['task', 'milestone', 'goal', 'objective', 'bug', 'request']

export interface AIGeneratedTask {
  title: string
  description?: string
  priority?: Priority
  taskType?: TaskType
  subtasks?: AIGeneratedTask[]
}

export interface AIGeneratedProject {
  name: string
  description: string
  tasks: AIGeneratedTask[]
}

const OPENAI_MODEL = 'gpt-4o-mini'
const GEMINI_MODEL = 'gemini-2.0-flash'

// Explica a taxonomia de tipos de tarefa do app (mesmos ícones/propósito usados
// na UI — ver TASK_TYPE_META em types.ts e TYPE_ICON em lib/taskTypeIcons.ts)
// para que a IA monte uma hierarquia com significado, não uma lista plana.
const TASK_TYPE_GUIDE = `Tipos de item disponíveis — use o tipo certo para cada papel na hierarquia:
- "milestone" (Marco ◆): um ponto de controle ou entrega importante que marca o fim de uma fase (ex.: "Lançamento da v2", "Evento realizado"). Normalmente é um item de nível principal com várias tarefas abaixo dele.
- "objective" (Objetivo ◎): a meta qualitativa maior do projeto — o "porquê". Use no máximo 1, como primeiro item, só quando fizer sentido destacar o objetivo separado das entregas.
- "goal" (Meta ▲): um resultado mensurável a atingir (ex.: "Reduzir tempo de resposta em 30%"). Use só quando o contexto tiver uma meta numérica/mensurável clara.
- "task" (Tarefa ○): o item padrão — uma ação concreta a ser feita. Use para a maioria dos itens e para quase todas as subtarefas.
- "bug" (Erro ⚙): algo quebrado/incorreto que precisa ser corrigido. Use só se o contexto mencionar um problema, defeito ou correção.
- "request" (Solicitação ◫): um pedido feito por outra pessoa (cliente, stakeholder) que o time precisa atender. Use só se o contexto descrever um pedido de terceiros.
Nunca use "meeting_note" nem "form_response" — não são tipos que se planejam.`

function systemPrompt(): string {
  return `Você é um assistente que transforma contexto em texto livre (ditado por voz ou digitado) em um plano de projeto estruturado e hierárquico, pronto para um app de gestão de tarefas estilo ClickUp.
O usuário NÃO vai listar as tarefas prontas — ele descreve o objetivo/contexto e você é quem INFERE e SUGERE a estrutura de tarefas, organizada de forma que um gestor real usaria.

${TASK_TYPE_GUIDE}

Responda SOMENTE com um JSON válido (sem markdown, sem texto antes ou depois), no formato exato:
{
  "name": "Nome curto do projeto",
  "description": "Descrição de 1 a 3 frases do objetivo do projeto",
  "tasks": [
    {
      "title": "Título do item",
      "description": "Descrição curta (opcional)",
      "priority": "low" | "medium" | "high" | "urgent",
      "taskType": "milestone" | "objective" | "goal" | "task" | "bug" | "request",
      "subtasks": [ { "title": "...", "taskType": "task", "priority": "medium" } ]
    }
  ]
}

Regras do nome:
- "name" é um TÍTULO curto (2 a 6 palavras) — nunca repita a frase do contexto inteira. Ex.: contexto "Precisamos organizar a mudança do escritório até o fim do mês" → name "Mudança de Escritório", não a frase toda.

Regra CRÍTICA — transforme requisitos em TRABALHO, não copie o enunciado:
- O contexto do usuário costuma DESCREVER o produto/funcionalidades desejadas (ex.: "quero botões interativos", "o fluxo faz perguntas com botões", "uma tela que mostra X"). NÃO devolva esses itens como tarefas literais ("Criar botões interativos", "Fazer perguntas com botões") — isso apenas repete o que ele já disse e não ajuda.
- Em vez disso, converta cada funcionalidade/requisito no TRABALHO DE PROJETO necessário para entregá-lo: descoberta, definição de escopo, levantamento de requisitos, desenho do fluxo/arquitetura, prototipação, implementação, testes e validação. Pense "o que precisa ser DECIDIDO, DESENHADO e FEITO para que essa funcionalidade exista?".
- Ex.: contexto "quero um fluxo com botões interativos que fazem perguntas" → tarefas como "Definir o escopo e os objetivos do fluxo interativo", "Mapear as perguntas e as ramificações de decisão", "Desenhar o wireframe do fluxo", "Implementar os componentes de botão e navegação", "Testar o fluxo com usuários" — e NÃO "Criar botões", "Fazer perguntas com botões".
- Comece o projeto (ou cada fase) pelas tarefas de definição/planejamento antes das de execução, como um gestor de projeto real faria.

Regras da hierarquia:
- Cada "milestone" é uma FASE que deve conter várias tarefas dentro dela — nunca crie um "milestone" como item solto sem subtarefas. Se um marco não tiver pelo menos 2 tarefas para agrupar, não use o tipo "milestone" para ele.
- Organize o projeto em torno de 1 a 3 marcos (fases), cada um com as tarefas de execução daquela fase como subtarefas.
- Gere entre 6 e 14 itens no total (somando tarefas e subtarefas) — pense como um gestor de projeto real detalhando o trabalho, não uma lista resumida. Cada marco/tarefa principal pode ter de 2 a 6 subtarefas.
- Subtarefas podem ter suas próprias subtarefas (2 níveis de profundidade) quando uma tarefa for grande o suficiente para ser quebrada ainda mais.
- Varie o "taskType" com propósito — não marque tudo como "task". Use "objective" ou "goal" no topo quando fizer sentido destacar o objetivo/meta separado das entregas.
- Escreva em português (Brasil). Nunca invente informação que contradiga o contexto — apenas organize, estruture e complemente com bom senso de planejamento de projetos, detalhando bastante.`
}

function enrichSystemPrompt(): string {
  return `Você é um assistente que ENRIQUECE um projeto já existente em um app de gestão de tarefas estilo ClickUp, sugerindo NOVOS itens (tarefas, subtarefas e marcos) que ainda não existem.

${TASK_TYPE_GUIDE}

Você receberá o nome/descrição do projeto, a lista de itens que JÁ EXISTEM (não repita nem reformule esses) e, opcionalmente, contexto adicional do usuário. Se não houver contexto adicional, analise as tarefas existentes e sugira o que está faltando para completar o projeto (lacunas óbvias, marcos ainda não cobertos, subtarefas de itens que parecem incompletos).

Regra CRÍTICA — transforme requisitos em TRABALHO, não copie o enunciado: quando o contexto adicional descrever uma funcionalidade/produto desejado (ex.: "botões interativos", "um fluxo que faz perguntas"), NÃO devolva itens literais que só repetem isso ("Criar botões interativos"). Converta cada funcionalidade no trabalho de projeto necessário para entregá-la — definição de escopo, desenho do fluxo, implementação, testes e validação. Comece pelas tarefas de definição/planejamento.

Responda SOMENTE com um JSON válido (sem markdown, sem texto antes ou depois), no formato exato:
{
  "tasks": [
    {
      "title": "Título do novo item",
      "description": "Descrição curta (opcional)",
      "priority": "low" | "medium" | "high" | "urgent",
      "taskType": "milestone" | "objective" | "goal" | "task" | "bug" | "request",
      "subtasks": [ { "title": "...", "taskType": "task", "priority": "medium" } ]
    }
  ]
}
Gere entre 3 e 10 itens novos (contando tarefas e subtarefas). Se sugerir um "milestone", inclua as tarefas dele como subtarefas — nunca um marco sem tarefas dentro. Não repita itens que já existem. Escreva em português (Brasil).`
}

function extractJson(raw: string): any | null {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

function normalizeTaskType(raw: unknown): TaskType {
  return typeof raw === 'string' && (AI_ASSIGNABLE_TYPES as string[]).includes(raw) ? raw as TaskType : 'task'
}

function normalizeTask(raw: any): AIGeneratedTask | null {
  if (!raw || typeof raw.title !== 'string' || !raw.title.trim()) return null
  const priority: Priority = ['low','medium','high','urgent'].includes(raw.priority) ? raw.priority : 'medium'
  const subtasks = Array.isArray(raw.subtasks)
    ? raw.subtasks.map(normalizeTask).filter((t: AIGeneratedTask | null): t is AIGeneratedTask => !!t)
    : []
  return {
    title: raw.title.trim().slice(0, 140),
    description: typeof raw.description === 'string' ? raw.description.trim() : undefined,
    priority,
    taskType: normalizeTaskType(raw.taskType),
    subtasks,
  }
}

function normalizeProject(raw: any, fallbackName: string): AIGeneratedProject | null {
  if (!raw) return null
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map(normalizeTask).filter((t: AIGeneratedTask | null): t is AIGeneratedTask => !!t)
    : []
  if (tasks.length === 0) return null
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : fallbackName,
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    tasks,
  }
}

function normalizeTaskList(raw: any): AIGeneratedTask[] {
  const tasks = Array.isArray(raw?.tasks) ? raw.tasks : []
  return tasks.map(normalizeTask).filter((t: AIGeneratedTask | null): t is AIGeneratedTask => !!t)
}

async function callOpenAIRaw(system: string, user: string, apiKey: string): Promise<any | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    return typeof text === 'string' ? extractJson(text) : null
  } catch {
    return null
  }
}

async function callGeminiRaw(system: string, user: string, apiKey: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
        }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' ? extractJson(text) : null
  } catch {
    return null
  }
}

function fallbackName(instructions: string): string {
  const firstLine = instructions.split(/\n|\.(?!\d)/).map(s => s.trim()).find(Boolean)
  return deriveProjectName(firstLine ?? 'Novo projeto')
}

// Deriva um NOME curto (título) a partir de uma frase de contexto, em vez de
// usar a frase inteira como nome — remove verbos de abertura ("Precisamos",
// "Vamos", "Quero"...) e cláusulas de prazo no final ("até o fim do mês").
// Usado só pelo modo local (a IA real já recebe instrução explícita de gerar
// um título curto).
const LEAD_FILLERS = /^(precisamos?|preciso|vamos|queremos|quero|gostar[íi]amos de|gostaria de|é necessário|necessito|precisa-se de|precisa-se)\s+(de\s+)?/i
const TRAILING_DEADLINE = /\s+(até|para)\s+(o\s+|a\s+)?(fim|final|início|começo|próxim[oa]|dia\s+\d|semana|mês|ano)[^,]*$/i

function deriveProjectName(sentence: string): string {
  const original = sentence.trim().replace(/[.!?]+$/, '')
  let s = original.replace(LEAD_FILLERS, '').replace(TRAILING_DEADLINE, '').trim()
  if (!s) s = original
  s = s.charAt(0).toUpperCase() + s.slice(1)
  return s.slice(0, 60)
}

// Quebra um trecho de texto corrido em candidatos de tarefa mais granulares —
// além do ponto final, também separa por vírgula/ponto e vírgula e pelas
// conjunções "e"/"ou", que é como a maioria das pessoas enumera entregas
// dentro de uma única frase de contexto (ex.: "envolve X, Y, Z e W").
function splitIntoClauses(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|,\s*| e (?=[a-zà-ãéêíóôõúü])| ou (?=[a-zà-ãéêíóôõúü])|;\s*/)
    .map(s => s.replace(/^(e|ou|também|além disso|isso envolve|envolve|inclui|isso inclui|consiste em)\s+/i, '').trim())
    .filter(s => s.length > 3)
}

// Classificação leve por palavras-chave — sem chamada externa, então não é
// "entendimento" de verdade, mas dá alguma variação de tipo (marco/erro/
// solicitação) mesmo no modo local, em vez de tudo virar "task".
const MILESTONE_WORDS = /\b(lan[çc]ar|lan[çc]amento|entregar|entrega final|finalizar|publicar|concluir|apresentar|inaugurar|estreia|realizar o evento)\b/i
const BUG_WORDS = /\b(corrigir|resolver o (bug|erro|problema)|consertar|bug|erro cr[íi]tico)\b/i
const REQUEST_WORDS = /\b(solicita[çc][ãa]o|pedido do cliente|atender (o|a) (pedido|solicita[çc][ãa]o)|a pedido de)\b/i

function guessTaskType(title: string): TaskType {
  if (MILESTONE_WORDS.test(title)) return 'milestone'
  if (BUG_WORDS.test(title)) return 'bug'
  if (REQUEST_WORDS.test(title)) return 'request'
  return 'task'
}

// Um "marco" precisa conter tarefas dentro dele — nunca um item solto. Se a
// classificação por palavra-chave encontrou exatamente um marco entre vários
// itens, transforma o plano num único marco de nível principal com todos os
// outros itens como subtarefas dele (é o melhor palpite possível sem IA real:
// a menção de "lançar/entregar/finalizar" costuma ser o resultado final de
// todas as outras tarefas do parágrafo).
function nestUnderSoleMilestone(tasks: AIGeneratedTask[]): AIGeneratedTask[] {
  const milestoneIdx = tasks.reduce<number[]>((acc, t, i) => (t.taskType === 'milestone' ? [...acc, i] : acc), [])
  if (milestoneIdx.length !== 1 || tasks.length < 2) return tasks
  const [idx] = milestoneIdx
  const milestone = tasks[idx]
  const rest = tasks.filter((_, i) => i !== idx)
  return [{ ...milestone, subtasks: [...rest, ...(milestone.subtasks ?? [])] }]
}

/** Fallback determinístico (sem chamada externa) — organiza as instruções em
 *  tarefas sugeridas a partir do contexto: se vier como lista (linhas/marcadores),
 *  usa cada linha como tarefa; se vier como texto corrido (a forma esperada —
 *  o usuário descreve o objetivo e a IA sugere as tarefas), quebra o parágrafo
 *  em entregas/ações candidatas. Aplica uma classificação simples por palavra-
 *  chave para variar o tipo (marco/erro/solicitação) mesmo sem IA real. Serve
 *  tanto como rede de segurança (falha de rede/chave) quanto para uso sem
 *  nenhuma chave de IA configurada. */
export function buildLocalProjectPlan(instructions: string): AIGeneratedProject {
  const text = instructions.trim()

  const bulletLines = text
    .split('\n')
    .map(l => l.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)

  let name: string
  let taskLines: string[]

  if (bulletLines.length > 1) {
    // Lista explícita: primeira linha vira o nome (encurtado), demais viram tarefas.
    const [first, ...rest] = bulletLines
    name = deriveProjectName(first ?? 'Novo projeto')
    taskLines = rest
  } else {
    // Contexto em texto corrido: primeira frase é o nome/objetivo (encurtado);
    // o restante é quebrado em tarefas sugeridas. Se não houver "restante"
    // (frase única), sugere a partir da própria frase.
    const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
    const [firstSentence, ...restSentences] = sentences
    name = deriveProjectName(firstSentence ?? text ?? 'Novo projeto')
    const rest = restSentences.join(' ')
    taskLines = splitIntoClauses(rest || firstSentence || text)
  }

  taskLines = taskLines.slice(0, 12)

  const flatTasks: AIGeneratedTask[] = (taskLines.length > 0 ? taskLines : [text]).map(line => {
    const title = (line.charAt(0).toUpperCase() + line.slice(1)).replace(/\s+/g, ' ').replace(/[.,;]+$/, '').trim().slice(0, 140)
    return { title, priority: 'medium', taskType: guessTaskType(title), subtasks: [] }
  })

  return {
    name,
    description: text.length > 220 ? text.slice(0, 220).trim() + '…' : text,
    tasks: nestUnderSoleMilestone(flatTasks),
  }
}

/** Gera o plano de projeto a partir de instruções livres. Usa a IA configurada
 *  (OpenAI, senão Gemini); se nenhuma chave estiver presente ou a chamada
 *  falhar, cai no plano local determinístico — assim o recurso sempre funciona,
 *  mesmo em ambiente de teste sem chave de API. */
export async function generateProjectPlan(
  instructions: string,
  keys: { openAIKey: string; geminiApiKey: string }
): Promise<{ plan: AIGeneratedProject; usedAI: boolean }> {
  if (keys.openAIKey.trim()) {
    const raw = await callOpenAIRaw(systemPrompt(), instructions, keys.openAIKey.trim())
    const result = normalizeProject(raw, fallbackName(instructions))
    if (result) return { plan: result, usedAI: true }
  }
  if (keys.geminiApiKey.trim()) {
    const raw = await callGeminiRaw(systemPrompt(), `Contexto do usuário:\n${instructions}`, keys.geminiApiKey.trim())
    const result = normalizeProject(raw, fallbackName(instructions))
    if (result) return { plan: result, usedAI: true }
  }
  return { plan: buildLocalProjectPlan(instructions), usedAI: false }
}

export interface ExistingTaskSummary { title: string; taskType: TaskType; isSubtask: boolean }

/** Enriquece um projeto já existente: sugere tarefas/subtarefas/marcos novos
 *  sem repetir o que já existe. Com IA configurada, analisa nome/descrição do
 *  projeto + itens existentes + contexto adicional opcional. Sem chave, só
 *  consegue gerar algo útil se o usuário fornecer contexto adicional (o modo
 *  local não tem como "descobrir lacunas" em tarefas existentes sem um modelo
 *  de verdade) — nesse caso retorna lista vazia. */
export async function generateProjectEnrichment(
  project: { name: string; description: string; spaceName?: string; folderName?: string },
  existingTasks: ExistingTaskSummary[],
  additionalContext: string,
  keys: { openAIKey: string; geminiApiKey: string }
): Promise<{ tasks: AIGeneratedTask[]; usedAI: boolean }> {
  const existingList = existingTasks
    .map(t => `- [${t.taskType}]${t.isSubtask ? ' (subtarefa)' : ''} ${t.title}`)
    .join('\n')
  // Contexto do container (Espaço → Pasta → Projeto): a pasta/espaço costumam dizer a área
  // ou o tema do projeto, ajudando a IA a sugerir itens coerentes com esse contexto (item 35).
  const containerLine = [
    project.spaceName ? `Espaço: ${project.spaceName}` : '',
    project.folderName ? `Pasta: ${project.folderName}` : '',
  ].filter(Boolean).join('\n')
  const userPrompt = `${containerLine ? containerLine + '\n' : ''}Projeto: ${project.name}\nDescrição: ${project.description || '(sem descrição)'}\n\nItens já existentes:\n${existingList || '(nenhum item ainda)'}\n\n${additionalContext.trim() ? `Contexto adicional do usuário:\n${additionalContext.trim()}` : 'Nenhum contexto adicional foi fornecido — analise as tarefas existentes e sugira o que falta para completar o projeto.'}`

  if (keys.openAIKey.trim()) {
    const raw = await callOpenAIRaw(enrichSystemPrompt(), userPrompt, keys.openAIKey.trim())
    const tasks = normalizeTaskList(raw)
    if (tasks.length > 0) return { tasks, usedAI: true }
  }
  if (keys.geminiApiKey.trim()) {
    const raw = await callGeminiRaw(enrichSystemPrompt(), userPrompt, keys.geminiApiKey.trim())
    const tasks = normalizeTaskList(raw)
    if (tasks.length > 0) return { tasks, usedAI: true }
  }
  if (additionalContext.trim()) {
    const plan = buildLocalProjectPlan(additionalContext.trim())
    const existingTitles = new Set(existingTasks.map(t => t.title.trim().toLowerCase()))
    const deduped = dedupeAgainstTitles(plan.tasks, existingTitles)
    return { tasks: deduped, usedAI: false }
  }
  return { tasks: [], usedAI: false }
}

// O modo local não tem como "saber" o que já existe além de comparar texto —
// sem isso, clicar em "Gerar mais" com o mesmo contexto reprocessaria o mesmo
// texto e duplicaria tudo. Remove (recursivamente) qualquer item cujo título
// já bata (exato, sem caixa) com algo da lista existente.
function dedupeAgainstTitles(tasks: AIGeneratedTask[], existingTitles: Set<string>): AIGeneratedTask[] {
  return tasks
    .filter(t => !existingTitles.has(t.title.trim().toLowerCase()))
    .map(t => ({ ...t, subtasks: dedupeAgainstTitles(t.subtasks ?? [], existingTitles) }))
}

/** Achata uma árvore de itens gerados em uma lista simples de resumo — usado
 *  para descrever "o que já existe" ao pedir mais sugestões (botão "+ Gerar
 *  mais") sobre um plano que ainda está só no preview (não salvo no projeto). */
export function flattenGeneratedTasks(tasks: AIGeneratedTask[], isSubtask = false): ExistingTaskSummary[] {
  return tasks.flatMap(t => [
    { title: t.title, taskType: t.taskType ?? 'task', isSubtask },
    ...flattenGeneratedTasks(t.subtasks ?? [], true),
  ])
}

function checklistSystemPrompt(): string {
  return `Você é um assistente que sugere itens de checklist para uma tarefa de um app de gestão de tarefas — passos curtos, concretos e verificáveis (não frases longas).
Responda SOMENTE com um JSON válido (sem markdown, sem texto antes ou depois), no formato exato: {"items": ["...", "..."]}
Gere entre 3 e 8 itens novos. Não repita itens que já existem. Escreva em português (Brasil).`
}

function normalizeItemList(raw: any): string[] {
  const items = Array.isArray(raw?.items) ? raw.items : []
  return items
    .filter((s: unknown): s is string => typeof s === 'string' && !!s.trim())
    .map((s: string) => s.trim().slice(0, 140))
    .slice(0, 10)
}

/** Sugere itens de checklist para UMA tarefa específica (diferente do plano de
 *  projeto: aqui o retorno é uma lista simples de textos, não uma árvore de
 *  tarefas). Mesmo esquema honesto de fallback: com chave configurada, analisa
 *  título/descrição da tarefa + itens já existentes; sem chave, só consegue
 *  gerar algo a partir de contexto adicional fornecido pelo usuário. */
export async function generateChecklistItems(
  task: { title: string; description: string },
  existingItems: string[],
  additionalContext: string,
  keys: { openAIKey: string; geminiApiKey: string }
): Promise<{ items: string[]; usedAI: boolean }> {
  const userPrompt = `Tarefa: ${task.title}\nDescrição: ${task.description || '(sem descrição)'}\nItens já existentes: ${existingItems.length ? existingItems.join('; ') : '(nenhum)'}\n${additionalContext.trim() ? `Contexto adicional: ${additionalContext.trim()}` : 'Nenhum contexto adicional — sugira a partir do título/descrição da tarefa.'}`

  if (keys.openAIKey.trim()) {
    const raw = await callOpenAIRaw(checklistSystemPrompt(), userPrompt, keys.openAIKey.trim())
    const items = normalizeItemList(raw)
    if (items.length > 0) return { items, usedAI: true }
  }
  if (keys.geminiApiKey.trim()) {
    const raw = await callGeminiRaw(checklistSystemPrompt(), userPrompt, keys.geminiApiKey.trim())
    const items = normalizeItemList(raw)
    if (items.length > 0) return { items, usedAI: true }
  }
  if (additionalContext.trim()) {
    return { items: splitIntoClauses(additionalContext.trim()).slice(0, 8), usedAI: false }
  }
  return { items: [], usedAI: false }
}
