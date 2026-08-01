import type { Task, Checklist, ContentBlock } from '../types'
import { STATUS_LABEL, PRIORITY_LABEL, TASK_TYPE_META } from '../types'
import { montarZip, bytesDeDataUri, extensaoDe, type ArquivoZip } from './zip'
import { baixarArquivo, nomeSeguro } from './download'
import { parseISO } from './dateFilter'
import { criarFiltroDePendentes } from './taskFilters'
import { htmlParaMarkdown, pareceHtml } from './htmlToMarkdown'

/**
 * Exportação de espaço, pasta, projeto ou tarefa em Markdown.
 *
 * **Para que serve** (pedido de 30/07/2026): produzir um arquivo para entregar ao Claude
 * Code, para que ele execute as tarefas com o máximo de contexto. Por isso o formato não é
 * um relatório de gestão: cada tarefa vira um **título**, e tudo que estava dentro dela
 * (descrição, imagens, anexos, checklists, subtarefas com suas próprias descrições e
 * checklists, comentários) desce como corpo daquele título.
 *
 * **Markdown e não PDF**, que foi o pedido original: o destino é uma IA, e a extração de
 * texto de PDF perde justamente o que importa aqui — nível de subtarefa, estado de
 * checkbox, começo e fim de descrição. Em Markdown isso tudo chega intacto e é o formato
 * que o Claude Code lê melhor.
 *
 * **Imagens e anexos saem como arquivos, não embutidos.** Base64 dentro do `.md` viraria
 * megabytes de texto que nem uma IA consegue interpretar como imagem — só queima contexto.
 * Quando o escopo tem anexo, a exportação vira um `.zip` com o `.md` e uma pasta `anexos/`,
 * e o Markdown referencia por caminho relativo. Assim o Claude Code lê o texto **e** abre
 * as imagens de verdade. Sem anexo nenhum, baixa o `.md` puro.
 */

// ── Utilidades de texto ──────────────────────────────────────────────────────

/** Escapa o que quebraria a estrutura do documento — `#` no começo da linha vira título. */
function escapar(s: unknown): string {
  return String(s ?? '').replace(/\r\n/g, '\n').replace(/^(\s*)(#{1,6}\s)/gm, '$1\\$2')
}

/** Indenta um bloco para caber dentro de um item de lista sem quebrar a lista. */
function indentar(texto: string, espacos: number): string {
  const p = ' '.repeat(espacos)
  return texto.split('\n').map(l => (l.trim() ? p + l : '')).join('\n')
}

/**
 * Usa o `parseISO` do filtro de datas em vez de `new Date(iso)`: prazo é gravado como
 * 'YYYY-MM-DD', e o construtor do Date lê isso como meia-noite **UTC** — em UTC−3 o
 * documento saía com a data do dia anterior. Pego no teste de ponta a ponta: prazo
 * 2026-08-20 exportava como 19/08/2026.
 */
function dataCurta(iso: string): string {
  const d = parseISO(iso)
  return isNaN(+d) ? String(iso) : d.toLocaleDateString('pt-BR')
}

// ── Coletor de anexos ────────────────────────────────────────────────────────

/**
 * Guarda os arquivos que vão para a pasta `anexos/` do zip e devolve o caminho relativo a
 * usar no Markdown. O contador no começo do nome garante unicidade: duas tarefas podem ter
 * anexos com o mesmo nome, e um sobrescreveria o outro dentro do zip.
 */
class Anexos {
  readonly arquivos: ArquivoZip[] = []
  private n = 0

  adicionar(dataUri: string | undefined, nomeOriginal?: string): string | null {
    if (!dataUri) return null
    const conv = bytesDeDataUri(dataUri)
    if (!conv) return null
    this.n++
    const ext  = extensaoDe(conv.mime, nomeOriginal)
    const base = (nomeOriginal ?? `anexo-${this.n}`)
      .replace(/\.[a-z0-9]{1,5}$/i, '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-') || `anexo-${this.n}`
    const caminho = `anexos/${String(this.n).padStart(2, '0')}-${base}.${ext}`
    this.arquivos.push({ nome: caminho, dados: conv.bytes })
    return caminho
  }
}

// ── Pedaços da tarefa ────────────────────────────────────────────────────────

/**
 * Texto vindo do editor é **HTML**, não texto puro — inclusive com `<img>` de base64
 * embutida. Passa pelo conversor, que também manda cada imagem para a pasta de anexos.
 */
function textoMd(texto: string | undefined, anexos: Anexos): string {
  const s = texto?.trim()
  if (!s) return ''
  if (!pareceHtml(s)) return escapar(s)
  return htmlParaMarkdown(s, (src, alt) => anexos.adicionar(src, alt))
}

function blocoMd(b: ContentBlock, anexos: Anexos): string {
  if (b.type === 'text') return textoMd(b.text, anexos)
  const caminho = anexos.adicionar(b.data, b.name)
  const nome = b.name ?? 'arquivo'
  if (b.type === 'image') return caminho ? `![${escapar(nome)}](${caminho})` : `*(imagem não pôde ser lida)*`
  const tam = b.size ? ` — ${Math.round(b.size / 1024)} KB` : ''
  if (!caminho) return `📎 ${escapar(nome)}${tam} *(conteúdo indisponível)*`
  return `📎 [${escapar(nome)}](${caminho})${tam}`
}

function checklistsMd(checklists: Checklist[], nivelTitulo: number): string {
  const comItens = (checklists ?? []).filter(c => c.items?.length)
  if (!comItens.length) return ''
  return comItens.map(c => [
    `${'#'.repeat(nivelTitulo)} Checklist — ${escapar(c.title || 'Sem título')}`,
    '',
    c.items.map(i => `- [${i.done ? 'x' : ' '}] ${escapar(i.text)}`).join('\n'),
  ].join('\n')).join('\n\n')
}

function metaMd(t: Task): string {
  const partes = [
    `**Status:** ${STATUS_LABEL[t.status]}`,
    `**Prioridade:** ${PRIORITY_LABEL[t.priority]}`,
    t.taskType && t.taskType !== 'task' ? `**Tipo:** ${TASK_TYPE_META[t.taskType]?.label ?? t.taskType}` : '',
    t.dueDate  ? `**Prazo:** ${dataCurta(t.dueDate)}` : '',
    t.assignee ? `**Responsável:** ${escapar(t.assignee)}` : '',
  ].filter(Boolean).join(' · ')
  const tags = t.tags?.length ? `\n**Etiquetas:** ${t.tags.map(escapar).join(', ')}` : ''
  return partes + tags
}

/** Descrição, anexos e comentários — o corpo comum a tarefa e subtarefa. */
function corpoMd(t: Task, anexos: Anexos, nivelTitulo: number): string {
  const blocos = t.blocks ?? []
  // `description` é o campo antigo e `blocks` é o editor atual: tarefa criada antes da
  // migração só tem o primeiro, então os dois precisam sair.
  const descricao = [
    textoMd(t.description, anexos),
    ...blocos.filter(b => b.region !== 'attachment').map(b => blocoMd(b, anexos)),
  ].filter(Boolean).join('\n\n')

  const doAnexo = blocos.filter(b => b.region === 'attachment').map(b => blocoMd(b, anexos)).filter(Boolean)

  const comentarios = (t.comments ?? []).map(c => {
    const imagem = c.attachment?.data ? anexos.adicionar(c.attachment.data, c.attachment.name) : null
    const extra = imagem
      ? (c.attachment!.mimeType?.startsWith('image/') ? `\n  ![${escapar(c.attachment!.name)}](${imagem})` : `\n  📎 [${escapar(c.attachment!.name)}](${imagem})`)
      : ''
    const audio = c.audio?.data ? anexos.adicionar(c.audio.data, `audio-comentario`) : null
    // Comentário vira um item de lista: as quebras internas viram espaço para não partir a lista.
    const texto = textoMd(c.text, anexos).replace(/\s*\n+\s*/g, ' ').trim()
    return `- **${escapar(c.author)}** (${dataCurta(c.createdAt)}): ${texto}${extra}${audio ? `\n  🎧 [áudio](${audio})` : ''}`
  })

  const h = '#'.repeat(nivelTitulo)
  return [
    descricao ? `${h} Descrição\n\n${descricao}` : '',
    checklistsMd(t.checklists ?? [], nivelTitulo),
    doAnexo.length ? `${h} Anexos\n\n${doAnexo.map(a => `- ${a}`).join('\n')}` : '',
    comentarios.length ? `${h} Comentários\n\n${comentarios.join('\n')}` : '',
  ].filter(Boolean).join('\n\n')
}

/**
 * Subtarefa como **item de lista** — foi o pedido explícito ("devem ir como itens dessa
 * tarefa") — com descrição e checklists indentados dentro do item, e recursão para os
 * níveis abaixo.
 */
function subtarefaMd(t: Task, filhasDe: (id: string) => Task[], anexos: Anexos, nivel: number): string {
  const marcador = `- [${t.status === 'done' ? 'x' : ' '}] **${escapar(t.title)}** — ${STATUS_LABEL[t.status]} · ${PRIORITY_LABEL[t.priority]}${t.dueDate ? ` · prazo ${dataCurta(t.dueDate)}` : ''}${t.assignee ? ` · ${escapar(t.assignee)}` : ''}`

  const partes: string[] = [marcador]

  const descricao = [
    textoMd(t.description, anexos),
    ...(t.blocks ?? []).map(b => blocoMd(b, anexos)),
  ].filter(Boolean).join('\n\n')
  if (descricao) partes.push(indentar(descricao, 2))

  for (const c of (t.checklists ?? []).filter(c => c.items?.length)) {
    partes.push(indentar(`*${escapar(c.title || 'Checklist')}*`, 2))
    partes.push(indentar(c.items.map(i => `- [${i.done ? 'x' : ' '}] ${escapar(i.text)}`).join('\n'), 2))
  }

  const filhas = filhasDe(t.id)
  if (filhas.length) {
    partes.push(filhas.map(f => indentar(subtarefaMd(f, filhasDe, anexos, nivel + 1), 2)).join('\n'))
  }

  return partes.join('\n\n')
}

function tarefaMd(t: Task, filhasDe: (id: string) => Task[], anexos: Anexos, nivelTitulo: number): string {
  const filhas = filhasDe(t.id)
  const h = '#'.repeat(nivelTitulo)
  const hSub = '#'.repeat(Math.min(nivelTitulo + 1, 6))
  const corpo = corpoMd(t, anexos, Math.min(nivelTitulo + 1, 6))

  return [
    `${h} ${escapar(t.title)}`,
    '',
    metaMd(t),
    corpo ? `\n${corpo}` : '',
    filhas.length
      ? `\n${hSub} Subtarefas (${filhas.length})\n\n${filhas.map(f => subtarefaMd(f, filhasDe, anexos, 1)).join('\n\n')}`
      : '',
  ].filter(l => l !== '').join('\n')
}

// ── Documento ────────────────────────────────────────────────────────────────

export interface ProjetoExportado { nome: string; tarefas: Task[] }

export interface ParamsExportacao {
  /** "Espaço", "Pasta", "Projeto" ou "Tarefa" — aparece no cabeçalho. */
  tipo: string
  titulo: string
  /** Agrupado por projeto: espaço e pasta trazem vários, projeto e tarefa trazem um. */
  projetos: ProjetoExportado[]
  /** Universo de tarefas, usado para resolver subtarefas de qualquer nível. */
  todasTarefas: Task[]
  /**
   * Quando o usuário escolheu **uma tarefa específica**, ela sai mesmo se estiver
   * concluída — pediu aquela. O filtro de concluídas continua valendo para as subtarefas.
   */
  escolhaDireta?: boolean
  /** Injetável para o teste não depender do relógio. */
  agora?: Date
}

export interface ResultadoExportacao {
  markdown: string
  anexos: ArquivoZip[]
}

export function montarMarkdown(p: ParamsExportacao): ResultadoExportacao {
  const porPai = new Map<string, Task[]>()
  for (const t of p.todasTarefas) {
    if (!t.parentId) continue
    const l = porPai.get(t.parentId) ?? []
    l.push(t)
    porPai.set(t.parentId, l)
  }
  const todasFilhasDe = (id: string) => porPai.get(id) ?? []
  const manter = criarFiltroDePendentes(todasFilhasDe)

  // Concluída fica de fora em qualquer nível — o documento é a lista do que **falta** fazer.
  const filhasDe = (id: string) => todasFilhasDe(id).filter(manter)

  const anexos = new Anexos()
  const agruparPorProjeto = p.projetos.length > 1
  const nivelTarefa = agruparPorProjeto ? 3 : 2
  const porProjeto = p.escolhaDireta
    ? p.projetos
    : p.projetos.map(pr => ({ ...pr, tarefas: pr.tarefas.filter(manter) }))
  const total = porProjeto.reduce((n, pr) => n + pr.tarefas.length, 0)
  const data = (p.agora ?? new Date()).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const corpo = porProjeto.map(pr => {
    const cabecalho = agruparPorProjeto ? `## ${escapar(pr.nome)}\n` : ''
    const tarefas = pr.tarefas.length
      ? pr.tarefas.map(t => tarefaMd(t, filhasDe, anexos, nivelTarefa)).join('\n\n---\n\n')
      : '*Nenhuma tarefa pendente neste projeto.*'
    return `${cabecalho}\n${tarefas}`
  }).join('\n\n')

  const markdown = [
    `# ${escapar(p.tipo)}: ${escapar(p.titulo)}`,
    '',
    `> ${total} ${total === 1 ? 'tarefa' : 'tarefas'} · exportado em ${data}`,
    anexos.arquivos.length
      ? `> Anexos na pasta \`anexos/\` deste pacote (${anexos.arquivos.length}).`
      : '',
    '',
    corpo.trim(),
    '',
  ].join('\n')

  return { markdown, anexos: anexos.arquivos }
}

// ── Escopo a partir do estado do app ─────────────────────────────────────────

export type TipoEscopo = 'space' | 'folder' | 'project' | 'task'

export interface DadosDoApp {
  spaces:   { id: string; name: string }[]
  folders:  { id: string; name: string; spaceId: string }[]
  projects: { id: string; name: string; spaceId?: string | null; folderId?: string | null; archived?: boolean }[]
  tasks:    Task[]
}

/**
 * Traduz "exportar este espaço" para a lista de projetos e tarefas correspondente.
 *
 * Duas decisões: **arquivado fica de fora** (quem exporta quer trabalhar no que está ativo),
 * e a lista de cada projeto traz só as tarefas **raiz** — as subtarefas aparecem dentro do
 * pai, não repetidas soltas. Sem isso, uma subtarefa sairia duas vezes no documento.
 */
export function escopoDe(tipo: TipoEscopo, id: string, d: DadosDoApp): ParamsExportacao | null {
  const raizes = (projectId: string) => d.tasks.filter(t => t.projectId === projectId && !t.parentId)
  const doProjeto = (p: { id: string; name: string }): ProjetoExportado => ({ nome: p.name, tarefas: raizes(p.id) })
  const ativos = d.projects.filter(p => !p.archived)

  if (tipo === 'task') {
    const t = d.tasks.find(x => x.id === id)
    if (!t) return null
    const projeto = d.projects.find(p => p.id === t.projectId)
    return { tipo: 'Tarefa', titulo: t.title, projetos: [{ nome: projeto?.name ?? '', tarefas: [t] }], todasTarefas: d.tasks, escolhaDireta: true }
  }

  if (tipo === 'project') {
    const p = d.projects.find(x => x.id === id)
    if (!p) return null
    return { tipo: 'Projeto', titulo: p.name, projetos: [doProjeto(p)], todasTarefas: d.tasks }
  }

  if (tipo === 'folder') {
    const f = d.folders.find(x => x.id === id)
    if (!f) return null
    return { tipo: 'Pasta', titulo: f.name, projetos: ativos.filter(p => p.folderId === id).map(doProjeto), todasTarefas: d.tasks }
  }

  const s = d.spaces.find(x => x.id === id)
  if (!s) return null
  const idsPastas = new Set(d.folders.filter(f => f.spaceId === id).map(f => f.id))
  const doEspaco = ativos.filter(p => p.spaceId === id || (p.folderId && idsPastas.has(p.folderId)))
  return { tipo: 'Espaço', titulo: s.name, projetos: doEspaco.map(doProjeto), todasTarefas: d.tasks }
}

/**
 * Monta e baixa. Com anexo vira `.zip` (Markdown + pasta `anexos/`); sem anexo, `.md` puro
 * — não faz sentido obrigar a descompactar um arquivo de texto.
 */
export function exportarMarkdown(p: ParamsExportacao): { formato: 'md' | 'zip'; anexos: number } {
  const { markdown, anexos } = montarMarkdown(p)
  const base = `${p.tipo}-${p.titulo}`

  if (!anexos.length) {
    baixarArquivo(nomeSeguro(base, 'md'), markdown, 'text/markdown;charset=utf-8')
    return { formato: 'md', anexos: 0 }
  }

  const nomeMd = nomeSeguro(base, 'md')
  const zip = montarZip([
    { nome: nomeMd, dados: new TextEncoder().encode(markdown) },
    ...anexos,
  ], p.agora ?? new Date())
  baixarArquivo(nomeSeguro(base, 'zip'), zip)
  return { formato: 'zip', anexos: anexos.length }
}
