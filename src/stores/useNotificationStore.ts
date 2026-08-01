import { create } from 'zustand'
import { nanoid } from '../lib/nanoid'
import { parseISO } from '../lib/dateFilter'

export type NotifType = 'overdue' | 'due_today' | 'due_soon' | 'automation'

export interface AppNotification {
  id:         string
  type:       NotifType
  taskId:     string
  taskTitle:  string
  projectName:string
  dueDate:    string
  snoozedUntil?: string
  message?:   string        // texto da automação (type 'automation')
}

interface NotifState {
  notifications: AppNotification[]
  dismissed:     Set<string>  // taskId + date key → não mostra de novo

  generate: (tasks: { id:string; title:string; dueDate:string|null; status:string; projectName:string }[]) => void
  /** Notificação avulsa, disparada por automação (ação "Enviar notificação"). */
  push:     (n: { title: string; body: string; taskId: string; projectName?: string }) => void
  dismiss:  (id: string) => void
  snooze:   (id: string, hours: number) => void
  clearAll: () => void
}

const DISMISS_KEY = 'tf_notif_dismissed'

function loadDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]')) }
  catch { return new Set() }
}
function saveDismissed(s: Set<string>) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...s]))
}

export const useNotificationStore = create<NotifState>((set, get) => ({
  notifications: [],
  dismissed:     loadDismissed(),

  generate: (tasks) => {
    const now     = new Date()
    const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow= new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const { dismissed } = get()
    const notifs: AppNotification[] = []

    tasks.forEach(t => {
      if (t.status === 'done' || !t.dueDate) return
      const due = parseISO(t.dueDate)
      const dKey = `${t.id}-${t.dueDate}`
      if (dismissed.has(dKey)) return

      let type: NotifType | null = null
      if (due < today)      type = 'overdue'
      else if (due < tomorrow) type = 'due_today'
      else if (due < new Date(tomorrow.getTime() + 86400000)) type = 'due_soon'

      if (type) notifs.push({ id: nanoid(), type, taskId: t.id, taskTitle: t.title, projectName: t.projectName, dueDate: t.dueDate })
    })

    // As de automação sobrevivem ao ciclo: `generate` roda a cada minuto e, se
    // substituísse a lista inteira, a notificação disparada por uma regra sumiria antes
    // de ser lida.
    set({ notifications: [...get().notifications.filter(n => n.type === 'automation'), ...notifs] })
  },

  push: ({ title, body, taskId, projectName }) => {
    const n: AppNotification = {
      id: nanoid(), type: 'automation', taskId, taskTitle: body,
      projectName: projectName ?? '', dueDate: '', message: title,
    }
    set(s => ({ notifications: [n, ...s.notifications] }))
  },

  dismiss: (id) => {
    const { notifications, dismissed } = get()
    const n = notifications.find(n => n.id === id)
    // Notificação de automação não tem prazo para virar chave de "não mostrar de novo":
    // dispensar é só tirar da tela.
    if (n?.type === 'automation') {
      set({ notifications: notifications.filter(x => x.id !== id) })
      return
    }
    if (n) {
      const next = new Set(dismissed); next.add(`${n.taskId}-${n.dueDate}`)
      saveDismissed(next)
      set({ notifications: notifications.filter(n => n.id !== id), dismissed: next })
    }
  },

  snooze: (id, hours) => {
    const until = new Date(Date.now() + hours * 3600000).toISOString()
    set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, snoozedUntil: until } : n) }))
    // Hide from view for now; will re-appear on next refresh if still relevant
    set(s => ({ notifications: s.notifications.filter(n => n.id !== id) }))
  },

  clearAll: () => {
    const { notifications, dismissed } = get()
    const next = new Set(dismissed)
    notifications.filter(n => n.type !== 'automation').forEach(n => next.add(`${n.taskId}-${n.dueDate}`))
    saveDismissed(next)
    set({ notifications: [], dismissed: next })
  },
}))
