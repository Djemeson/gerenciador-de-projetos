// Ponte entre o Claude e o gerenciador: servidor MCP (o protocolo de "tomada" que o
// Claude usa para falar com outros sistemas) + a chave pessoal que dá acesso a ele.
//
// Como funciona:
// - A chave é gerada no app (Configurações → Integração com o Claude), mostrada uma vez
//   e guardada aqui só como hash, em `claudeTokens/{sha256}` → { uid }. As regras do
//   Firestore não liberam essa coleção para o navegador; só este servidor (Admin SDK) a vê.
// - Cada chamada de ferramenta lê o documento da conta (`syncGroups/{uid}`, o mesmo que o
//   app sincroniza), aplica a ação (shared/ferramentas.ts) e grava numa transação —
//   se o app gravar no meio, a transação refaz a leitura em vez de atropelar.
// - A gravação usa `update` só nos campos que o conector toca (tarefas, projetos,
//   contadores, carimbo do documento). Configurações e chaves de IA ficam intocadas.
//
// Roda no Cloud Functions do próprio projeto Firebase: o Admin SDK usa a identidade de
// serviço que o Google já dá à função — não há credencial para gerar, guardar ou colar.

import { createHash, randomBytes } from 'node:crypto'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { DEFINICOES, executar, ErroFerramenta, type DocConta, type EntradaLixeira } from '../../shared/ferramentas'

const COLECAO_CHAVES = 'claudeTokens'
const PREFIXO_CHAVE = 'gpc_'
const VERSAO_PROTOCOLO = '2025-06-18'
const VERSOES_ACEITAS = ['2025-06-18', '2025-03-26', '2024-11-05']

export class ErroHttp extends Error {
  constructor(public status: number, message: string) { super(message) }
}

let dbCache: Firestore | null = null
function db(): Firestore {
  if (dbCache) return dbCache
  if (!getApps().length) initializeApp()
  dbCache = getFirestore()
  // Campos opcionais das tarefas podem vir `undefined`; o app grava com a mesma opção.
  dbCache.settings({ ignoreUndefinedProperties: true })
  return dbCache
}

const hash = (chave: string) => createHash('sha256').update(chave).digest('hex')

// ── Chave pessoal ───────────────────────────────────────────────────────────
/** Confere o login do Google feito no app (token do Firebase) e devolve o uid. */
export async function uidDoLogin(authorization: string | undefined): Promise<string> {
  const token = /^Bearer\s+(.+)$/i.exec(authorization ?? '')?.[1]
  if (!token) throw new ErroHttp(401, 'Faça login no app.')
  db()   // inicializa o Admin SDK
  try {
    return (await getAuth().verifyIdToken(token)).uid
  } catch {
    throw new ErroHttp(401, 'Login expirado. Recarregue o app.')
  }
}

export async function statusDaChave(uid: string) {
  const snap = await db().collection(COLECAO_CHAVES).where('uid', '==', uid).get()
  const d = snap.docs[0]?.data()
  return d ? { ativa: true, criadaEm: d.createdAt as string, final: d.final as string, usadaEm: (d.lastUsedAt as string) ?? null } : { ativa: false }
}

/** Gera uma chave nova e revoga as anteriores (só existe uma por conta). */
export async function gerarChave(uid: string) {
  const chave = PREFIXO_CHAVE + randomBytes(32).toString('base64url')
  const banco = db()
  const col = banco.collection(COLECAO_CHAVES)
  const antigas = await col.where('uid', '==', uid).get()
  const lote = banco.batch()
  antigas.docs.forEach(d => lote.delete(d.ref))
  lote.set(col.doc(hash(chave)), { uid, createdAt: new Date().toISOString(), final: chave.slice(-4), lastUsedAt: null })
  await lote.commit()
  return chave
}

export async function revogarChave(uid: string) {
  const banco = db()
  const antigas = await banco.collection(COLECAO_CHAVES).where('uid', '==', uid).get()
  const lote = banco.batch()
  antigas.docs.forEach(d => lote.delete(d.ref))
  await lote.commit()
}

async function uidDaChave(chave: string | undefined): Promise<string> {
  if (!chave || !chave.startsWith(PREFIXO_CHAVE)) throw new ErroHttp(401, 'Chave ausente ou inválida. Gere uma em Configurações → Integração com o Claude.')
  const ref = db().collection(COLECAO_CHAVES).doc(hash(chave))
  const snap = await ref.get()
  if (!snap.exists) throw new ErroHttp(401, 'Chave revogada ou inválida. Gere uma nova no app.')
  ref.update({ lastUsedAt: new Date().toISOString() }).catch(() => {})
  return snap.get('uid') as string
}

// ── Ferramentas sobre o documento da conta ──────────────────────────────────
const PRECISAM_DA_LIXEIRA = new Set(['listar_lixeira', 'restaurar'])

async function chamarFerramenta(uid: string, nome: string, args: Record<string, unknown>) {
  const banco = db()
  const ref = banco.collection('syncGroups').doc(uid)
  const lixeira = ref.collection('lixeira')
  return banco.runTransaction(async tx => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new ErroFerramenta('A conta ainda não tem dados na nuvem. Abra o app uma vez com login.')
    const dados = snap.data() as DocConta
    // Só lê a lixeira quando a ação precisa dela (listar/restaurar) — toda leitura conta na cota.
    const ctx = PRECISAM_DA_LIXEIRA.has(nome)
      ? { lixeira: (await tx.get(lixeira)).docs.map(d => d.data() as EntradaLixeira) }
      : {}
    const r = executar(nome, args ?? {}, dados, new Date().toISOString(), ctx)
    if (r.alterou) {
      const campos: Record<string, unknown> = { tasks: r.doc.tasks, projects: r.doc.projects, seqCounters: r.doc.seqCounters, updatedAt: Date.now() }
      if (r.doc.excluidos !== dados.excluidos) campos.excluidos = r.doc.excluidos ?? {}
      tx.update(ref, campos)
    }
    r.lixeira?.entrar?.forEach(e => tx.set(lixeira.doc(e.id), e))
    r.lixeira?.sair?.forEach(id => tx.delete(lixeira.doc(id)))
    return r.texto
  })
}

// ── Protocolo MCP (JSON-RPC sobre HTTP, sem sessão) ─────────────────────────
const INSTRUCOES =
  'Gerenciador de projetos do usuário. Tarefas têm ID curto T-<n> e projetos P-<n>; o usuário ' +
  'se refere a eles assim. Ao trabalhar numa tarefa: ver_tarefa primeiro (o último comentário ' +
  '"Ponto de parada" diz de onde retomar); quebre em subtarefas (partes com vida própria) ou ' +
  'checklist (passos curtos); marque cada item ao terminar; ao pausar ou encerrar, comente ' +
  'começando com "Ponto de parada:". Excluir tarefa ou projeto manda para a lixeira (restaurar ' +
  'desfaz) — confirme com o usuário antes, citando ID e título.'

type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: any }

async function responder(uid: string, msg: Rpc): Promise<object | null> {
  const resposta = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id ?? null, result })
  const erro = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } })
  if (msg.id === undefined) return null   // notificação (ex.: notifications/initialized): não se responde

  switch (msg.method) {
    case 'initialize': {
      const pedida = msg.params?.protocolVersion
      return resposta({
        protocolVersion: VERSOES_ACEITAS.includes(pedida) ? pedida : VERSAO_PROTOCOLO,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'gerenciador-de-projetos', version: '1.0.0' },
        instructions: INSTRUCOES,
      })
    }
    case 'ping': return resposta({})
    case 'tools/list': return resposta({ tools: DEFINICOES })
    case 'tools/call': {
      try {
        const texto = await chamarFerramenta(uid, msg.params?.name, msg.params?.arguments ?? {})
        return resposta({ content: [{ type: 'text', text: texto }] })
      } catch (e: any) {
        // Erro de uso (ID errado, item inexistente) volta como resultado com isError, para
        // o Claude ler e corrigir; erro de infraestrutura sobe como falha do servidor.
        if (e instanceof ErroFerramenta) return resposta({ content: [{ type: 'text', text: e.message }], isError: true })
        throw e
      }
    }
    default: return erro(-32601, `Método não suportado: ${msg.method}`)
  }
}

/** Trata um POST do MCP. `chave` vem do cabeçalho Authorization ou do caminho da URL. */
export async function tratarMcp(corpo: unknown, chave: string | undefined): Promise<{ status: number; corpo?: unknown }> {
  const uid = await uidDaChave(chave)
  const mensagens = Array.isArray(corpo) ? corpo : [corpo]
  if (!mensagens.length || mensagens.some(m => !m || typeof m !== 'object' || typeof (m as Rpc).method !== 'string')) {
    return { status: 400, corpo: { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Requisição JSON-RPC inválida.' } } }
  }
  const respostas = (await Promise.all(mensagens.map(m => responder(uid, m as Rpc)))).filter(Boolean)
  if (!respostas.length) return { status: 202 }
  return { status: 200, corpo: Array.isArray(corpo) ? respostas : respostas[0] }
}

export const chaveDoCabecalho = (authorization: string | undefined) =>
  /^Bearer\s+(.+)$/i.exec(authorization ?? '')?.[1]?.trim()
