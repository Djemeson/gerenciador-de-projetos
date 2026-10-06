// As ações que o Claude pode executar no gerenciador (conector MCP, functions/).
//
// Tudo aqui é puro: recebe o documento de sincronização da conta (o mesmo que o app grava
// em syncGroups/{uid}) e devolve o documento alterado + o texto da resposta. Quem lê e
// grava no Firestore é functions/src/conector.ts, dentro de uma transação.
//
// Regras que o app depende que sejam respeitadas (ver src/stores/useAppStore.ts):
// - todo item alterado ganha `updatedAt` novo — é assim que a mescla entre aparelhos sabe
//   que a versão do Claude é a mais recente;
// - campos que esta camada não conhece são preservados (o objeto é copiado, nunca
//   reconstruído), inclusive referências de anexos;
// - `completedAt` só muda na transição de status, como em `updateTask`;
// - excluir tarefa ou projeto passa pela **lixeira** (syncGroups/{uid}/lixeira, só o
//   servidor lê) e dá para restaurar; o id vai para `excluidos` no documento, que é como
//   os aparelhos sabem que o item saiu e não o ressuscitam (src/lib/syncMerge.ts). Os
//   anexos ficam guardados enquanto o item estiver na lixeira.

import { numerar, formatarId, lerIdCurto, mesclarContadores, type Contadores } from './shortIds'
import { normalizarResponsavel, RESPONSAVEL_DJ } from './responsaveis'

export const AUTOR_CLAUDE = 'Claude'

type Obj = { id: string; [k: string]: any }
type Args = Record<string, any>
export interface DocConta {
  tasks: Obj[]; projects: Obj[]; seqCounters?: Contadores
  /** id → quando foi excluído (ms). O app lê e reenvia este mapa — ver syncMerge.ts. */
  excluidos?: Record<string, number>
  [k: string]: unknown
}
/** O que foi para a lixeira numa exclusão: o item principal e tudo que saiu junto. */
export interface EntradaLixeira {
  id: string                    // id interno do item principal (é o id do documento na lixeira)
  tipo: 'task' | 'project'
  seq?: number
  titulo: string
  excluidoEm: string
  projeto?: Obj                 // só quando tipo = 'project'
  tarefas: Obj[]                // a tarefa e suas subtarefas, ou todas as tarefas do projeto
}
export interface Resultado {
  texto: string; alterou: boolean; doc: DocConta
  lixeira?: { entrar?: EntradaLixeira[]; sair?: string[] }
}
export interface Contexto { lixeira?: EntradaLixeira[] }

export class ErroFerramenta extends Error {}

const STATUS: Record<string, string> = { todo: 'A fazer', in_progress: 'Em progresso', waiting: 'Aguardando', paused: 'Pausado', done: 'Concluído' }
const PRIORIDADE: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' }
const INBOX_PROJECT_ID = '__inbox__'

const novoId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
const escaparHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
const textoDeHtml = (s: string) => String(s ?? '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\n{3,}/g, '\n\n').trim()
const dia = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : '')

// ── Definições (o que o Claude vê) ──────────────────────────────────────────
const idTarefa = { type: 'string', description: 'ID curto da tarefa, ex.: "T-142".' }
const idProjeto = { type: 'string', description: 'ID curto do projeto, ex.: "P-12".' }
const REGRA_RESPONSAVEL = 'Toda tarefa tem responsável: "Claude" sempre que o Claude puder executar de algum jeito '
  + '(API, script, computer use, modo manual); "DJ" (o usuário) só quando exige ele — decisão, pagamento, chave ou senha, '
  + 'falar com pessoas, dado pessoal. Outro nome também é aceito.'
const responsavel = { type: 'string', description: REGRA_RESPONSAVEL }

export const DEFINICOES = [
  { name: 'listar_projetos', description: 'Lista os projetos com o ID curto (P-…) e quantas tarefas estão abertas.',
    inputSchema: { type: 'object', properties: { incluir_arquivados: { type: 'boolean' } } } },
  { name: 'listar_tarefas', description: 'Lista as tarefas de um projeto em árvore (subtarefas recuadas), com ID curto e status.',
    inputSchema: { type: 'object', required: ['projeto'], properties: {
      projeto: idProjeto,
      filtro: { type: 'string', enum: ['abertas', 'concluidas', 'todas'], description: 'Padrão: abertas.' } } } },
  { name: 'buscar_tarefas', description: 'Procura tarefas pelo texto do título ou da descrição (até 25 resultados).',
    inputSchema: { type: 'object', required: ['texto'], properties: { texto: { type: 'string' } } } },
  { name: 'ver_tarefa', description: 'Tudo sobre uma tarefa: status, descrição, subtarefas, checklists (com o id de cada item) e os comentários recentes. Use sempre antes de trabalhar numa tarefa — o último comentário "Ponto de parada" diz de onde retomar.',
    inputSchema: { type: 'object', required: ['tarefa'], properties: { tarefa: idTarefa } } },
  { name: 'criar_tarefa', description: 'Cria uma tarefa num projeto (ou uma subtarefa, se "pai" for informado). Devolve o ID curto. Informe sempre o responsável (padrão: DJ).',
    inputSchema: { type: 'object', required: ['titulo'], properties: {
      projeto: { ...idProjeto, description: 'Projeto de destino (obrigatório se não houver "pai").' },
      pai: { ...idTarefa, description: 'Tarefa-mãe, para criar uma subtarefa.' },
      titulo: { type: 'string' },
      descricao: { type: 'string' },
      prioridade: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      prazo: { type: 'string', description: 'Data AAAA-MM-DD.' },
      responsavel: { ...responsavel, description: `${REGRA_RESPONSAVEL} Padrão: "DJ".` } } } },
  { name: 'criar_subtarefas', description: 'Cria várias subtarefas de uma vez sob a mesma tarefa-mãe. Use para partes com vida própria (pode pausar no meio, tem prazo, pode ir para outra pessoa).',
    inputSchema: { type: 'object', required: ['pai', 'titulos'], properties: {
      pai: idTarefa, titulos: { type: 'array', items: { type: 'string' }, minItems: 1 },
      responsavel: { ...responsavel, description: `${REGRA_RESPONSAVEL} Vale para todas as subtarefas criadas; padrão: o responsável da tarefa-mãe.` } } } },
  { name: 'criar_checklist', description: 'Cria um checklist com itens numa tarefa. Use para passos curtos, feitos numa sentada só.',
    inputSchema: { type: 'object', required: ['tarefa', 'titulo', 'itens'], properties: {
      tarefa: idTarefa, titulo: { type: 'string' }, itens: { type: 'array', items: { type: 'string' }, minItems: 1 } } } },
  { name: 'adicionar_itens', description: 'Acrescenta itens a um checklist existente.',
    inputSchema: { type: 'object', required: ['tarefa', 'checklist', 'itens'], properties: {
      tarefa: idTarefa, checklist: { type: 'string', description: 'id do checklist (aparece em ver_tarefa).' },
      itens: { type: 'array', items: { type: 'string' }, minItems: 1 } } } },
  { name: 'marcar_itens', description: 'Marca (ou desmarca) itens de checklist como feitos. Marque cada item assim que terminar, não no fim.',
    inputSchema: { type: 'object', required: ['tarefa', 'itens'], properties: {
      tarefa: idTarefa, itens: { type: 'array', items: { type: 'string' }, description: 'ids dos itens (aparecem em ver_tarefa).', minItems: 1 },
      feito: { type: 'boolean', description: 'Padrão: true.' } } } },
  { name: 'atualizar_tarefa', description: 'Muda status, título, prioridade, prazo ou responsável de uma tarefa. Concluir a última subtarefa conclui a mãe, como no app.',
    inputSchema: { type: 'object', required: ['tarefa'], properties: {
      tarefa: idTarefa,
      status: { type: 'string', enum: ['todo', 'in_progress', 'waiting', 'paused', 'done'] },
      titulo: { type: 'string' },
      prioridade: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      prazo: { type: ['string', 'null'], description: 'AAAA-MM-DD, ou null para remover.' },
      responsavel } } },
  { name: 'comentar', description: 'Registra um comentário na tarefa, assinado pelo Claude. Ao pausar, comece com "Ponto de parada:" e diga o que foi feito, o que falta e o que depende de decisão.',
    inputSchema: { type: 'object', required: ['tarefa', 'texto'], properties: { tarefa: idTarefa, texto: { type: 'string' } } } },
  { name: 'relatorio', description: 'O que aconteceu num período: tarefas concluídas, criadas, itens de checklist marcados e comentários do Claude. Base para resumos e relatórios.',
    inputSchema: { type: 'object', required: ['de', 'ate'], properties: {
      de: { type: 'string', description: 'AAAA-MM-DD (inclusive).' }, ate: { type: 'string', description: 'AAAA-MM-DD (inclusive).' },
      projeto: { ...idProjeto, description: 'Opcional: só este projeto.' } } } },
  { name: 'mover_tarefa', description: 'Move uma tarefa (com as subtarefas) para outro projeto, ou a pendura/solta de uma tarefa-mãe.',
    inputSchema: { type: 'object', required: ['tarefa'], properties: {
      tarefa: idTarefa,
      projeto: { ...idProjeto, description: 'Projeto de destino. Sem "pai", a tarefa vira tarefa principal lá.' },
      pai: { type: 'string', description: 'Nova tarefa-mãe (T-…), ou "nenhuma" para virar tarefa principal.' } } } },
  { name: 'editar_descricao', description: 'Escreve a descrição da tarefa. "acrescentar" (padrão) adiciona ao fim; "substituir" troca o texto (recusado se a descrição tiver imagem ou arquivo, para não apagá-los).',
    inputSchema: { type: 'object', required: ['tarefa', 'texto'], properties: {
      tarefa: idTarefa, texto: { type: 'string' }, modo: { type: 'string', enum: ['acrescentar', 'substituir'] } } } },
  { name: 'definir_etiquetas', description: 'Define as etiquetas da tarefa (substitui a lista inteira; lista vazia remove todas).',
    inputSchema: { type: 'object', required: ['tarefa', 'etiquetas'], properties: {
      tarefa: idTarefa, etiquetas: { type: 'array', items: { type: 'string' } } } } },
  { name: 'editar_item', description: 'Troca o texto de um item de checklist.',
    inputSchema: { type: 'object', required: ['tarefa', 'item', 'texto'], properties: {
      tarefa: idTarefa, item: { type: 'string', description: 'id do item (aparece em ver_tarefa).' }, texto: { type: 'string' } } } },
  { name: 'excluir_itens', description: 'Remove itens de checklist. Não passa pela lixeira: use para limpeza de itens que não fazem mais sentido.',
    inputSchema: { type: 'object', required: ['tarefa', 'itens'], properties: {
      tarefa: idTarefa, itens: { type: 'array', items: { type: 'string' }, minItems: 1 } } } },
  { name: 'excluir_checklist', description: 'Remove um checklist inteiro da tarefa. Não passa pela lixeira.',
    inputSchema: { type: 'object', required: ['tarefa', 'checklist'], properties: {
      tarefa: idTarefa, checklist: { type: 'string', description: 'id do checklist (aparece em ver_tarefa).' } } } },
  { name: 'criar_projeto', description: 'Cria um projeto novo (fica na raiz; o usuário organiza em espaço/pasta pelo app). Devolve o P-….',
    inputSchema: { type: 'object', required: ['nome'], properties: {
      nome: { type: 'string' }, descricao: { type: 'string' }, cor: { type: 'string', description: 'Hex, ex.: #6366F1.' } } } },
  { name: 'excluir_tarefa', description: 'Exclui uma tarefa e as subtarefas dela. Vai para a lixeira (restaurar desfaz). Confirme com o usuário antes, citando ID e título.',
    inputSchema: { type: 'object', required: ['tarefa'], properties: { tarefa: idTarefa } } },
  { name: 'excluir_projeto', description: 'Exclui um projeto e todas as tarefas dele. Vai para a lixeira (restaurar desfaz). Confirme com o usuário antes, dizendo quantas tarefas vão junto.',
    inputSchema: { type: 'object', required: ['projeto'], properties: { projeto: idProjeto } } },
  { name: 'listar_lixeira', description: 'Mostra o que foi excluído pelo conector e pode ser restaurado.',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'restaurar', description: 'Traz de volta da lixeira uma tarefa (com subtarefas) ou um projeto (com as tarefas), pelo ID que tinha.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string', description: 'T-… ou P-… do item excluído.' } } } },
] as const

// ── Consultas auxiliares ────────────────────────────────────────────────────
function achar(doc: DocConta, tipo: 'task' | 'project', ref: unknown): Obj {
  const id = lerIdCurto(String(ref ?? ''))
  if (!id || id.tipo !== tipo) throw new ErroFerramenta(`"${ref}" não é um ID de ${tipo === 'task' ? 'tarefa (ex.: T-142)' : 'projeto (ex.: P-12)'}.`)
  const lista = tipo === 'task' ? doc.tasks : doc.projects
  const item = lista.find(i => i.seq === id.seq)
  if (!item) throw new ErroFerramenta(`${formatarId(tipo, id.seq)} não existe (pode ter sido excluída).`)
  return item
}
const nomeProjeto = (doc: DocConta, projectId: string) =>
  projectId === INBOX_PROJECT_ID ? 'Caixa de entrada' : (doc.projects.find(p => p.id === projectId)?.name ?? '—')
const refProjeto = (doc: DocConta, projectId: string) => {
  const p = doc.projects.find(x => x.id === projectId)
  return p ? `${formatarId('project', p.seq)} ${p.name}` : nomeProjeto(doc, projectId)
}
const linhaTarefa = (t: Obj) => `${formatarId('task', t.seq)} [${STATUS[t.status] ?? t.status}] ${t.title}`
const checklistsResumo = (t: Obj) => {
  const itens = (t.checklists ?? []).flatMap((c: Obj) => c.items ?? [])
  return itens.length ? ` · checklist ${itens.filter((i: Obj) => i.done).length}/${itens.length}` : ''
}

function arvore(tarefas: Obj[], todas: Obj[]): string[] {
  const filhos = (id: string) => todas.filter(t => t.parentId === id)
  const ids = new Set(tarefas.map(t => t.id))
  const raiz = tarefas.filter(t => !t.parentId || !ids.has(t.parentId))
  const out: string[] = []
  const visitar = (t: Obj, nivel: number) => {
    out.push(`${'  '.repeat(nivel)}- ${linhaTarefa(t)}${checklistsResumo(t)}`)
    filhos(t.id).filter(f => ids.has(f.id)).forEach(f => visitar(f, nivel + 1))
  }
  raiz.forEach(t => visitar(t, 0))
  return out
}

// ── Escrita ─────────────────────────────────────────────────────────────────
function comTarefa(doc: DocConta, id: string, muda: (t: Obj) => Obj, agora: string): DocConta {
  return { ...doc, tasks: doc.tasks.map(t => (t.id === id ? { ...muda(t), updatedAt: agora } : t)) }
}

/** Mesmo efeito de `updateTask` no app para status: completedAt e a regra da tarefa-mãe. */
function mudarStatus(doc: DocConta, id: string, status: string, agora: string): DocConta {
  const antes = doc.tasks.find(t => t.id === id)
  if (!antes || antes.status === status) return doc
  let d = comTarefa(doc, id, t => ({ ...t, status, completedAt: status === 'done' ? agora : null }), agora)
  if (antes.parentId) {
    const mae = d.tasks.find(t => t.id === antes.parentId)
    const irmas = d.tasks.filter(t => t.parentId === antes.parentId)
    const todasFeitas = irmas.every(t => t.status === 'done')
    if (mae && todasFeitas && mae.status !== 'done') d = mudarStatus(d, mae.id, 'done', agora)
    else if (mae && !todasFeitas && mae.status === 'done') d = mudarStatus(d, mae.id, 'in_progress', agora)
  }
  return d
}

/** Responsável informado pelo Claude: "claude" → "Claude", "djemeson" → "DJ"; vazio é recusado. */
function lerResponsavel(valor: unknown): string {
  const nome = normalizarResponsavel(valor)
  if (!nome) throw new ErroFerramenta('Toda tarefa tem responsável: informe "Claude", "DJ" ou outro nome.')
  return nome
}

function novaTarefa(doc: DocConta, dados: { titulo: string; projeto?: Obj; pai?: Obj; descricao?: string; prioridade?: string; prazo?: string; responsavel?: string }, agora: string): Obj {
  const projectId = dados.pai?.projectId ?? dados.projeto?.id
  const workspaceId = dados.pai?.workspaceId ?? dados.projeto?.workspaceId ?? 'default'
  const titulo = String(dados.titulo ?? '').trim()
  if (!titulo) throw new ErroFerramenta('O título não pode ficar vazio.')
  return {
    id: novoId(), workspaceId, projectId, parentId: dados.pai?.id ?? null,
    title: titulo, description: '',
    blocks: dados.descricao ? [{ id: novoId(), type: 'text', text: escaparHtml(dados.descricao), region: 'body' }] : [],
    status: 'todo', priority: dados.prioridade ?? (dados.pai ? 'low' : 'medium'), taskType: 'task',
    dueDate: dados.prazo ?? null, assignee: dados.responsavel ?? RESPONSAVEL_DJ, tags: [], checklists: [], customFields: {}, comments: [],
    createdAt: agora, updatedAt: agora, completedAt: null,
  }
}

/** Numera o que entrou (mesma regra do app) e devolve o doc com o contador atualizado. */
function numerarDoc(doc: DocConta): DocConta {
  const c = mesclarContadores(doc.seqCounters, undefined)
  const t = numerar(doc.tasks, c.task)
  const p = numerar(doc.projects, c.project)
  return { ...doc, tasks: t.itens, projects: p.itens, seqCounters: { task: t.contador, project: p.contador } }
}

// ── Execução ────────────────────────────────────────────────────────────────
/** A tarefa e todas as descendentes (a exclusão e a mudança de projeto levam o galho inteiro). */
function galho(doc: DocConta, raizId: string): Obj[] {
  const ids = new Set([raizId])
  let cresceu = true
  while (cresceu) {
    cresceu = false
    for (const t of doc.tasks) if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) { ids.add(t.id); cresceu = true }
  }
  return doc.tasks.filter(t => ids.has(t.id))
}

function marcarExcluidos(doc: DocConta, ids: string[], agoraMs: number): Record<string, number> {
  const mapa = { ...(doc.excluidos ?? {}) }
  ids.forEach(id => { mapa[id] = agoraMs })
  return mapa
}

export function executar(nome: string, args: Args, docOriginal: DocConta, agora = new Date().toISOString(), ctx: Contexto = {}): Resultado {
  // Conta que nunca abriu a versão com IDs ainda não tem números: o servidor numera com a
  // mesma regra determinística do app, então os dois chegam aos mesmos T-/P-.
  let doc = numerarDoc({ ...docOriginal, tasks: docOriginal.tasks ?? [], projects: docOriginal.projects ?? [] })
  const antes = mesclarContadores(docOriginal.seqCounters, undefined)
  const numerou = doc.tasks !== docOriginal.tasks || doc.projects !== docOriginal.projects
    || doc.seqCounters!.task !== antes.task || doc.seqCounters!.project !== antes.project
  const ok = (texto: string, novo?: DocConta): Resultado =>
    ({ texto, alterou: !!novo || numerou, doc: novo ? numerarDoc(novo) : doc })

  switch (nome) {
    case 'listar_projetos': {
      const linhas = doc.projects
        .filter(p => args.incluir_arquivados || !p.archived)
        .map(p => {
          const ts = doc.tasks.filter(t => t.projectId === p.id)
          const abertas = ts.filter(t => t.status !== 'done').length
          return `- ${formatarId('project', p.seq)} ${p.name}${p.archived ? ' (arquivado)' : ''} · ${abertas} abertas de ${ts.length}`
        })
      return ok(linhas.length ? linhas.join('\n') : 'Nenhum projeto.')
    }

    case 'listar_tarefas': {
      const p = achar(doc, 'project', args.projeto)
      const filtro = args.filtro ?? 'abertas'
      const todas = doc.tasks.filter(t => t.projectId === p.id)
      const escolhidas = todas.filter(t => filtro === 'todas' || (filtro === 'concluidas' ? t.status === 'done' : t.status !== 'done'))
      const linhas = arvore(escolhidas, todas)
      return ok(`${formatarId('project', p.seq)} ${p.name} — ${filtro}\n${linhas.length ? linhas.join('\n') : '(nenhuma)'}`)
    }

    case 'buscar_tarefas': {
      const q = String(args.texto ?? '').trim().toLowerCase()
      if (!q) throw new ErroFerramenta('Informe o texto a buscar.')
      const achadas = doc.tasks
        .filter(t => String(t.title).toLowerCase().includes(q) || textoDeHtml((t.blocks ?? []).map((b: Obj) => b.text ?? '').join(' ')).toLowerCase().includes(q))
        .slice(0, 25)
      return ok(achadas.length ? achadas.map(t => `- ${linhaTarefa(t)} · ${refProjeto(doc, t.projectId)}`).join('\n') : 'Nada encontrado.')
    }

    case 'ver_tarefa': {
      const t = achar(doc, 'task', args.tarefa)
      const mae = t.parentId ? doc.tasks.find(x => x.id === t.parentId) : null
      const subs = doc.tasks.filter(x => x.parentId === t.id)
      const descricao = textoDeHtml((t.blocks ?? []).filter((b: Obj) => b.type === 'text').map((b: Obj) => b.text).join('\n') || t.description)
      const partes = [
        `${formatarId('task', t.seq)} ${t.title}`,
        `Projeto: ${refProjeto(doc, t.projectId)}${mae ? ` · Tarefa-mãe: ${linhaTarefa(mae)}` : ''}`,
        `Status: ${STATUS[t.status] ?? t.status} · Prioridade: ${PRIORIDADE[t.priority] ?? t.priority}${t.dueDate ? ` · Prazo: ${dia(t.dueDate)}` : ''} · Responsável: ${t.assignee || '(ninguém)'}`,
        `Criada em ${dia(t.createdAt)}${t.completedAt ? ` · Concluída em ${dia(t.completedAt)}` : ''}`,
      ]
      if (descricao) partes.push(`\nDescrição:\n${descricao}`)
      if (subs.length) partes.push(`\nSubtarefas:\n${arvore(subs, doc.tasks).join('\n')}`)
      for (const c of t.checklists ?? []) {
        partes.push(`\nChecklist "${c.title}" (id: ${c.id}):\n` +
          ((c.items ?? []).map((i: Obj) => `- [${i.done ? 'x' : ' '}] ${i.text} (id: ${i.id})`).join('\n') || '(vazio)'))
      }
      const comentarios = (t.comments ?? []).filter((c: Obj) => c.text).slice(-10)
      if (comentarios.length) partes.push(`\nComentários recentes:\n${comentarios.map((c: Obj) => `- ${dia(c.createdAt)} ${c.author}: ${c.text}`).join('\n')}`)
      return ok(partes.join('\n'))
    }

    case 'criar_tarefa': {
      const pai = args.pai ? achar(doc, 'task', args.pai) : undefined
      const projeto = pai ? undefined : achar(doc, 'project', args.projeto)
      const responsavelNovo = args.responsavel === undefined ? RESPONSAVEL_DJ : lerResponsavel(args.responsavel)
      const t = novaTarefa(doc, { titulo: args.titulo, projeto, pai, descricao: args.descricao, prioridade: args.prioridade, prazo: args.prazo, responsavel: responsavelNovo }, agora)
      const novo = numerarDoc({ ...doc, tasks: [...doc.tasks, t] })
      const criada = novo.tasks.find(x => x.id === t.id)!
      return { texto: `Criada ${formatarId('task', criada.seq)} ${criada.title}${pai ? ` (subtarefa de ${formatarId('task', pai.seq)})` : ''} · responsável: ${criada.assignee}.`, alterou: true, doc: novo }
    }

    case 'criar_subtarefas': {
      const pai = achar(doc, 'task', args.pai)
      const titulos: string[] = (args.titulos ?? []).map((s: unknown) => String(s).trim()).filter(Boolean)
      if (!titulos.length) throw new ErroFerramenta('Informe ao menos um título.')
      // createdAt crescente preserva a ordem dada na numeração (desempate por createdAt).
      const base = Date.parse(agora)
      const responsavelSubs = args.responsavel === undefined ? (normalizarResponsavel(pai.assignee) || RESPONSAVEL_DJ) : lerResponsavel(args.responsavel)
      const novas = titulos.map((titulo, i) => novaTarefa(doc, { titulo, pai, responsavel: responsavelSubs }, new Date(base + i).toISOString()))
      let novo = numerarDoc({ ...doc, tasks: [...doc.tasks, ...novas] })
      // Tarefa-mãe concluída que ganha subtarefa aberta volta a "Em progresso", como no app.
      if (pai.status === 'done') novo = mudarStatus(novo, pai.id, 'in_progress', agora)
      const criadas = novas.map(n => novo.tasks.find(x => x.id === n.id)!)
      return { texto: `Subtarefas criadas em ${formatarId('task', pai.seq)}:\n${criadas.map(c => `- ${formatarId('task', c.seq)} ${c.title}`).join('\n')}`, alterou: true, doc: novo }
    }

    case 'criar_checklist': {
      const t = achar(doc, 'task', args.tarefa)
      const itens = (args.itens ?? []).map((s: unknown) => String(s).trim()).filter(Boolean)
      if (!itens.length) throw new ErroFerramenta('Informe ao menos um item.')
      const cl = { id: novoId(), title: String(args.titulo ?? 'Checklist').trim() || 'Checklist', items: itens.map((text: string) => ({ id: novoId(), text, done: false })) }
      const novo = comTarefa(doc, t.id, x => ({ ...x, checklists: [...(x.checklists ?? []), cl] }), agora)
      return ok(`Checklist "${cl.title}" (id: ${cl.id}) criado em ${formatarId('task', t.seq)}:\n${cl.items.map((i: Obj) => `- [ ] ${i.text} (id: ${i.id})`).join('\n')}`, novo)
    }

    case 'adicionar_itens': {
      const t = achar(doc, 'task', args.tarefa)
      const cl = (t.checklists ?? []).find((c: Obj) => c.id === args.checklist)
      if (!cl) throw new ErroFerramenta(`Checklist "${args.checklist}" não existe em ${formatarId('task', t.seq)}. Veja os ids com ver_tarefa.`)
      const itens = (args.itens ?? []).map((s: unknown) => String(s).trim()).filter(Boolean).map((text: string) => ({ id: novoId(), text, done: false }))
      const novo = comTarefa(doc, t.id, x => ({ ...x, checklists: x.checklists.map((c: Obj) => (c.id === cl.id ? { ...c, items: [...c.items, ...itens] } : c)) }), agora)
      return ok(`Itens adicionados a "${cl.title}":\n${itens.map((i: Obj) => `- [ ] ${i.text} (id: ${i.id})`).join('\n')}`, novo)
    }

    case 'marcar_itens': {
      const t = achar(doc, 'task', args.tarefa)
      const feito = args.feito !== false
      const alvo = new Set((args.itens ?? []).map(String))
      const existentes = new Set((t.checklists ?? []).flatMap((c: Obj) => (c.items ?? []).map((i: Obj) => i.id)))
      const faltando = [...alvo].filter(id => !existentes.has(id))
      if (faltando.length) throw new ErroFerramenta(`Itens não encontrados em ${formatarId('task', t.seq)}: ${faltando.join(', ')}. Veja os ids com ver_tarefa.`)
      const novo = comTarefa(doc, t.id, x => ({ ...x, checklists: x.checklists.map((c: Obj) => ({
        ...c, items: c.items.map((i: Obj) => (alvo.has(i.id) && i.done !== feito ? { ...i, done: feito, doneAt: feito ? agora : null } : i)),
      })) }), agora)
      const itens = novo.tasks.find(x => x.id === t.id)!.checklists.flatMap((c: Obj) => c.items)
      return ok(`${alvo.size} ${alvo.size === 1 ? 'item marcado' : 'itens marcados'} como ${feito ? 'feito' : 'não feito'}. Checklist de ${formatarId('task', t.seq)}: ${itens.filter((i: Obj) => i.done).length}/${itens.length}.`, novo)
    }

    case 'atualizar_tarefa': {
      const t = achar(doc, 'task', args.tarefa)
      let novo = doc
      const campos: Args = {}
      if (args.titulo !== undefined) { const s = String(args.titulo).trim(); if (!s) throw new ErroFerramenta('O título não pode ficar vazio.'); campos.title = s }
      if (args.prioridade !== undefined) { if (!PRIORIDADE[args.prioridade]) throw new ErroFerramenta('Prioridade inválida.'); campos.priority = args.prioridade }
      if (args.prazo !== undefined) campos.dueDate = args.prazo || null
      if (args.responsavel !== undefined) { const r = lerResponsavel(args.responsavel); if (r !== t.assignee) campos.assignee = r }
      if (Object.keys(campos).length) novo = comTarefa(novo, t.id, x => ({ ...x, ...campos }), agora)
      if (args.status !== undefined) {
        if (!STATUS[args.status]) throw new ErroFerramenta('Status inválido.')
        novo = mudarStatus(novo, t.id, args.status, agora)
      }
      if (novo === doc) return ok(`Nada mudou em ${formatarId('task', t.seq)}.`)
      const depois = novo.tasks.find(x => x.id === t.id)!
      const mae = depois.parentId ? novo.tasks.find(x => x.id === depois.parentId) : null
      const antesMae = mae ? doc.tasks.find(x => x.id === mae.id) : null
      const extra = mae && antesMae && mae.status !== antesMae.status ? `\nTarefa-mãe ${formatarId('task', mae.seq)} foi para "${STATUS[mae.status]}".` : ''
      return ok(`Atualizada: ${linhaTarefa(depois)} · responsável: ${depois.assignee || '(ninguém)'}${extra}`, novo)
    }

    case 'comentar': {
      const t = achar(doc, 'task', args.tarefa)
      const texto = String(args.texto ?? '').trim()
      if (!texto) throw new ErroFerramenta('O comentário está vazio.')
      const c = { id: novoId(), author: AUTOR_CLAUDE, text: texto, createdAt: agora, parentId: null }
      const novo = comTarefa(doc, t.id, x => ({ ...x, comments: [...(x.comments ?? []), c] }), agora)
      return ok(`Comentário registrado em ${formatarId('task', t.seq)}.`, novo)
    }

    case 'relatorio': {
      const de = String(args.de ?? ''), ate = String(args.ate ?? '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) throw new ErroFerramenta('Use datas no formato AAAA-MM-DD.')
      const noPeriodo = (iso?: string | null) => !!iso && dia(iso) >= de && dia(iso) <= ate
      const p = args.projeto ? achar(doc, 'project', args.projeto) : null
      const tarefas = doc.tasks.filter(t => !p || t.projectId === p.id)
      const concluidas = tarefas.filter(t => t.status === 'done' && noPeriodo(t.completedAt))
      const criadas = tarefas.filter(t => noPeriodo(t.createdAt))
      const itens = tarefas.flatMap(t => (t.checklists ?? []).flatMap((c: Obj) => (c.items ?? [])
        .filter((i: Obj) => i.done && noPeriodo(i.doneAt)).map((i: Obj) => `- ${dia(i.doneAt)} ${formatarId('task', t.seq)}: ${i.text}`)))
      const comentarios = tarefas.flatMap(t => (t.comments ?? [])
        .filter((c: Obj) => c.author === AUTOR_CLAUDE && noPeriodo(c.createdAt))
        .map((c: Obj) => `- ${dia(c.createdAt)} ${formatarId('task', t.seq)} ${t.title}: ${c.text}`))
      const secao = (titulo: string, linhas: string[]) => `\n${titulo} (${linhas.length}):\n${linhas.join('\n') || '(nenhum)'}`
      return ok([
        `Período ${de} a ${ate}${p ? ` · ${formatarId('project', p.seq)} ${p.name}` : ' · todos os projetos'}`,
        secao('Tarefas concluídas', concluidas.map(t => `- ${dia(t.completedAt)} ${formatarId('task', t.seq)} ${t.title} · ${refProjeto(doc, t.projectId)}`)),
        secao('Tarefas criadas', criadas.map(t => `- ${dia(t.createdAt)} ${linhaTarefa(t)}`)),
        secao('Itens de checklist marcados', itens),
        secao('Registros do Claude', comentarios),
        '\nObs.: itens de checklist marcados antes desta integração não têm data e não entram aqui.',
      ].join('\n'))
    }

    case 'mover_tarefa': {
      const t = achar(doc, 'task', args.tarefa)
      const semPai = args.pai === 'nenhuma' || args.pai === null
      const pai = args.pai && !semPai ? achar(doc, 'task', args.pai) : null
      const projeto = args.projeto ? achar(doc, 'project', args.projeto) : null
      if (!pai && !semPai && !projeto) throw new ErroFerramenta('Diga para onde: "projeto" (P-…) e/ou "pai" (T-… ou "nenhuma").')
      const ramo = galho(doc, t.id)
      if (pai && ramo.some(x => x.id === pai.id)) throw new ErroFerramenta('Não dá para pendurar a tarefa dentro dela mesma ou de uma subtarefa dela.')
      const destinoProjeto = pai ? pai.projectId : (projeto ? projeto.id : t.projectId)
      const destinoWs = pai ? pai.workspaceId : (projeto ? (projeto.workspaceId ?? t.workspaceId) : t.workspaceId)
      const ids = new Set(ramo.map(x => x.id))
      const novo = { ...doc, tasks: doc.tasks.map(x => {
        if (!ids.has(x.id)) return x
        const base = { ...x, projectId: destinoProjeto, workspaceId: destinoWs, updatedAt: agora }
        return x.id === t.id ? { ...base, parentId: pai ? pai.id : ((semPai || projeto) ? null : x.parentId) } : base
      }) }
      const onde = pai ? `subtarefa de ${formatarId('task', pai.seq)}` : `tarefa principal em ${refProjeto(novo, destinoProjeto)}`
      return ok(`${formatarId('task', t.seq)} agora é ${onde}${ramo.length > 1 ? ` (levou ${ramo.length - 1} subtarefa(s) junto)` : ''}.`, novo)
    }

    case 'editar_descricao': {
      const t = achar(doc, 'task', args.tarefa)
      const texto = String(args.texto ?? '').trim()
      if (!texto) throw new ErroFerramenta('O texto está vazio.')
      const modo = args.modo === 'substituir' ? 'substituir' : 'acrescentar'
      const blocos: Obj[] = t.blocks ?? []
      const novoBloco = { id: novoId(), type: 'text', text: escaparHtml(texto), region: 'body' }
      let blocks: Obj[]
      if (modo === 'substituir') {
        const temMidia = blocos.some(b => b.type !== 'text' || /<img\b/i.test(String(b.text ?? '')))
        if (temMidia) throw new ErroFerramenta('A descrição tem imagem ou arquivo; substituir apagaria isso. Use modo "acrescentar".')
        blocks = [novoBloco]
      } else {
        blocks = [...blocos, novoBloco]
      }
      const novo = comTarefa(doc, t.id, x => ({ ...x, blocks, description: modo === 'substituir' ? '' : x.description }), agora)
      return ok(`Descrição de ${formatarId('task', t.seq)} ${modo === 'substituir' ? 'substituída' : 'acrescentada'}.`, novo)
    }

    case 'definir_etiquetas': {
      const t = achar(doc, 'task', args.tarefa)
      const tags = [...new Set((args.etiquetas ?? []).map((s: unknown) => String(s).trim()).filter(Boolean))] as string[]
      const novo = comTarefa(doc, t.id, x => ({ ...x, tags }), agora)
      return ok(`Etiquetas de ${formatarId('task', t.seq)}: ${tags.length ? tags.join(', ') : '(nenhuma)'}.`, novo)
    }

    case 'editar_item': {
      const t = achar(doc, 'task', args.tarefa)
      const texto = String(args.texto ?? '').trim()
      if (!texto) throw new ErroFerramenta('O texto está vazio.')
      const existe = (t.checklists ?? []).some((c: Obj) => (c.items ?? []).some((i: Obj) => i.id === args.item))
      if (!existe) throw new ErroFerramenta(`Item "${args.item}" não existe em ${formatarId('task', t.seq)}. Veja os ids com ver_tarefa.`)
      const novo = comTarefa(doc, t.id, x => ({ ...x, checklists: x.checklists.map((c: Obj) => ({ ...c, items: c.items.map((i: Obj) => (i.id === args.item ? { ...i, text: texto } : i)) })) }), agora)
      return ok(`Item atualizado em ${formatarId('task', t.seq)}.`, novo)
    }

    case 'excluir_itens': {
      const t = achar(doc, 'task', args.tarefa)
      const alvo = new Set((args.itens ?? []).map(String))
      const existentes = new Set((t.checklists ?? []).flatMap((c: Obj) => (c.items ?? []).map((i: Obj) => i.id)))
      const faltando = [...alvo].filter(id => !existentes.has(id))
      if (faltando.length) throw new ErroFerramenta(`Itens não encontrados em ${formatarId('task', t.seq)}: ${faltando.join(', ')}.`)
      const novo = comTarefa(doc, t.id, x => ({ ...x, checklists: x.checklists.map((c: Obj) => ({ ...c, items: c.items.filter((i: Obj) => !alvo.has(i.id)) })) }), agora)
      return ok(`${alvo.size} ${alvo.size === 1 ? 'item removido' : 'itens removidos'} de ${formatarId('task', t.seq)}.`, novo)
    }

    case 'excluir_checklist': {
      const t = achar(doc, 'task', args.tarefa)
      const cl = (t.checklists ?? []).find((c: Obj) => c.id === args.checklist)
      if (!cl) throw new ErroFerramenta(`Checklist "${args.checklist}" não existe em ${formatarId('task', t.seq)}.`)
      const novo = comTarefa(doc, t.id, x => ({ ...x, checklists: x.checklists.filter((c: Obj) => c.id !== cl.id) }), agora)
      return ok(`Checklist "${cl.title}" removido de ${formatarId('task', t.seq)} (${(cl.items ?? []).length} itens).`, novo)
    }

    case 'criar_projeto': {
      const nomeP = String(args.nome ?? '').trim()
      if (!nomeP) throw new ErroFerramenta('O nome não pode ficar vazio.')
      const cor = /^#[0-9a-f]{6}$/i.test(String(args.cor ?? '')) ? String(args.cor) : '#6366F1'
      // Mesmo workspace dos projetos existentes (o mais usado), como faria o app aberto nele.
      const contagem = new Map<string, number>()
      doc.projects.forEach(pr => contagem.set(pr.workspaceId ?? 'default', (contagem.get(pr.workspaceId ?? 'default') ?? 0) + 1))
      const workspaceId = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'default'
      const pr = {
        id: novoId(), name: nomeP, color: cor, description: String(args.descricao ?? ''), workspaceId,
        spaceId: null, folderId: null, gut: { g: 1, u: 1, t: 1, score: 1 }, archived: false, columns: [],
        activeView: 'list', taskOpenMode: 'center', customViews: [], createdAt: agora, updatedAt: agora,
      }
      const novo = numerarDoc({ ...doc, projects: [...doc.projects, pr] })
      const criado = novo.projects.find(x => x.id === pr.id)!
      return { texto: `Criado ${formatarId('project', criado.seq)} ${criado.name}.`, alterou: true, doc: novo }
    }

    case 'excluir_tarefa': {
      const t = achar(doc, 'task', args.tarefa)
      const ramo = galho(doc, t.id)
      const ids = new Set(ramo.map(x => x.id))
      const novo = { ...doc, tasks: doc.tasks.filter(x => !ids.has(x.id)), excluidos: marcarExcluidos(doc, [...ids], Date.parse(agora)) }
      const entrada: EntradaLixeira = { id: t.id, tipo: 'task', seq: t.seq, titulo: t.title, excluidoEm: agora, tarefas: ramo }
      return { texto: `${formatarId('task', t.seq)} ${t.title} foi para a lixeira${ramo.length > 1 ? ` com ${ramo.length - 1} subtarefa(s)` : ''}. Para desfazer: restaurar ${formatarId('task', t.seq)}.`,
        alterou: true, doc: novo, lixeira: { entrar: [entrada] } }
    }

    case 'excluir_projeto': {
      const pr = achar(doc, 'project', args.projeto)
      if (pr.id === INBOX_PROJECT_ID) throw new ErroFerramenta('A caixa de entrada não pode ser excluída.')
      const tarefas = doc.tasks.filter(x => x.projectId === pr.id)
      const idsTarefas = new Set(tarefas.map(x => x.id))
      const novo = { ...doc, projects: doc.projects.filter(x => x.id !== pr.id), tasks: doc.tasks.filter(x => !idsTarefas.has(x.id)),
        excluidos: marcarExcluidos(doc, [pr.id, ...idsTarefas], Date.parse(agora)) }
      const entrada: EntradaLixeira = { id: pr.id, tipo: 'project', seq: pr.seq, titulo: pr.name, excluidoEm: agora, projeto: pr, tarefas }
      return { texto: `${formatarId('project', pr.seq)} ${pr.name} foi para a lixeira com ${tarefas.length} tarefa(s). Para desfazer: restaurar ${formatarId('project', pr.seq)}.`,
        alterou: true, doc: novo, lixeira: { entrar: [entrada] } }
    }

    case 'listar_lixeira': {
      const itens = [...(ctx.lixeira ?? [])].sort((a, b) => (a.excluidoEm < b.excluidoEm ? 1 : -1))
      return ok(itens.length
        ? itens.map(e => `- ${formatarId(e.tipo, e.seq)} ${e.titulo} · excluído em ${dia(e.excluidoEm)}${e.tipo === 'project' ? ` · ${e.tarefas.length} tarefa(s)` : e.tarefas.length > 1 ? ` · ${e.tarefas.length - 1} subtarefa(s)` : ''}`).join('\n')
        : 'A lixeira está vazia.')
    }

    case 'restaurar': {
      const id = lerIdCurto(String(args.id ?? ''))
      if (!id) throw new ErroFerramenta('Informe o T-… ou P-… do item excluído.')
      const e = (ctx.lixeira ?? []).find(x => x.tipo === id.tipo && x.seq === id.seq)
      if (!e) throw new ErroFerramenta(`${formatarId(id.tipo, id.seq)} não está na lixeira (veja listar_lixeira).`)
      // Volta com updatedAt novo: é o que faz os aparelhos aceitarem o item apesar do registro
      // de exclusão (a mescla só deixa passar item mais novo que a exclusão).
      const vivo = (x: Obj): Obj => ({ ...x, updatedAt: agora })
      const existentes = new Set(doc.tasks.map(x => x.id))
      let tarefas = e.tarefas.filter(x => !existentes.has(x.id)).map(vivo)
      let projects = doc.projects
      let aviso = ''
      if (e.tipo === 'project' && e.projeto && !doc.projects.some(x => x.id === e.projeto!.id)) {
        projects = [...doc.projects, vivo(e.projeto)]
      } else if (e.tipo === 'task') {
        const raiz = tarefas.find(x => x.id === e.id)
        if (raiz && raiz.projectId !== INBOX_PROJECT_ID && !doc.projects.some(x => x.id === raiz.projectId)) {
          tarefas = tarefas.map(x => ({ ...x, projectId: INBOX_PROJECT_ID }))
          aviso = ' O projeto dela não existe mais: voltou para a caixa de entrada.'
        }
        if (raiz?.parentId && !existentes.has(raiz.parentId)) {
          tarefas = tarefas.map(x => (x.id === raiz.id ? { ...x, parentId: null } : x))
          aviso += ' A tarefa-mãe não existe mais: voltou como tarefa principal.'
        }
      }
      const ids = new Set([e.id, ...tarefas.map(x => x.id)])
      const excluidos = Object.fromEntries(Object.entries(doc.excluidos ?? {}).filter(([k]) => !ids.has(k)))
      const novo = { ...doc, projects, tasks: [...doc.tasks, ...tarefas], excluidos }
      return { texto: `${formatarId(e.tipo, e.seq)} ${e.titulo} restaurado${e.tipo === 'project' || tarefas.length > 1 ? ` (${tarefas.length} tarefa(s))` : ''}.${aviso}`,
        alterou: true, doc: novo, lixeira: { sair: [e.id] } }
    }

    default:
      throw new ErroFerramenta(`Ferramenta desconhecida: ${nome}`)
  }
}
