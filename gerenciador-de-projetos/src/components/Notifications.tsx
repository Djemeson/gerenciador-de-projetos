import React from 'react'
import { AlertCircle, Clock, Bell, X, AlarmClock, CheckCheck } from 'lucide-react'
import { useNotificationStore } from '../stores/useNotificationStore'
import { useAppStore } from '../stores/useAppStore'

const TYPE_CONFIG = {
  overdue:  { icon: AlertCircle, label: 'Em atraso',   bg: 'bg-red-50',    border: 'border-red-200',   iconColor: 'text-red-500',    badge: 'bg-red-100 text-red-700' },
  due_today:{ icon: Clock,       label: 'Vence hoje',  bg: 'bg-orange-50', border: 'border-orange-200',iconColor: 'text-orange-500', badge: 'bg-orange-100 text-orange-700' },
  due_soon: { icon: Bell,        label: 'Amanhã',      bg: 'bg-blue-50',   border: 'border-blue-200',  iconColor: 'text-blue-500',   badge: 'bg-blue-100 text-blue-700' },
}

export function Notifications() {
  const { notifications, dismiss, snooze, clearAll } = useNotificationStore()
  const { setSelectedTask, setView } = useAppStore()

  const visible = notifications.slice(0, 5)
  if (visible.length === 0) return null

  const openTask = (taskId: string) => {
    setView('my_tasks')
    setSelectedTask(taskId)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {notifications.length > 1 && (
        <div className="flex justify-end">
          <button onClick={clearAll} className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
            <CheckCheck size={10} /> Dispensar todas ({notifications.length})
          </button>
        </div>
      )}

      {visible.map(n => {
        const cfg = TYPE_CONFIG[n.type]
        const Icon = cfg.icon
        return (
          <div key={n.id}
            className={`${cfg.bg} ${cfg.border} border rounded-xl p-3 shadow-lg flex gap-3 items-start animate-slide-in`}>
            <Icon size={16} className={`${cfg.iconColor} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                {n.projectName && <span className="text-[10px] text-gray-400 truncate">{n.projectName}</span>}
              </div>
              <p className="text-xs font-medium text-gray-800 truncate">{n.taskTitle}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Prazo: {new Date(n.dueDate).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => openTask(n.taskId)}
                  className="text-[11px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Abrir
                </button>
                <button onClick={() => snooze(n.id, 1)}
                  className="text-[11px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1">
                  <AlarmClock size={10} /> 1h
                </button>
                <button onClick={() => snooze(n.id, 24)}
                  className="text-[11px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
                  Amanhã
                </button>
              </div>
            </div>
            <button onClick={() => dismiss(n.id)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 transition-colors">
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
