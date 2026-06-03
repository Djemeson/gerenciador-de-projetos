import React from 'react'
import {
  Zap, CheckSquare, Layers, Calendar, Plus, ChevronRight,
  BarChart2, FileText, Inbox, Settings,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useNotificationStore } from '../../stores/useNotificationStore'
import { gutTier, INBOX_PROJECT_ID } from '../../types'
import type { View } from '../../types'

export function Sidebar() {
  const { activeView, activeProjectId, projects, tasks, setView, openNewProject } = useAppStore()
  const { openSettings } = useSettingsStore()
  const notifCount = useNotificationStore(s => s.notifications.length)

  const sortedProjects = [...projects].sort((a, b) => b.gut.score - a.gut.score)
  const inboxCount = tasks.filter(t => t.projectId === INBOX_PROJECT_ID && t.status !== 'done').length

  const navItem = (view: View, label: string, Icon: React.ElementType, badge?: number) => {
    const isActive = activeView === view && !activeProjectId
    return (
      <button key={view} onClick={() => setView(view)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left
          ${isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
        <Icon size={15} className="flex-shrink-0" />
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded-full">{badge}</span>
        )}
      </button>
    )
  }

  return (
    <aside className="w-52 min-w-[208px] flex flex-col bg-gray-50 border-r border-gray-200 h-full select-none">
      <div className="px-4 py-4 flex items-center gap-2.5">
        <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-gray-900">TaskFlow</span>
        {notifCount > 0 && (
          <span className="ml-auto text-[10px] w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-medium">
            {notifCount}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 scrollbar-none">
        <div className="space-y-0.5 mb-3">
          {navItem('inbox',    'Caixa de entrada', Inbox, inboxCount)}
          {navItem('my_tasks', 'Minhas tarefas',   CheckSquare)}
          {navItem('all_tasks','Todas as tarefas', Layers)}
          {navItem('calendar', 'Calendário',       Calendar)}
          {navItem('projects', 'Projetos',         BarChart2)}
          {navItem('reports',  'Relatórios',       FileText)}
        </div>

        <div>
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Projetos</span>
            <button onClick={openNewProject} className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors">
              <Plus size={12} />
            </button>
          </div>

          <div className="space-y-0.5">
            {sortedProjects.map(p => {
              const isActive = activeView === 'project_detail' && activeProjectId === p.id
              const tier     = gutTier(p.gut.score)
              return (
                <button key={p.id} onClick={() => setView('project_detail', p.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left group
                    ${isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <span className="flex-1 truncate text-sm">{p.name}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: tier.bg, color: tier.color }}>{p.gut.score}</span>
                  <ChevronRight size={11} className="opacity-0 group-hover:opacity-40 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-2 py-3">
        <button onClick={openSettings} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0">DJ</div>
          <span className="text-sm text-gray-700 font-medium flex-1 text-left">Djemeson</span>
          <Settings size={13} className="text-gray-400" />
        </button>
      </div>
    </aside>
  )
}
