import type { Task } from '../types'
import { callOpenAIRaw, callGeminiRaw } from './aiProjectGen'
import { parseSmartCapture } from './smartCapture'

// ── Planejar marcos a partir de um texto ────────────────────────────────────
// O usuário descreve, do jeito dele, como quer conduzir o projeto ("primeiro subir o
// ambiente, até dia 20; depois integrar com o OPA; treinar a equipe em novembro") e
// recebe uma proposta de marcos — cada um com tarefas novas e com as tarefas que **já
// existem** no projeto e se encaixam ali. Nada é gravado aqui: a tela mostra a proposta,
// o usuário marca o que quer e só então aplica.
//
// Padrão híbrido do app (DIRETRIZES 15.3): com chave OpenAI/Gemini a IA lê o contexto;
// sem chave (ou se a chamada falhar), o modo local lê a estrutura do texto — cada linha
// vira um marco, os marcadores abaixo dela viram tarefas, e datas escritas ("até 20/10",
// "sexta") viram prazo. Nunca lança exceção.

export interface PlanoMarco {
  titulo:     string
  prazo:      string | null
  descricao:  string
  /** Títulos de tarefas que ainda não existem. */
  novas:      string[]
  /** ids de tarefas do projeto que passam para dentro do marco. */
  existentes: string[]
}

export interface ResultadoPlano { marcos: PlanoMarco[]; usedAI: boolean }

const MAX_EXISTENTES = 80
const DATA = /^\d{4}-\d{2}-\d{2}$/

/** Rótulo com que a IA se refere a cada tarefa existente — o T- quando houver. */
const rotulo = (t: Task, i: number) => (t.seq ? `T-${t.seq}` : `E${i + 1}`)

/**
 * Tarefas que podem entrar num marco: as principais que não são marco. As que já estão
 * dentro de um marco ficam onde estão (mexer nelas desfaria uma organização que o usuário
 * já fez). Abertas primeiro; das concluídas, as mais recentes — o limite protege o prompt
 * de projetos com centenas de tarefas antigas.
 */
export function tarefasElegiveis(tarefas: Task[]): Task[] {
  const ids = new Set(tarefas.map(t => t.id))
  const principais = tarefas.filter(t => (!t.parentId || !ids.has(t.parentId)) && t.taskType !== 'milestone')
  const abertas = principais.filter(t => t.status !== 'done')
  const feitas = principais.filter(t => t.status === 'done')
    .sort((a, b) => String(b.completedAt ?? b.updatedAt).localeCompare(String(a.completedAt ?? a.updatedAt)))
  return [...abertas, ...feitas].slice(0, MAX_EXISTENTES)
}

export function systemPromptMarcos(): string {
  return `Você organiza projetos de um app de gestão de tarefas em MARCOS: etapas com cara de entrega ("Ambiente no ar", "Equipe treinada", "Piloto validado"), cada uma reunindo as tarefas daquela fase. A sequência de marcos conta a jornada do projeto: de onde veio, onde está e para onde vai.

Você recebe o projeto, a data de hoje, os marcos que já existem, as tarefas que já existem (cada uma com um rótulo, ex.: T-12) e o pedido do usuário em texto livre. Entenda a intenção — fases, ordem, prazos, o que já foi feito — mesmo que ele escreva de forma solta.

Regras:
- Proponha de 2 a 6 marcos NOVOS, em ordem cronológica. Não recrie um marco que já existe.
- Título do marco: curto (até 6 palavras), no formato de entrega cumprida — substantivo + resultado ("Integração com o OPA concluída", "Equipe treinada"), nunca um verbo no infinitivo.
- Cada marco tem de 2 a 7 tarefas no total, somando novas e existentes.
- Tarefas existentes: coloque cada uma que se encaixar em NO MÁXIMO um marco, usando o rótulo exato em "tarefas_existentes". Não é preciso usar todas — só as que pertencem a alguma etapa.
- MUITO IMPORTANTE: se algo que a etapa precisa já está na lista de tarefas existentes, use o RÓTULO dela. Nunca copie nem reescreva o título de uma tarefa existente em "tarefas_novas" — isso cria duplicata.
- Tarefas concluídas que formam o começo da história podem compor um primeiro marco já entregue.
- Tarefas novas: ações concretas, começando com verbo ("Configurar webhook do n8n"). Nunca repita, nem com outras palavras, uma tarefa que já existe.
- Prazo (AAAA-MM-DD): só quando o pedido indicar data ou período ("até dia 20", "em novembro", "em duas semanas"), calculado a partir de hoje; prazos crescentes entre os marcos. Sem indicação, use null.
- "descricao": uma frase dizendo o que torna o marco cumprido.
- Escreva em português do Brasil.

Responda SOMENTE com JSON válido, sem markdown, no formato:
{"marcos":[{"titulo":"...","prazo":"AAAA-MM-DD"|null,"descricao":"...","tarefas_novas":["..."],"tarefas_existentes":["T-12"]}]}`
}

export function userPromptMarcos(
  projeto: { nome: string; descricao: string },
  tarefasDoProjeto: Task[],
  pedido: string,
  hoje: string,
  aproveitar: boolean,
): string {
  const marcos = tarefasDoProjeto.filter(t => t.taskType === 'milestone' && !t.parentId)
  const elegiveis = aproveitar ? tarefasElegiveis(tarefasDoProjeto) : []
  const linhasMarcos = marcos.map(m => `- ${m.title}${m.dueDate ? ` (até ${m.dueDate.slice(0, 10)})` : ''}${m.status === 'done' ? ' [concluído]' : ''}`)
  const linhasTarefas = elegiveis.map((t, i) => `- ${rotulo(t, i)} ${t.status === 'done' ? '[concluída] ' : ''}${t.title}`)
  return [
    `Hoje: ${hoje}`,
    `Projeto: ${projeto.nome}`,
    `Descrição: ${projeto.descricao?.trim() || '(sem descrição)'}`,
    '',
    `Marcos que já existem:\n${linhasMarcos.join('\n') || '(nenhum)'}`,
    '',
    aproveitar
      ? `Tarefas que já existem e ainda não estão em marco:\n${linhasTarefas.join('\n') || '(nenhuma)'}`
      : 'O usuário pediu para NÃO aproveitar tarefas existentes: deixe "tarefas_existentes" vazio.',
    '',
    `Pedido do usuário:\n${pedido.trim()}`,
  ].join('\n')
}

/** Valida o JSON da IA contra o projeto real: rótulos inexistentes, repetidos ou datas
 *  inválidas são descartados em silêncio, e tarefa nova igual a uma existente cai fora. */
export function normalizarPlano(raw: unknown, tarefasDoProjeto: Task[], aproveitar: boolean): PlanoMarco[] {
  const lista = Array.isArray((raw as { marcos?: unknown })?.marcos) ? (raw as { marcos: unknown[] }).marcos : []
  const elegiveis = aproveitar ? tarefasElegiveis(tarefasDoProjeto) : []
  const porRotulo = new Map(elegiveis.map((t, i) => [rotulo(t, i).toUpperCase(), t.id]))
  const titulosExistentes = new Set(tarefasDoProjeto.map(t => t.title.trim().toLowerCase()))
  const marcosExistentes = new Set(tarefasDoProjeto.filter(t => t.taskType === 'milestone').map(t => t.title.trim().toLowerCase()))
  const usadas = new Set<string>()
  const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

  const marcos: PlanoMarco[] = []
  for (const item of lista.slice(0, 8)) {
    const m = item as Record<string, unknown>
    const titulo = texto(m.titulo, 120)
    if (!titulo || marcosExistentes.has(titulo.toLowerCase())) continue
    const prazo = typeof m.prazo === 'string' && DATA.test(m.prazo) && !isNaN(Date.parse(m.prazo)) ? m.prazo : null
    const novasVistas = new Set<string>()
    const novas = (Array.isArray(m.tarefas_novas) ? m.tarefas_novas : [])
      .map(s => texto(s, 140))
      .filter(s => {
        const k = s.toLowerCase()
        if (!s || (!aproveitar && titulosExistentes.has(k)) || novasVistas.has(k)) return false
        novasVistas.add(k); return true
      })
      .slice(0, 10)
    const existentes = (Array.isArray(m.tarefas_existentes) ? m.tarefas_existentes : [])
      .map(r => porRotulo.get(String(r).trim().toUpperCase()))
      .filter((id): id is string => !!id && !usadas.has(id) && (usadas.add(id), true))
    marcos.push({ titulo, prazo, descricao: texto(m.descricao, 300), novas, existentes })
  }
  // Testado com o gpt-4o-mini num projeto real: mesmo instruído, ele reescreve tarefas
  // existentes como novas ("Padronizar bairros…" para "Padronização de bairros…"). A
  // instrução reduz; esta checagem é que garante que não nasce duplicata.
  return aproveitar ? reaproveitarParecidas(marcos, tarefasDoProjeto) : marcos
}

// ── Modo local ──────────────────────────────────────────────────────────────
const MARCADOR = /^\s*(?:[-*•–]|\d+[.)]|\[\s?\])\s+/
// O "e" antes do conector vai junto ("… e por fim …"), senão sobra no fim do marco anterior.
// Borda final por lookahead: `\b` não funciona depois de letra acentuada ("último").
const CONECTORES = /\s*(?:;|,?\s*(?:\be\s+)?(?:\bdepois|\bem seguida|\bpor fim|\bpor último|\bfinalmente|\bentão)(?=[\s,.;:]|$))\s*,?\s*/i

const limparTitulo = (s: string) => {
  const t = s.replace(MARCADOR, '').replace(/^(?:fase|etapa|marco)\s*\d*\s*[:–-]\s*/i, '').replace(/[:.\s]+$/, '').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}

/**
 * Sem IA, lê a forma do texto:
 * - linha sem marcador (ou terminada em ":") abre um marco;
 * - linha com marcador ("-", "•", "1.") é tarefa do marco aberto — sem marco aberto, vira marco;
 * - texto corrido numa linha só é cortado nos conectores ("depois", "em seguida", ";").
 * Datas escritas no marco viram prazo (mesmo leitor da captura rápida).
 */
export function planoLocal(pedido: string, agora: Date = new Date()): PlanoMarco[] {
  const linhas = pedido.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim())
  const fontes = linhas.length === 1 && !MARCADOR.test(linhas[0])
    ? linhas[0].split(CONECTORES).map(s => s.trim()).filter(Boolean)
    : linhas

  const marcos: PlanoMarco[] = []
  const novoMarco = (texto: string) => {
    const lido = parseSmartCapture(texto, agora)
    const titulo = limparTitulo(lido.title)
    if (titulo) marcos.push({ titulo, prazo: lido.dueDate, descricao: '', novas: [], existentes: [] })
  }
  for (const l of fontes) {
    const ehItem = MARCADOR.test(l) && marcos.length > 0 && !/:\s*$/.test(l)
    if (ehItem) {
      const tarefa = limparTitulo(l)
      if (tarefa) marcos[marcos.length - 1].novas.push(tarefa)
    } else {
      novoMarco(l)
    }
  }
  return marcos.slice(0, 12)
}

export async function planejarMarcos(
  projeto: { nome: string; descricao: string },
  tarefasDoProjeto: Task[],
  pedido: string,
  opcoes: { aproveitar: boolean; hoje: string; agora?: Date },
  keys: { openAIKey: string; geminiApiKey: string },
): Promise<ResultadoPlano> {
  if (!pedido.trim()) return { marcos: [], usedAI: false }
  const system = systemPromptMarcos()
  const user = userPromptMarcos(projeto, tarefasDoProjeto, pedido, opcoes.hoje, opcoes.aproveitar)
  if (keys.openAIKey.trim()) {
    const marcos = normalizarPlano(await callOpenAIRaw(system, user, keys.openAIKey.trim()), tarefasDoProjeto, opcoes.aproveitar)
    if (marcos.length) return { marcos, usedAI: true }
  }
  if (keys.geminiApiKey.trim()) {
    const marcos = normalizarPlano(await callGeminiRaw(system, user, keys.geminiApiKey.trim()), tarefasDoProjeto, opcoes.aproveitar)
    if (marcos.length) return { marcos, usedAI: true }
  }
  const local = planoLocal(pedido, opcoes.agora)
  return { marcos: opcoes.aproveitar ? reaproveitarParecidas(local, tarefasDoProjeto) : local, usedAI: false }
}

const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Palavras que não distinguem uma tarefa de outra ("criar", "deve ser capaz de"…). */
const VAZIAS = new Set(('a o os as um uma de do da dos das e em no na nos nas para pra por com sem se que ' +
  'ao aos ser deve capaz for caso fazer criar ter mais').split(' '))
/** Radicais (5 letras) das palavras que contam — "padronizar" e "padronização" viram o mesmo. */
const radicais = (s: string) => new Set(normal(s).split(/[^a-z0-9]+/).filter(w => w.length > 1 && !VAZIAS.has(w)).map(w => w.slice(0, 5)))

/**
 * Duas tarefas "dizem a mesma coisa" quando os radicais da menor estão quase todos (80%)
 * na maior. Pela menor, e não pela união: "Analisar o plano e oferecer upgrade" é a mesma
 * tarefa que "Deve ser capaz de analisar o plano do cliente e oferecer um upgrade se for o
 * caso", só mais enxuta. Título de uma palavra só compara por igualdade, para "Testar" não
 * casar com tudo que tenha "testar" dentro.
 */
export function pareceIgual(a: string, b: string): boolean {
  if (normal(a) === normal(b)) return true
  const ra = radicais(a), rb = radicais(b)
  const menor = ra.size <= rb.size ? ra : rb, maior = menor === ra ? rb : ra
  if (menor.size < 2) return false
  let comuns = 0
  menor.forEach(r => { if (maior.has(r)) comuns++ })
  return comuns / menor.size >= 0.8
}

/**
 * Tarefa "nova" que diz o mesmo que uma existente não pode virar duplicata:
 * - se a existente está livre (fora de marco), ela entra no marco no lugar da nova;
 * - se já foi usada em outro marco da proposta, ou já está dentro de um marco, a nova cai.
 * Vale para a IA (que às vezes reescreve o nome) e para o modo local (que só lê o texto).
 */
export function reaproveitarParecidas(marcos: PlanoMarco[], tarefasDoProjeto: Task[]): PlanoMarco[] {
  const livres = tarefasElegiveis(tarefasDoProjeto)
  const livresIds = new Set(livres.map(t => t.id))
  const presas = tarefasDoProjeto.filter(t => !livresIds.has(t.id) && t.taskType !== 'milestone')
  const usadas = new Set(marcos.flatMap(m => m.existentes))
  return marcos.map(m => {
    const novas: string[] = []
    const existentes = [...m.existentes]
    for (const titulo of m.novas) {
      const livre = livres.find(t => pareceIgual(t.title, titulo))
      if (livre) {
        if (!usadas.has(livre.id)) { usadas.add(livre.id); existentes.push(livre.id) }
        continue
      }
      if (presas.some(t => pareceIgual(t.title, titulo))) continue
      novas.push(titulo)
    }
    return { ...m, novas, existentes }
  })
}
