import type { VercelRequest, VercelResponse } from '@vercel/node'
import { uidDoLogin, statusDaChave, gerarChave, revogarChave, ErroHttp } from './_lib/conector.js'

// Chave pessoal do conector do Claude, chamada pelo app logado (Configurações).
// GET: situação · POST: gera nova (revoga a anterior) e devolve UMA vez · DELETE: revoga.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const uid = await uidDoLogin(req.headers.authorization)
    if (req.method === 'GET') return void res.status(200).json(await statusDaChave(uid))
    if (req.method === 'POST') return void res.status(200).json({ chave: await gerarChave(uid) })
    if (req.method === 'DELETE') { await revogarChave(uid); return void res.status(200).json({ ativa: false }) }
    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'Método não permitido.' })
  } catch (e: any) {
    const status = e instanceof ErroHttp ? e.status : 500
    if (status === 500) console.error('Erro em /api/claude-chave:', e)
    res.status(status).json({ error: status === 500 ? 'Erro interno.' : e.message })
  }
}
