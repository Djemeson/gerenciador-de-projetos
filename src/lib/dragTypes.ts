/**
 * Tipos de MIME usados no `dataTransfer` para arrastar entre componentes distantes.
 *
 * Reordenar tarefa dentro da lista usa estado local (`dragTaskId`), que basta enquanto tudo
 * acontece dentro do mesmo componente. Arrastar uma tarefa da lista **para um projeto na
 * barra lateral** cruza dois ramos da árvore que não compartilham estado — aí o canal é o
 * `dataTransfer` do próprio navegador.
 *
 * O tipo precisa ser minúsculo: o `DataTransfer` normaliza as chaves para caixa baixa, e
 * comparar com uma string em maiúsculas em `e.dataTransfer.types` nunca casaria.
 */
export const TIPO_ARRASTE_TAREFA = 'application/x-tarefa-id'

/** `true` quando o que está sendo arrastado é uma tarefa. */
export function arrastandoTarefa(e: { dataTransfer: DataTransfer | null }): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes(TIPO_ARRASTE_TAREFA)
}
