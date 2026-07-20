// Histórico persistente das conversas do "Pergunte à IA" — local-first (mesmo
// padrão do resto do app: localStorage, sem backend). Cada conversa é uma
// thread independente, com título derivado da primeira mensagem, listável e
// retomável a qualquer momento pelo painel de histórico.

export interface ChatToolCall { summary: string; kind: 'success' | 'info' | 'warning' | 'error' }
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ChatToolCall[]
  pendingConfirm?: { kind: 'delete_task'; taskId: string; title: string; resolved?: 'confirmed' | 'cancelled' }
}
export interface ChatConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

const KEY = 'tf_ai_conversations'

export function loadConversations(): ChatConversation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}

function saveAll(list: ChatConversation[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))) } catch { /* noop */ }
}

export function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find(m => m.role === 'user')?.content?.trim()
  if (!first) return 'Nova conversa'
  return first.length > 48 ? first.slice(0, 48).trim() + '…' : first
}

/** Cria ou atualiza uma conversa (por id) na lista persistida, mais recente primeiro. */
export function upsertConversation(conv: ChatConversation) {
  const list = loadConversations()
  const idx = list.findIndex(c => c.id === conv.id)
  const next = { ...conv, title: deriveTitle(conv.messages), updatedAt: new Date().toISOString() }
  if (idx >= 0) list[idx] = next
  else list.unshift(next)
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  saveAll(list)
}

export function deleteConversation(id: string) {
  saveAll(loadConversations().filter(c => c.id !== id))
}

export function newConversationId(): string {
  return 'conv_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// Ponteiro para a conversa em andamento — sobrevive ao fechar/abrir o painel
// (que desmonta o componente) e a um recarregamento de página.
const CURRENT_KEY = 'tf_ai_current_conversation'
export function getCurrentConversationId(): string | null {
  try { return localStorage.getItem(CURRENT_KEY) } catch { return null }
}
export function setCurrentConversationId(id: string) {
  try { localStorage.setItem(CURRENT_KEY, id) } catch { /* noop */ }
}

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
