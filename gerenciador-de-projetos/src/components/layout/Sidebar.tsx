import React, { useState } from 'react'
import {
  Zap, CheckSquare, Layers, Calendar, Plus, Settings,
  BarChart2, FileText, Inbox, ChevronRight, ChevronDown,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useNotificationStore } from '../../stores/useNotificationStore'
import { gutTier, INBOX_PROJECT_ID } from '../../types'
import type { View } from '../../types'
import { nanoid } from '../../lib/nanoid'

export function Sidebar() {
  const { activeView, activeProjectId, projects, tasks, spaces, setView, openNewProject, addSpace, updateSpace } = useAppStore()
  const { openSettings } = useSettingsStore()
  const notifCount = useNotificationStore(s => s.notifications.length)
  const [addingSpace, setAddingSpace] = useState(false)
  const [spaceName,   setSpaceName]   = useState('')

  const activeProjects = projects.filter(p => !p.archived)
  const inboxCount = tasks.filter(t => t.projectId===INBOX_PROJECT_ID && t.status!=='done').length

  const navItem = (view: View, label: string, Icon: React.ElementType, badge?: number, projectId?: string) => {
    const isActive = activeView===view && (projectId ? activeProjectId===projectId : !activeProjectId || view!=='project_detail')
    return (
      <button onClick={() => setView(view, projectId)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left
          ${isActive?'bg-brand-50 text-brand-700 font-medium':'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
        <Icon size={15} className="flex-shrink-0"/>
        <span className="flex-1 text-sm">{label}</span>
        {badge!=null&&badge>0&&<span className="text-[10px] font-medium px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded-full">{badge}</span>}
      </button>
    )
  }

  const saveSpace = () => {
    if (spaceName.trim()) { addSpace(spaceName.trim(), '#6B5EE8'); setSpaceName(''); setAddingSpace(false) }
  }

  // Group projects by space
  const ungrouped = activeProjects.filter(p => !p.spaceId).sort((a,b) => b.gut.score-a.gut.score)
  const spaceGroups = spaces.map(s => ({
    space: s,
    projects: activeProjects.filter(p => p.spaceId===s.id).sort((a,b) => b.gut.score-a.gut.score),
  }))

  const renderProject = (p: typeof activeProjects[0]) => {
    const isActive = activeView==='project_detail' && activeProjectId===p.id
    const tier = gutTier(p.gut.score)
    return (
      <button key={p.id} onClick={() => setView('project_detail', p.id)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors text-left group
          ${isActive?'bg-brand-50 text-brand-700 font-medium':'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:p.color}}/>
        <span className="flex-1 truncate text-sm">{p.name}</span>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{background:tier.bg,color:tier.color}}>{p.gut.score}</span>
        <ChevronRight size={10} className="opacity-0 group-hover:opacity-40 flex-shrink-0"/>
      </button>
    )
  }

  return (
    <aside className="w-52 min-w-[208px] flex flex-col bg-gray-50 border-r border-gray-200 h-full select-none">
      <div className="px-4 py-4 flex items-center gap-2.5">
        <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white"/>
        </div>
        <span className="text-sm font-semibold text-gray-900">TaskFlow</span>
        {notifCount>0&&<span className="ml-auto text-[10px] w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-medium">{notifCount}</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-none">
        <div className="space-y-0.5 mb-3">
          {navItem('inbox',    'Caixa de entrada', Inbox, inboxCount)}
          {navItem('my_tasks', 'Minhas tarefas',   CheckSquare)}
          {navItem('all_tasks','Todas as tarefas', Layers)}
          {navItem('calendar', 'Calendário',       Calendar)}
          {navItem('projects', 'Projetos',         BarChart2)}
          {navItem('reports',  'Relatórios',       FileText)}
          {navItem('automations','Automações',     Zap)}
        </div>

        {/* Spaces + Projects */}
        <div>
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Espaços</span>
            <div className="flex gap-1">
              <button onClick={() => setAddingSpace(v=>!v)} className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors" title="Novo espaço">
                <Plus size={12}/>
              </button>
            </div>
          </div>

          {addingSpace && (
            <div className="px-2 pb-2 flex gap-1">
              <input autoFocus value={spaceName} onChange={e=>setSpaceName(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter')saveSpace();if(e.key==='Escape')setAddingSpace(false)}}
                placeholder="Nome do espaço..."
                className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"/>
              <button onClick={saveSpace} className="text-xs px-1.5 py-1 bg-brand-600 text-white rounded-lg">OK</button>
            </div>
          )}

          {/* Ungrouped projects */}
          <div className="space-y-0.5 mb-2">
            {ungrouped.map(renderProject)}
            <button onClick={openNewProject} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Plus size={11}/> Novo projeto
            </button>
          </div>

          {/* Spaces with projects */}
          {spaceGroups.map(({ space: s, projects: sp }) => (
            <div key={s.id} className="mb-2">
              <button onClick={() => updateSpace(s.id, {collapsed:!s.collapsed})}
                className="w-full flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
                {s.collapsed?<ChevronRight size={11}/>:<ChevronDown size={11}/>}
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{background:s.color}}/>
                {s.name}
                <span className="ml-auto text-[10px] text-gray-400">{sp.length}</span>
              </button>
              {!s.collapsed && (
                <div className="pl-3 space-y-0.5">
                  {sp.map(renderProject)}
                  <button onClick={() => { openNewProject() }} className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
                    <Plus size={10}/> Adicionar projeto
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 px-2 py-3">
        <button onClick={openSettings} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0">DJ</div>
          <span className="text-sm text-gray-700 font-medium flex-1 text-left">Djemeson</span>
          <Settings size={13} className="text-gray-400"/>
        </button>
      </div>
    </aside>
  )
}
