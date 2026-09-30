// As ações que o Claude pode executar no gerenciador (conector MCP em api/mcp).
//
// Tudo aqui é puro: recebe o documento de sincronização da conta (o mesmo que o app grava
// em syncGroups/{uid}) e devolve o documento alterado + o texto da resposta. Quem lê e
// grava no Firestore é api/_lib/conector.ts, dentro de uma transação.
//
// Regras que o app depende que sejam respeitadas (ver src/stores/useAppStore.ts):
// - todo item alterado ganha `updatedAt` novo — é assim que a mescla entre aparelhos sabe
//   que a versão do Claude é a mais recente;
// - campos que esta camada não conhece são preservados (o objeto é copiado, nunca
//   reconstruído), inclusive referências de anexos;
// - `completedAt` só muda na transição de status, como em `updateTask`;
// - nada é excluído: o conector cria, marca, comenta e muda status. Apagar é com o dono.

import { numerar, formatarId, lerIdCurto, mesclarContadores, type Contadores } from './shortIds'

export const AUTOR_CLAUDE = 'Claude'

type Obj = { id: string; [k: string]: any }
type Args = Record<string, any>
export interface DocConta { tasks: Obj[]; projects: Obj[]; seqCounters?: Contadores; [k: string]: unknown }
export interface Resultado { texto: string; alterou: boolean; doc: DocConta }

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
  { name: 'criar_tarefa', description: 'Cria uma tarefa num projeto (ou uma subtarefa, se "pai" for informado). Devolve o ID curto.',
    inputSchema: { type: 'object', required: ['titulo'], properties: {
      projeto: { ...idProjeto, description: 'Projeto de destino (obrigatório se não houver "pai").' },
      pai: { ...idTarefa, description: 'Tarefa-mãe, para criar uma subtarefa.' },
      titulo: { type: 'string' },
      descricao: { type: 'string' },
      prioridade: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      prazo: { type: 'string', description: 'Data AAAA-MM-DD.' } } } },
  { name: 'criar_subtarefas', description: 'Cria várias subtarefas de uma vez sob a mesma tarefa-mãe. Use para partes com vida própria (pode pausar no meio, tem prazo, pode ir para outra pessoa).',
    inputSchema: { type: 'object', required: ['pai', 'titulos'], properties: {
      pai: idTarefa, titulos: { type: 'array', items: { type: 'string' }, minItems: 1 } } } },
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
  { name: 'atualizar_tarefa', description: 'Muda status, título, prioridade ou prazo de uma tarefa. Concluir a última subtarefa conclui a mãe, como no app.',
    inputSchema: { type: 'object', required: ['tarefa'], properties: {
      tarefa: idTarefa,
      status: { type: 'string', enum: ['todo', 'in_progress', 'waiting', 'paused', 'done'] },
      titulo: { type: 'string' },
      prioridade: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      prazo: { type: ['string', 'null'], description: 'AAAA-MM-DD, ou null para remover.' } } } },
  { name: 'comentar', description: 'Registra um comentário na tarefa, assinado pelo Claude. Ao pausar, comece com "Ponto de parada:" e diga o que foi feito, o que falta e o que depende de decisão.',
    inputSchema: { type: 'object', required: ['tarefa', 'texto'], properties: { tarefa: idTarefa, texto: { type: 'string' } } } },
  { name: 'relatorio', description: 'O que aconteceu num período: tarefas concluídas, criadas, itens de checklist marcados e comentários do Claude. Base para resumos e relatórios.',
    inputSchema: { type: 'object', required: ['de', 'ate'], properties: {
      de: { type: 'string', description: 'AAAA-MM-DD (inclusive).' }, ate: { type: 'string', description: 'AAAA-MM-DD (inclusive).' },
      projeto: { ...idProjeto, description: 'Opcional: só este projeto.' } } } },
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

function novaTarefa(doc: DocConta, dados: { titulo: string; projeto?: Obj; pai?: Obj; descricao?: string; prioridade?: string; prazo?: string }, agora: string): Obj {
  const projectId = dados.pai?.projectId ?? dados.projeto?.id
  const workspaceId = dados.pai?.workspaceId ?? dados.projeto?.workspaceId ?? 'default'
  const titulo = String(dados.titulo ?? '').trim()
  if (!titulo) throw new ErroFerramenta('O título não pode ficar vazio.')
  return {
    id: novoId(), workspaceId, projectId, parentId: dados.pai?.id ?? null,
    title: titulo, description: '',
    blocks: dados.descricao ? [{ id: novoId(), type: 'text', text: escaparHtml(dados.descricao), region: 'body' }] : [],
    status: 'todo', priority: dados.prioridade ?? (dados.pai ? 'low' : 'medium'), taskType: 'task',
    dueDate: dados.prazo ?? null, assignee: 'DJ', tags: [], checklists: [], customFields: {}, comments: [],
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
export function executar(nome: string, args: Args, docOriginal: DocConta, agora = new Date().toISOString()): Resultado {
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
        `Status: ${STATUS[t.status] ?? t.status} · Prioridade: ${PRIORIDADE[t.priority] ?? t.priority}${t.dueDate ? ` · Prazo: ${dia(t.dueDate)}` : ''}`,
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
      const t = novaTarefa(doc, { titulo: args.titulo, projeto, pai, descricao: args.descricao, prioridade: args.prioridade, prazo: args.prazo }, agora)
      const novo = numerarDoc({ ...doc, tasks: [...doc.tasks, t] })
      const criada = novo.tasks.find(x => x.id === t.id)!
      return { texto: `Criada ${formatarId('task', criada.seq)} ${criada.title}${pai ? ` (subtarefa de ${formatarId('task', pai.seq)})` : ''}.`, alterou: true, doc: novo }
    }

    case 'criar_subtarefas': {
      const pai = achar(doc, 'task', args.pai)
      const titulos: string[] = (args.titulos ?? []).map((s: unknown) => String(s).trim()).filter(Boolean)
      if (!titulos.length) throw new ErroFerramenta('Informe ao menos um título.')
      // createdAt crescente preserva a ordem dada na numeração (desempate por createdAt).
      const base = Date.parse(agora)
      const novas = titulos.map((titulo, i) => novaTarefa(doc, { titulo, pai }, new Date(base + i).toISOString()))
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
      return ok(`Atualizada: ${linhaTarefa(depois)}${extra}`, novo)
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

    default:
      throw new ErroFerramenta(`Ferramenta desconhecida: ${nome}`)
  }
}
