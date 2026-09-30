import type { VercelRequest, VercelResponse } from '@vercel/node'
import { rotaMcp } from '../_lib/rotaMcp.js'
import { chaveDoCabecalho } from '../_lib/conector.js'

// Conector do Claude com a chave no cabeçalho — o jeito do Claude Code
// (`claude mcp add --transport http ... --header "Authorization: Bearer gpc_..."`).
export default function handler(req: VercelRequest, res: VercelResponse) {
  return rotaMcp(req, res, chaveDoCabecalho(req.headers.authorization))
}
