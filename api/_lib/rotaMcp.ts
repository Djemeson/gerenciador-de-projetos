import type { VercelRequest, VercelResponse } from '@vercel/node'
import { tratarMcp, ErroHttp } from './conector.js'

/** Handler comum às duas formas de entregar a chave (cabeçalho ou caminho da URL). */
export async function rotaMcp(req: VercelRequest, res: VercelResponse, chave: string | undefined) {
  res.setHeader('Cache-Control', 'no-store')
  // Servidor sem sessão: não há fluxo de eventos (GET) nem sessão para encerrar (DELETE).
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Use POST (MCP via HTTP).' })
    return
  }
  try {
    const r = await tratarMcp(req.body, chave)
    if (r.corpo === undefined) res.status(r.status).end()
    else res.status(r.status).json(r.corpo)
  } catch (e: any) {
    const status = e instanceof ErroHttp ? e.status : 500
    if (status === 500) console.error('Erro no conector MCP:', e)
    res.status(status).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: status === 500 ? 'Erro interno no conector.' : e.message } })
  }
}
