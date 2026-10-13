// Modelos de IA do app — fonte única.
//
// Antes cada arquivo tinha a sua constante (AIPanel, aiProjectGen, aiSummary). Quando o
// Google desligou o gemini-2.0-flash, as três cópias quebraram juntas e em silêncio: o
// padrão híbrido (DIRETRIZES 15.3) faz toda falha cair no modo local, então nada dava erro
// — a IA só parecia "burra". Trocar o modelo agora é mexer numa linha.
//
// Escolha de 13/10/2026: gemini-3.5-flash-lite é o recomendado pelo Google para projetos
// novos na faixa barata (ai.google.dev/gemini-api/docs/models). Antes de trocar, conferir
// a página de modelos e a de descontinuação (/gemini-api/docs/deprecations).

export const OPENAI_MODEL = 'gpt-4o-mini'
export const GEMINI_MODEL = 'gemini-3.5-flash-lite'

/** Endpoint `generateContent` do Gemini com a chave do usuário. */
export const urlGemini = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
