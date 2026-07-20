// ── Quadro branco — tipos e persistência (por escopo, em localStorage) ──────

export type WhiteboardTool = 'select' | 'pen' | 'rectangle' | 'diamond' | 'ellipse' | 'arrow' | 'text'
export type WhiteboardElementType = 'pen' | 'rectangle' | 'diamond' | 'ellipse' | 'arrow' | 'text'

export interface WhiteboardPoint { x: number; y: number }

export interface WhiteboardElement {
  id:    string
  type:  WhiteboardElementType
  color: string
  // 'pen' — traçado livre
  points?: WhiteboardPoint[]
  // 'rectangle' | 'diamond' | 'ellipse' — caixa delimitadora
  x?: number; y?: number; w?: number; h?: number
  // 'arrow' — início/fim
  x1?: number; y1?: number; x2?: number; y2?: number
  // 'text'
  text?: string
}

const KEY = (scope: string) => `tf_whiteboard_${scope}`

export function loadWhiteboard(scope: string): WhiteboardElement[] {
  try { const v = localStorage.getItem(KEY(scope)); return v ? JSON.parse(v) as WhiteboardElement[] : [] }
  catch { return [] }
}

export function saveWhiteboard(scope: string, elements: WhiteboardElement[]): void {
  try { localStorage.setItem(KEY(scope), JSON.stringify(elements)) } catch { /* ignore */ }
}

export const WHITEBOARD_COLORS = ['#1F2937', '#E24B4A', '#D85A30', '#BA7517', '#1D9E75', '#378ADD', '#6366F1', '#D4537E']

export const CANVAS_W = 2400
export const CANVAS_H = 1400
