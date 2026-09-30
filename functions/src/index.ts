// Funções do servidor do gerenciador (Cloud Functions 2ª geração, EUA).
//
// O navegador nunca chama estas URLs diretamente: o Firebase Hosting encaminha
// /api/mcp, /api/mcp/<chave> e /api/claude-chave para cá (ver firebase.json), então o
// app e o conector continuam no mesmo endereço do site.

import { onRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import {
  tratarMcp, chaveDoCabecalho, uidDoLogin, statusDaChave, gerarChave, revogarChave, ErroHttp,
} from './conector'

// us-central1: dentro da cota gratuita. Teto de instâncias para uso pessoal — uma chave
// vazada não vira conta alta.
setGlobalOptions({ region: 'us-central1', maxInstances: 5, memory: '256MiB' })

const PREFIXO_MCP = '/api/mcp/'

/**
 * Conector do Claude (MCP via HTTP, sem sessão — só POST).
 * - /api/mcp com `Authorization: Bearer gpc_…` → Claude Code;
 * - /api/mcp/gpc_… → conector personalizado do claude.ai/Cowork, que só aceita URL.
 */
export const mcp = onRequest({ invoker: 'public' }, async (req, res) => {
  res.set('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.set('Allow', 'POST').status(405).json({ error: 'Use POST (MCP via HTTP).' })
    return
  }
  const naUrl = req.path.startsWith(PREFIXO_MCP) ? decodeURIComponent(req.path.slice(PREFIXO_MCP.length)) : ''
  try {
    const r = await tratarMcp(req.body, naUrl || chaveDoCabecalho(req.headers.authorization))
    if (r.corpo === undefined) res.status(r.status).end()
    else res.status(r.status).json(r.corpo)
  } catch (e: any) {
    const status = e instanceof ErroHttp ? e.status : 500
    if (status === 500) console.error('Erro no conector MCP:', e)
    res.status(status).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: status === 500 ? 'Erro interno no conector.' : e.message } })
  }
})

/** Chave pessoal, chamada pelo app logado. GET: situação · POST: gera (mostra uma vez) · DELETE: revoga. */
export const claudeChave = onRequest({ invoker: 'public' }, async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const uid = await uidDoLogin(req.headers.authorization)
    if (req.method === 'GET') { res.json(await statusDaChave(uid)); return }
    if (req.method === 'POST') { res.json({ chave: await gerarChave(uid) }); return }
    if (req.method === 'DELETE') { await revogarChave(uid); res.json({ ativa: false }); return }
    res.set('Allow', 'GET, POST, DELETE').status(405).json({ error: 'Método não permitido.' })
  } catch (e: any) {
    const status = e instanceof ErroHttp ? e.status : 500
    if (status === 500) console.error('Erro em /api/claude-chave:', e)
    res.status(status).json({ error: status === 500 ? 'Erro interno.' : e.message })
  }
})
