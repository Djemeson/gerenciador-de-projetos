import type { Priority, TaskType } from '../types'
import { isoDate } from './dateFilter'

// ── Captura inteligente ─────────────────────────────────────────────────────
// "IA local" da captura rápida: entende prazo e prioridade escritos em
// português natural ("ligar pro cliente amanhã urgente", "relatório sexta"),
// sem chamada externa — parser determinístico, sempre disponível e testável.
// O texto reconhecido sai do título; o que foi entendido volta em `matched`
// para a interface mostrar a prévia ("Entendi: prazo amanhã · urgente").

export interface SmartMatch {
  text: string
  kind: 'date' | 'priority' | 'project' | 'tag' | 'assignee' | 'type'
  label: string
}

export interface ParsedCapture {
  title:     string
  dueDate:   string | null
  priority:  Priority | null
  projectId: string | null
  tags:      string[]
  assignee:  string | null
  taskType:  TaskType | null
  matched:   SmartMatch[]
}

/**
 * Vocabulário do workspace, para o parser reconhecer nomes que só existem nos dados do
 * usuário. Sem isto ele nunca saberia que "Migração de rede" é um projeto.
 */
export interface VocabularioCaptura {
  projetos:      { id: string; name: string }[]
  responsaveis?: string[]
}

const WEEKDAYS: { re: RegExp; day: number }[] = [
  { re: /\bdomingo\b/i, day: 0 },
  { re: /\bsegunda(?:-feira)?\b/i, day: 1 },
  { re: /\bter[çc]a(?:-feira)?\b/i, day: 2 },
  { re: /\bquarta(?:-feira)?\b/i, day: 3 },
  { re: /\bquinta(?:-feira)?\b/i, day: 4 },
  { re: /\bsexta(?:-feira)?\b/i, day: 5 },
  { re: /\bs[áa]bado\b/i, day: 6 },
]

const PRIORITY_WORDS: { re: RegExp; priority: Priority; label: string }[] = [
  { re: /\burgente\b/i,                      priority: 'urgent', label: 'Urgente' },
  { re: /\bimportante\b/i,                   priority: 'high',   label: 'Alta' },
  { re: /\bprioridade alta\b/i,              priority: 'high',   label: 'Alta' },
  { re: /\bsem pressa\b/i,                   priority: 'low',    label: 'Baixa' },
  { re: /\bprioridade baixa\b/i,             priority: 'low',    label: 'Baixa' },
]

const fmtCurta = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

/** Próxima ocorrência do dia da semana (nunca hoje — "sexta" numa sexta = a próxima). */
function proximoDia(now: Date, weekday: number): Date {
  const d = new Date(now)
  const diff = (weekday - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d
}

/** Remove o trecho reconhecido e limpa preposições que ficaram penduradas. */
function limpar(title: string, match: string): string {
  return title
    .replace(match, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+(?:para|pra|na|no|em|at[ée])\s*$/i, '')
    .trim()
}

export function parseSmartCapture(
  raw: string,
  now: Date = new Date(),
  vocab: VocabularioCaptura = { projetos: [] },
): ParsedCapture {
  let title = raw
  let dueDate: string | null = null
  let priority: Priority | null = null
  let projectId: string | null = null
  let assignee: string | null = null
  let taskType: TaskType | null = null
  const tags: string[] = []
  const matched: SmartMatch[] = []

  // ── Etiquetas (#) e responsável (@) ──
  // **Antes de tudo**, de propósito: são marcadores explícitos e delimitam o próprio
  // texto. Rodando depois da prioridade, a etiqueta `#urgente-cliente` era comida pela
  // regra de "urgente" e só metade dela sobrava.
  title = title.replace(/#([\p{L}\p{N}_-]+)/gu, (todo, tag) => {
    tags.push(tag)
    matched.push({ text: todo, kind: 'tag', label: tag })
    return ' '
  })

  const mResp = title.match(/@([\p{L}\p{N}_.-]+)/u)
  if (mResp) {
    const alvo = vocab.responsaveis?.find(r => normalizar(r) === normalizar(mResp[1]))
    assignee = alvo ?? mResp[1]
    matched.push({ text: mResp[0], kind: 'assignee', label: assignee })
    title = limpar(title, mResp[0])
  }


  // ── Prazo ──
  const dateRules: { re: RegExp; resolve: (m: RegExpMatchArray) => Date | null; label?: (d: Date) => string }[] = [
    // `\b` do regex não enxerga acento como letra — "amanhã\b" nunca casa. A borda
    // final é um lookahead explícito (espaço/pontuação/fim) para palavras acentuadas.
    { re: /\bdepois de amanh[ãa](?=[\s,.;:!?]|$)/i, resolve: () => { const d = new Date(now); d.setDate(d.getDate() + 2); return d } },
    { re: /\bamanh[ãa](?=[\s,.;:!?]|$)/i,           resolve: () => { const d = new Date(now); d.setDate(d.getDate() + 1); return d } },
    { re: /\bhoje\b/i,                resolve: () => new Date(now) },
    { re: /\bsemana que vem\b/i,      resolve: () => { const d = new Date(now); d.setDate(d.getDate() + 7); return d } },
    // dd/mm ou dd/mm/aaaa — se a data já passou este ano, assume o ano que vem
    {
      re: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,
      resolve: m => {
        const dia = Number(m[1]), mes = Number(m[2]) - 1
        if (dia < 1 || dia > 31 || mes < 0 || mes > 11) return null
        let ano = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : now.getFullYear()
        const d = new Date(ano, mes, dia)
        if (!m[3] && d < now && d.toDateString() !== now.toDateString()) d.setFullYear(ano + 1)
        return d
      },
    },
  ]

  for (const rule of dateRules) {
    const m = title.match(rule.re)
    if (!m) continue
    const d = rule.resolve(m)
    if (!d) continue
    dueDate = isoDate(d)
    matched.push({ text: m[0], kind: 'date', label: fmtCurta(d) })
    title = limpar(title, m[0])
    break
  }

  // Dia da semana (só se nenhuma regra de data pegou antes)
  if (!dueDate) {
    for (const { re, day } of WEEKDAYS) {
      const m = title.match(re)
      if (!m) continue
      const d = proximoDia(now, day)
      dueDate = isoDate(d)
      matched.push({ text: m[0], kind: 'date', label: `${m[0].toLowerCase()} (${fmtCurta(d)})` })
      title = limpar(title, m[0])
      break
    }
  }

  // ── Prioridade ──
  for (const { re, priority: p, label } of PRIORITY_WORDS) {
    const m = title.match(re)
    if (!m) continue
    priority = p
    matched.push({ text: m[0], kind: 'priority', label })
    title = limpar(title, m[0])
    break
  }

  // ── Tipo de tarefa ──
  // **A palavra continua no título**, ao contrário dos outros campos. "amanhã" e "urgente"
  // são metadado disfarçado de texto e saem; já "reunião com fornecedor" e "bug do login"
  // perdem o sentido sem a primeira palavra — o título viraria "com fornecedor".
  for (const { re, tipo, label } of TYPE_WORDS) {
    const m = title.match(re)
    if (!m) continue
    taskType = tipo
    matched.push({ text: m[0], kind: 'type', label })
    break
  }

  // ── Projeto ──
  // Casa o **nome real** do projeto no texto, do mais longo para o mais curto: com
  // "Rede" e "Rede externa" cadastrados, falar "rede externa" tem que achar o segundo.
  const porTamanho = [...vocab.projetos].sort((a, b) => b.name.length - a.name.length)
  for (const proj of porTamanho) {
    if (proj.name.trim().length < 3) continue   // nome curto demais casaria em qualquer frase
    // Busca no texto **sem acento**, dos dois lados: transcrição de fala e digitação
    // apressada vêm sem acento, e "migracao de rede" precisa achar "Migração de rede".
    // O mapa é 1-para-1 (não `NFD`), então os índices continuam valendo para recortar o
    // trecho do título original.
    //
    // Barras dobradas: dentro de template literal `\b` é backspace e `\s` perde a barra —
    // o `RegExp` precisa receber os dois como texto.
    const re = new RegExp(`(?:\\b(?:no|na|em|do|da|projeto)\\s+)?${escaparRegex(semAcento(proj.name))}(?=[\\s,.;:!?]|$)`, 'i')
    const m = semAcento(title).match(re)
    if (!m || m.index === undefined) continue
    // Recorta do título **original**, para o trecho removido preservar os acentos.
    const trecho = title.slice(m.index, m.index + m[0].length)
    projectId = proj.id
    matched.push({ text: trecho, kind: 'project', label: proj.name })
    title = limpar(title, trecho)
    break
  }

  return { title: title.trim(), dueDate, priority, projectId, tags, assignee, taskType, matched }
}

const TYPE_WORDS: { re: RegExp; tipo: TaskType; label: string }[] = [
  { re: /\b(?:bug|erro|defeito)\b/i,                    tipo: 'bug',          label: 'Erro' },
  { re: /\b(?:reuni[ãa]o|call|daily)(?=[\s,.;:!?]|$)/i, tipo: 'meeting_note', label: 'Anotação de reunião' },
  { re: /\b(?:marco|milestone|entrega)\b/i,             tipo: 'milestone',    label: 'Marco' },
  { re: /\bsolicita[çc][ãa]o(?=[\s,.;:!?]|$)/i,         tipo: 'request',      label: 'Solicitação' },
]

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Tira o acento **preservando o comprimento** — mapa 1-para-1, não `NFD`.
 *
 * `NFD` separa a letra do acento e a string cresce, o que estragaria os índices usados para
 * recortar o trecho do título original. Aqui cada caractere vira exatamente um.
 */
const ACENTOS: Record<string, string> = {
  á:'a', à:'a', ã:'a', â:'a', ä:'a', é:'e', è:'e', ê:'e', ë:'e', í:'i', ì:'i', î:'i', ï:'i',
  ó:'o', ò:'o', õ:'o', ô:'o', ö:'o', ú:'u', ù:'u', û:'u', ü:'u', ç:'c', ñ:'n',
  Á:'A', À:'A', Ã:'A', Â:'A', Ä:'A', É:'E', È:'E', Ê:'E', Ë:'E', Í:'I', Ì:'I', Î:'I', Ï:'I',
  Ó:'O', Ò:'O', Õ:'O', Ô:'O', Ö:'O', Ú:'U', Ù:'U', Û:'U', Ü:'U', Ç:'C', Ñ:'N',
}
const semAcento = (s: string) => s.replace(/[À-ÿ]/g, c => ACENTOS[c] ?? c)
/** Escapa o nome do projeto para virar regex — nome com "(" ou "." é comum. */
const escaparRegex = (s: string) => s.replace(/[-.*+?^${}()|[\]\\]/g, '\\$&')
