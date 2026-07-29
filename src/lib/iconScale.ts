/**
 * Escala de ícones do app — quatro degraus, um só.
 *
 * O levantamento de 29/07/2026 encontrou **14 tamanhos diferentes** em uso (7, 9, 10, 11,
 * 12, 12.5, 13, 14, 15, 16, 17, 18, 22, 24), nove deles numa única tela, e nenhum era "o
 * padrão" — 13 e 12 disputavam o mesmo papel com 92 e 91 usos.
 *
 * Abaixo de 12px havia também um problema técnico, não estético: o lucide desenha numa
 * grade de 24px com traço 2, então a 9–10px o traço renderizado fica abaixo de 1px, o
 * navegador antisserrilha e o ícone "esfarela". Por isso o menor degrau é 12.
 *
 * Use sempre estes valores; `size={13}` ou `size={10}` soltos voltam a quebrar a escala.
 */
export const ICON = {
  /** 12 — dentro de células densas, badges e rótulos pequenos. */
  dense: 12,
  /** 14 — padrão: ao lado de texto, itens de menu, abas. */
  base: 14,
  /** 16 — botões de ação, cabeçalhos de seção. */
  action: 16,
  /** 18 — navegação e títulos de tela. */
  nav: 18,
} as const

export type IconSize = typeof ICON[keyof typeof ICON]
