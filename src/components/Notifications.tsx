import React from 'react'
import { AlertCircle, Clock, Bell, X, AlarmClock, CheckCheck, Zap } from 'lucide-react'
import { useNotificationStore } from '../stores/useNotificationStore'
import { useAppStore } from '../stores/useAppStore'
import { formatarPrazo } from '../lib/dueDate'

const TYPE_CONFIG = {
  overdue:  { icon: AlertCircle, label: 'Em atraso',   bg: 'bg-danger-50',    border: 'border-danger-100',   iconColor: 'text-danger-500',    badge: 'bg-danger-100 text-danger-700' },
  due_today:{ icon: Clock,       label: 'Vence hoje',  bg: 'bg-warning-50', border: 'border-warning-100',iconColor: 'text-warning-600', badge: 'bg-warning-100 text-warning-700' },
  due_soon: { icon: Bell,        label: 'Amanhã',      bg: 'bg-info-50',   border: 'border-info-100',  iconColor: 'text-info-500',   badge: 'bg-info-100 text-info-700' },
  automation:{icon: Zap,         label: 'Automação',   bg: 'bg-brand-50',  border: 'border-brand-200', iconColor: 'text-brand-500',  badge: 'bg-brand-100 text-brand-700' },
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
            <CheckCheck size={12} /> Dispensar todas ({notifications.length})
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
              {n.message && <p className="text-[11px] font-semibold text-gray-700 truncate">{n.message}</p>}
              <p className="text-xs font-medium text-gray-800 truncate">{n.taskTitle}</p>
              {n.dueDate && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Prazo: {formatarPrazo(n.dueDate)}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => openTask(n.taskId)}
                  className="text-[11px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Abrir
                </button>
                {/* Adiar é para lembrete de prazo; notificação de automação só se dispensa. */}
                {n.type !== 'automation' && (
                  <>
                    <button onClick={() => snooze(n.id, 1)}
                      className="text-[11px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1">
                      <AlarmClock size={12} /> 1h
                    </button>
                    <button onClick={() => snooze(n.id, 24)}
                      className="text-[11px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
                      Amanhã
                    </button>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => dismiss(n.id)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 transition-colors">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
