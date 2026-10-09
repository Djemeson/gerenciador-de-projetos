// Avisos para o orquestrador de produtividade (fluxo do n8n "Eventos do gerenciador").
//
// Puro: recebe o antes/depois de um documento de tarefa ou projeto e a conta inteira, decide se
// a mudança importa e monta o aviso. Quem lê o Firestore e faz o POST é
// functions/src/orquestrador.ts.
//
// O aviso já leva o projeto detalhado e o painel de todos os projetos, para o n8n atualizar as
// notas do Evernote sem precisar chamar o conector de volta (cada chamada lê a conta inteira).

import { formatarId } from './shortIds'
import { normalizarResponsavel } from './responsaveis'

type Obj = Record<string, any>

const INBOX_PROJECT_ID = '__inbox__'
// Documento que "nasce" com data de criação antiga é regravação (migração de formato, aparelho
// sincronizando), não tarefa nova — não vira aviso de "criada".
const JANELA_CRIACAO_MS = 10 * 60 * 1000

const dia = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : '')

/** Data de hoje em Bragança do Pará (UTC-3, sem horário de verão). */
export const hojeEmBelem = (agoraMs: number) => new Date(agoraMs - 3 * 3600 * 1000).toISOString().slice(0, 10)

export function mudancasTarefa(antes: Obj | null, depois: Obj | null, agoraMs: number): string[] {
  if (!antes && !depois) return []
  if (!antes) {
    const criada = Date.parse(depois!.createdAt ?? '')
    return Number.isFinite(criada) && agoraMs - criada > JANELA_CRIACAO_MS ? [] : ['criada']
  }
  if (!depois) return ['excluida']
  const m: string[] = []
  if (antes.status !== depois.status) {
    if (depois.status === 'done') m.push('concluida')
    else if (antes.status === 'done') m.push('reaberta')
    else m.push('status')
  }
  if (dia(antes.dueDate) !== dia(depois.dueDate)) m.push('prazo')
  if (String(antes.title ?? '') !== String(depois.title ?? '')) m.push('titulo')
  if (normalizarResponsavel(antes.assignee) !== normalizarResponsavel(depois.assignee)) m.push('responsavel')
  if (antes.projectId !== depois.projectId) m.push('movida')
  return m
}

export function mudancasProjeto(antes: Obj | null, depois: Obj | null, agoraMs: number): string[] {
  if (!antes && !depois) return []
  if (!antes) {
    const criado = Date.parse(depois!.createdAt ?? '')
    return Number.isFinite(criado) && agoraMs - criado > JANELA_CRIACAO_MS ? [] : ['projeto_criado']
  }
  if (!depois) return ['projeto_excluido']
  const m: string[] = []
  if (String(antes.name ?? '') !== String(depois.name ?? '')) m.push('projeto_renomeado')
  if (!!antes.archived !== !!depois.archived) m.push(depois.archived ? 'projeto_arquivado' : 'projeto_reaberto')
  return m
}

function resumoTarefa(t: Obj, tarefas: Obj[]) {
  const mae = t.parentId ? tarefas.find(x => x.id === t.parentId) : null
  return {
    id: formatarId('task', t.seq) || null, titulo: String(t.title ?? ''), status: t.status ?? 'todo',
    responsavel: t.assignee ? normalizarResponsavel(t.assignee) : null, prazo: dia(t.dueDate) || null,
    prioridade: t.priority ?? null, mae: mae ? formatarId('task', mae.seq) || null : null,
    criadaEm: dia(t.createdAt) || null, concluidaEm: dia(t.completedAt) || null,
  }
}

function detalheProjeto(p: Obj | undefined, projectId: string, tarefas: Obj[]) {
  if (!p) return projectId === INBOX_PROJECT_ID ? { id: null, nome: 'Caixa de entrada', arquivado: false, tarefas: [] } : null
  const doProjeto = tarefas.filter(t => t.projectId === p.id)
  return {
    id: formatarId('project', p.seq) || null, nome: String(p.name ?? ''), arquivado: !!p.archived,
    tarefas: doProjeto.map(t => resumoTarefa(t, tarefas)),
  }
}

function painel(projetos: Obj[], tarefas: Obj[], hoje: string) {
  return projetos.map(p => {
    const ts = tarefas.filter(t => t.projectId === p.id)
    const abertas = ts.filter(t => t.status !== 'done')
    return {
      id: formatarId('project', p.seq) || null, nome: String(p.name ?? ''), arquivado: !!p.archived,
      total: ts.length, abertas: abertas.length, concluidas: ts.length - abertas.length,
      atrasadas: abertas.filter(t => dia(t.dueDate) && dia(t.dueDate) < hoje).length,
    }
  })
}

export function avisoTarefa(eventos: string[], antes: Obj | null, depois: Obj | null, tarefas: Obj[], projetos: Obj[], agoraMs: number) {
  const atual = depois ?? antes!
  const projeto = projetos.find(p => p.id === atual.projectId)
  const anterior = antes && depois && antes.projectId !== depois.projectId ? projetos.find(p => p.id === antes.projectId) : undefined
  return {
    versao: 1, tipo: 'tarefa', eventos, quando: new Date(agoraMs).toISOString(),
    tarefa: { ...resumoTarefa(atual, tarefas), excluida: !depois },
    antes: antes ? resumoTarefa(antes, tarefas) : null,
    projeto: detalheProjeto(projeto, atual.projectId, tarefas),
    projetoAnterior: anterior ? detalheProjeto(anterior, anterior.id, tarefas) : null,
    painel: painel(projetos, tarefas, hojeEmBelem(agoraMs)),
  }
}

export function avisoProjeto(eventos: string[], antes: Obj | null, depois: Obj | null, tarefas: Obj[], projetos: Obj[], agoraMs: number) {
  const atual = depois ?? antes!
  return {
    versao: 1, tipo: 'projeto', eventos, quando: new Date(agoraMs).toISOString(),
    nomeAnterior: antes && depois && antes.name !== depois.name ? String(antes.name ?? '') : null,
    projeto: { ...detalheProjeto(atual, atual.id, depois ? tarefas : [])!, excluido: !depois },
    painel: painel(projetos, tarefas, hojeEmBelem(agoraMs)),
  }
}

/** Aviso montado sob pedido (o fluxo pede "sincronizar" um projeto para recriar a nota). */
export function avisoSincronizar(projetoSeq: number, tarefas: Obj[], projetos: Obj[], agoraMs: number) {
  const p = projetos.find(x => x.seq === projetoSeq)
  if (!p) return null
  return {
    versao: 1, tipo: 'projeto', eventos: ['sincronizar'], quando: new Date(agoraMs).toISOString(), nomeAnterior: null,
    projeto: { ...detalheProjeto(p, p.id, tarefas)!, excluido: false },
    painel: painel(projetos, tarefas, hojeEmBelem(agoraMs)),
  }
}
