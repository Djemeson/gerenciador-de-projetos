import type { Priority } from '../types'
import { isoDate } from './dateFilter'

// ── Captura inteligente ─────────────────────────────────────────────────────
// "IA local" da captura rápida: entende prazo e prioridade escritos em
// português natural ("ligar pro cliente amanhã urgente", "relatório sexta"),
// sem chamada externa — parser determinístico, sempre disponível e testável.
// O texto reconhecido sai do título; o que foi entendido volta em `matched`
// para a interface mostrar a prévia ("Entendi: prazo amanhã · urgente").

export interface SmartMatch { text: string; kind: 'date' | 'priority'; label: string }

export interface ParsedCapture {
  title:    string
  dueDate:  string | null
  priority: Priority | null
  matched:  SmartMatch[]
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

export function parseSmartCapture(raw: string, now: Date = new Date()): ParsedCapture {
  let title = raw
  let dueDate: string | null = null
  let priority: Priority | null = null
  const matched: SmartMatch[] = []

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

  return { title: title.trim(), dueDate, priority, matched }
}
