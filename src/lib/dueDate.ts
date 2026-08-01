import { parseISO } from './dateFilter'

/**
 * Prazo: leitura e comparação.
 *
 * **Dois defeitos que isto existe para consertar**, ambos vindos de `new Date(t.dueDate)`
 * espalhado por dez arquivos:
 *
 * 1. **A data aparecia um dia antes.** Prazo é gravado como `'2026-08-20'`, e o construtor
 *    do `Date` lê data pura como meia-noite **UTC**. Em UTC−3 isso vira 19/08 às 21h, então
 *    a lista, o board e a tabela mostravam 19 de agosto.
 * 2. **Tarefa que vence hoje já contava como atrasada.** Pelo mesmo motivo, o prazo de hoje
 *    virava "ontem 21h", que é menor que agora — a tarefa nascia vermelha no dia em que
 *    ainda havia o dia inteiro para fazê-la.
 *
 * O segundo não se resolve só trocando o parser: mesmo lendo como meia-noite local, o prazo
 * de hoje continua menor que "agora" às 11h. Atraso tem que ser medido contra o **começo de
 * hoje** — só é atrasada a tarefa cujo prazo já virou.
 */

/** Meia-noite de hoje, no fuso do usuário. */
export function inicioDeHoje(agora: Date = new Date()): Date {
  const d = new Date(agora)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * `true` só quando o prazo **já passou**. Vencer hoje não é atraso, e tarefa concluída
 * nunca é — reabrir o assunto de uma tarefa pronta por causa da data seria ruído.
 */
export function estaAtrasada(
  dueDate: string | null | undefined,
  status?: string,
  agora: Date = new Date(),
): boolean {
  if (!dueDate || status === 'done') return false
  const d = parseISO(dueDate)
  return !isNaN(+d) && d < inicioDeHoje(agora)
}

/** `true` quando o prazo é exatamente hoje. */
export function venceHoje(dueDate: string | null | undefined, agora: Date = new Date()): boolean {
  if (!dueDate) return false
  const d = parseISO(dueDate)
  return !isNaN(+d) && d.getTime() === inicioDeHoje(agora).getTime()
}

/** Data do prazo para exibição, sem o deslocamento de fuso. */
export function formatarPrazo(
  dueDate: string,
  opcoes: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' },
): string {
  const d = parseISO(dueDate)
  return isNaN(+d) ? dueDate : d.toLocaleDateString('pt-BR', opcoes)
}
