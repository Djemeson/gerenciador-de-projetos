import type { VercelRequest, VercelResponse } from '@vercel/node'
import { rotaMcp } from '../_lib/rotaMcp.js'

// Conector do Claude com a chave no caminho (/api/mcp/gpc_...). Existe porque o
// "conector personalizado" do claude.ai e do Cowork só pede a URL — não há onde pôr
// cabeçalho. A URL inteira vale como senha: quem a tiver mexe nas tarefas.
export default function handler(req: VercelRequest, res: VercelResponse) {
  const chave = Array.isArray(req.query.chave) ? req.query.chave[0] : req.query.chave
  return rotaMcp(req, res, chave)
}
