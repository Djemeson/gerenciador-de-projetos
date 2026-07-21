import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateTaskInsights } from './_lib/insights';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const insights = await generateTaskInsights(req.body);
    res.status(200).json(insights);
  } catch (error: any) {
    console.error('Erro no endpoint /api/insights:', error);
    res.status(500).json({
      error: error.message || 'Ocorreu um erro interno ao gerar os insights com a IA.'
    });
  }
}
