// Avisos em tempo real para o orquestrador de produtividade (n8n).
//
// Cada tarefa e cada projeto é um documento em syncGroups/{uid}/tarefas|projetos (formato 2,
// ver shared/formatoConta.ts). Qualquer gravação — do app, de outro aparelho ou do conector do
// Claude — dispara estes gatilhos; shared/orquestrador.ts decide se a mudança importa e monta o
// aviso, e aqui ele vai por POST para o webhook do n8n.
//
// O endereço do webhook mora em functions/.env (ORQUESTRADOR_WEBHOOK, fora do git). Sem ele,
// nada é enviado. Falha no envio fica no log e não é refeita: o fluxo de conferência de hora em
// hora no n8n recupera o que se perder.

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { defineString } from 'firebase-functions/params'
import { mudancasTarefa, mudancasProjeto, avisoTarefa, avisoProjeto, avisoSincronizar } from '../../shared/orquestrador'
import { COLECAO_TAREFAS, COLECAO_PROJETOS } from '../../shared/formatoConta'
import { lerIdCurto } from '../../shared/shortIds'
import { initializeApp, getApps } from 'firebase-admin/app'
import { chaveDoCabecalho, uidDaChave, db, ErroHttp } from './conector'

// O gatilho do Firestore monta o antes/depois com o app padrão do Admin SDK antes de chamar o
// código daqui — sem isto ele falha com "The default Firebase app does not exist".
if (!getApps().length) initializeApp()

const WEBHOOK = defineString('ORQUESTRADOR_WEBHOOK', { default: '' })

async function conta(uid: string) {
  const ref = db().collection('syncGroups').doc(uid)
  const [t, p] = await Promise.all([ref.collection(COLECAO_TAREFAS).get(), ref.collection(COLECAO_PROJETOS).get()])
  return { tarefas: t.docs.map(d => d.data()), projetos: p.docs.map(d => d.data()) }
}

async function enviar(aviso: object) {
  const url = WEBHOOK.value()
  if (!url) return
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aviso), signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) console.warn(`Orquestrador respondeu ${r.status}`)
  } catch (e: any) {
    console.warn('Orquestrador fora do ar:', e?.message ?? e)
  }
}

export const avisarTarefa = onDocumentWritten(
  { document: `syncGroups/{uid}/${COLECAO_TAREFAS}/{id}`, region: 'us-central1' },
  async ev => {
    const antes = ev.data?.before.exists ? ev.data.before.data()! : null
    const depois = ev.data?.after.exists ? ev.data.after.data()! : null
    const agora = Date.now()
    const eventos = mudancasTarefa(antes, depois, agora)
    if (!eventos.length || !WEBHOOK.value()) return
    const { tarefas, projetos } = await conta(ev.params.uid)
    await enviar(avisoTarefa(eventos, antes, depois, tarefas, projetos, agora))
    // Tarefa que mudou de projeto: o projeto de onde saiu também precisa da nota refeita.
    if (antes && depois && antes.projectId !== depois.projectId) {
      const anterior = projetos.find(p => p.id === antes.projectId)
      const aviso = anterior ? avisoSincronizar(anterior.seq, tarefas, projetos, agora) : null
      if (aviso) await enviar(aviso)
    }
  },
)

export const avisarProjeto = onDocumentWritten(
  { document: `syncGroups/{uid}/${COLECAO_PROJETOS}/{id}`, region: 'us-central1' },
  async ev => {
    const antes = ev.data?.before.exists ? ev.data.before.data()! : null
    const depois = ev.data?.after.exists ? ev.data.after.data()! : null
    const agora = Date.now()
    const eventos = mudancasProjeto(antes, depois, agora)
    if (!eventos.length || !WEBHOOK.value()) return
    const { tarefas, projetos } = await conta(ev.params.uid)
    await enviar(avisoProjeto(eventos, antes, depois, tarefas, projetos, agora))
  },
)

/**
 * Reenvia o retrato de projetos sob pedido — para criar as notas pela primeira vez e para a
 * conferência periódica. POST com `Authorization: Bearer gpc_…` e corpo `{ "projeto": "P-12" }`
 * ou `{ "todos": true }` (só os não arquivados).
 */
export const orquestradorSincronizar = onRequest({ invoker: 'public', region: 'us-central1', timeoutSeconds: 540 }, async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return }
    const uid = await uidDaChave(chaveDoCabecalho(req.headers.authorization))
    const { tarefas, projetos } = await conta(uid)
    const agora = Date.now()
    const seqs: number[] = req.body?.todos
      ? projetos.filter(p => !p.archived && typeof p.seq === 'number').map(p => p.seq)
      : [lerIdCurto(String(req.body?.projeto ?? ''))?.seq].filter((s): s is number => typeof s === 'number')
    if (!seqs.length) { res.status(400).json({ error: 'Informe "projeto": "P-n" ou "todos": true.' }); return }
    for (const [i, seq] of seqs.entries()) {
      // Espaçado: cada aviso também reescreve a nota de visão geral, e duas edições ao mesmo
      // tempo disputam o mesmo trecho da nota.
      if (i) await new Promise(r => setTimeout(r, 8000))
      const aviso = avisoSincronizar(seq, tarefas, projetos, agora)
      if (aviso) await enviar(aviso)
    }
    res.json({ enviados: seqs.length })
  } catch (e: any) {
    const status = e instanceof ErroHttp ? e.status : 500
    if (status === 500) console.error('Erro em orquestradorSincronizar:', e)
    res.status(status).json({ error: status === 500 ? 'Erro interno.' : e.message })
  }
})
