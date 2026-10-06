// Cor e iniciais do responsável — fonte única (DIRETRIZES seção 8.5).
//
// Claude em laranja, DJ (o usuário) em azul claro; qualquer outro nome segue no índigo da
// marca, como sempre foi. Quem desenha avatar, etiqueta ou ponto de responsável lê daqui —
// nunca redigitar estes hex numa tela.

import { quemE, type QuemE } from '../../shared/responsaveis'

export interface AssigneeLook {
  /** Gradiente do avatar (de → até) e cor das iniciais sobre ele (≥ 4.5:1). */
  from: string; to: string; text: string
  /** Variante suave (etiqueta, avatar com borda): fundo, borda e texto (≥ 4.5:1). */
  soft: string; softBorder: string; softText: string
  /** Cor cheia para ponto de grupo e marcadores. */
  dot: string
}

export const ASSIGNEE_LOOK: Record<QuemE, AssigneeLook> = {
  claude: { from: '#FDDCC8', to: '#F4A27A', text: '#7A3215', soft: '#FDEEE5', softBorder: '#F8D5C0', softText: '#93401F', dot: '#D97757' },
  dj:     { from: '#D3E6F8', to: '#8EC1EE', text: '#174573', soft: '#EAF3FC', softBorder: '#D3E6F8', softText: '#215B98', dot: '#4FA3E8' },
  // = brand-200 → brand-400, texto brand-800; suave brand-50/100/700 (o visual de antes).
  outro:  { from: '#C7CCFE', to: '#828BF6', text: '#3730A3', soft: '#EEF0FF', softBorder: '#E0E4FF', softText: '#4338CA', dot: '#6366F1' },
}

export const assigneeLook = (name: string): AssigneeLook => ASSIGNEE_LOOK[quemE(name)]

/** "Claude" vira "CL"; os demais, as duas primeiras letras (DJ, AN…). */
export const assigneeInitials = (name: string): string =>
  quemE(name) === 'claude' ? 'CL' : name.trim().slice(0, 2).toUpperCase()
