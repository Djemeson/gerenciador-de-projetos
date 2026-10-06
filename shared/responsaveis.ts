// Os dois responsáveis do gerenciador: o usuário (DJ) e o Claude.
//
// Mora em shared/ porque o app (cor do avatar) e o conector MCP (functions/, que grava o
// responsável) precisam reconhecer o mesmo nome do mesmo jeito. O campo `assignee` continua
// texto livre: qualquer outro nome é aceito e fica como foi digitado.
//
// Regra de atribuição (vale para o conector e para quem cria tarefa pelo Claude): é do
// **Claude** tudo que ele consegue executar de algum jeito (API, script, computer use, modo
// manual); é do **DJ** só o que exige o usuário — decisão, pagamento/chave/senha, falar com
// pessoas, dado pessoal.

export const RESPONSAVEL_DJ = 'DJ'
export const RESPONSAVEL_CLAUDE = 'Claude'

export type QuemE = 'claude' | 'dj' | 'outro'

const comparavel = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

/** Reconhece o responsável sem depender de maiúscula, acento ou espaço sobrando. */
export function quemE(nome: unknown): QuemE {
  const n = comparavel(String(nome ?? ''))
  if (n === 'claude') return 'claude'
  if (n === 'dj' || n === 'djemeson') return 'dj'
  return 'outro'
}

/** "claude" → "Claude", "Djemeson"/"dj" → "DJ"; outro nome fica como veio (aparado). */
export function normalizarResponsavel(nome: unknown): string {
  const s = String(nome ?? '').trim()
  const q = quemE(s)
  return q === 'claude' ? RESPONSAVEL_CLAUDE : q === 'dj' ? RESPONSAVEL_DJ : s
}
