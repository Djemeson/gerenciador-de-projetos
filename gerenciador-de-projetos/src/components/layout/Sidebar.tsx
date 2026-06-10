import React, { useState, useRef, useEffect } from 'react'
import {
  Zap, CheckSquare, Layers, Calendar, Plus, Settings,
  BarChart2, FileText, Inbox, ChevronRight, ChevronDown,
  FolderOpen, Folder as FolderIcon, MoreHorizontal, Pencil, Trash2,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useNotificationStore } from '../../stores/useNotificationStore'
import { gutTier, INBOX_PROJECT_ID } from '../../types'
import type { View, Project, Space, Folder } from '../../types'

export function Sidebar() {
  const {
    activeView, activeProjectId, projects, tasks, spaces, folders,
    setView, openNewProject, addSpace, updateSpace, deleteSpace,
    addFolder, updateFolder, deleteFolder,
  } = useAppStore()
  const { openSettings } = useSettingsStore()
  const notifCount = useNotificationStore(s => s.notifications.length)

  const [addingSpace,     setAddingSpace]     = useState(false)
  const [spaceName,       setSpaceName]       = useState('')
  const [addingFolder,    setAddingFolder]    = useState<string|null>(null)
  const [folderName,      setFolderName]      = useState('')
  const [editingSpace,    setEditingSpace]    = useState<string|null>(null)
  const [editingFolder,   setEditingFolder]   = useState<string|null>(null)
  const [spaceMenu,       setSpaceMenu]       = useState<string|null>(null)
  const [folderMenu,      setFolderMenu]      = useState<string|null>(null)

  const activeProjects = projects.filter(p => !p.archived)
  const inboxCount     = tasks.filter(t => t.projectId===INBOX_PROJECT_ID && t.status!=='done').length

  useEffect(() => {
    const handler = () => { setSpaceMenu(null); setFolderMenu(null) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ─── Nav item ────────────────────────────────────────────────────────────────
  const navItem = (view: View, label: string, Icon: React.ElementType, badge?: number, projectId?: string) => {
    const isActive = activeView===view && (projectId ? activeProjectId===projectId : !activeProjectId || view!=='project_detail')
    return (
      <button
        onClick={() => setView(view, projectId)}
        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors text-left
          ${isActive
            ? 'bg-cu-active text-white font-medium'
            : 'text-cu-text hover:bg-cu-hover hover:text-white'}`}
      >
        <Icon size={15} className="flex-shrink-0"/>
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-brand-500/20 text-brand-300 rounded-full">
            {badge}
          </span>
        )}
      </button>
    )
  }

  const saveSpace = () => {
    if (spaceName.trim()) { addSpace(spaceName.trim(), '#7B68EE'); setSpaceName(''); setAddingSpace(false) }
  }

  const saveFolder = (spaceId: string) => {
    if (folderName.trim()) { addFolder(folderName.trim(), spaceId); setFolderName(''); setAddingFolder(null) }
  }

  // ─── Project item ─────────────────────────────────────────────────────────────
  const renderProject = (p: Project, indent = 0) => {
    const isActive = activeView==='project_detail' && activeProjectId===p.id
    const tier     = gutTier(p.gut.score)
    return (
      <button
        key={p.id}
        onClick={() => setView('project_detail', p.id)}
        className={`w-full flex items-center gap-2 py-1.5 rounded-lg transition-colors text-left group
          ${isActive
            ? 'bg-cu-active text-white font-medium'
            : 'text-cu-text hover:bg-cu-hover hover:text-white'}`}
        style={{ paddingLeft: `${10 + indent * 10}px`, paddingRight: '10px' }}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background: p.color}}/>
        <span className="flex-1 truncate text-[13px]">{p.name}</span>
        <span
          className="text-[9px] font-semibold px-1 py-0.5 rounded-full flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{background: tier.bg, color: tier.color}}
        >{p.gut.score}</span>
      </button>
    )
  }

  const ungrouped   = activeProjects.filter(p => !p.spaceId)
  const spaceGroups = spaces.map(s => {
    const spaceFolders = folders.filter(f => f.spaceId===s.id)
    return {
      space: s,
      folders: spaceFolders.map(f => ({
        folder: f,
        projects: activeProjects.filter(p => p.spaceId===s.id && p.folderId===f.id),
      })),
      ungrouped: activeProjects.filter(p => p.spaceId===s.id && !p.folderId),
    }
  })

  const inputCls = 'flex-1 text-xs px-2 py-1 bg-cu-input border border-cu-border rounded-lg outline-none text-white placeholder:text-cu-muted focus:ring-1 focus:ring-brand-500'

  return (
    <aside className="w-52 min-w-[208px] flex flex-col bg-cu-bg border-r border-cu-border h-full select-none">

      {/* ── Workspace header ── */}
      <div className="px-3 py-3 flex items-center gap-2 border-b border-cu-border">
        <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-white"/>
        </div>
        <span className="text-[13px] font-semibold text-white flex-1 truncate">Djemeson's Workspace</span>
        <ChevronDown size={12} className="text-cu-muted flex-shrink-0"/>
        {notifCount > 0 && (
          <span className="text-[10px] w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
            {notifCount}
          </span>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 sidebar-scroll">

        {/* Primary nav */}
        <div className="space-y-0.5 mt-2 mb-3">
          {navItem('inbox',       'Caixa de entrada', Inbox,      inboxCount)}
          {navItem('my_tasks',    'Minhas tarefas',   CheckSquare)}
          {navItem('all_tasks',   'Todas as tarefas', Layers)}
          {navItem('calendar',    'Calendário',       Calendar)}
          {navItem('projects',    'Projetos',         BarChart2)}
          {navItem('reports',     'Relatórios',       FileText)}
          {navItem('automations', 'Automações',       Zap)}
        </div>

        {/* Spaces */}
        <div>
          <div className="flex items-center justify-between px-2.5 py-1 mb-0.5">
            <span className="text-[10px] font-semibold text-cu-muted uppercase tracking-wider">Espaços</span>
            <button
              onClick={() => setAddingSpace(v => !v)}
              className="w-5 h-5 flex items-center justify-center rounded text-cu-muted hover:bg-cu-hover hover:text-white transition-colors"
              title="Novo espaço"
            ><Plus size={12}/></button>
          </div>

          {addingSpace && (
            <div className="px-2 pb-2 flex gap-1">
              <input
                autoFocus
                value={spaceName}
                onChange={e => setSpaceName(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter') saveSpace(); if(e.key==='Escape') setAddingSpace(false) }}
                placeholder="Nome do espaço..."
                className={inputCls}
              />
              <button onClick={saveSpace} className="text-xs px-1.5 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">OK</button>
            </div>
          )}

          {/* Ungrouped projects */}
          {ungrouped.length > 0 && (
            <div className="space-y-0.5 mb-1">
              {ungrouped.map(p => renderProject(p))}
            </div>
          )}
          <button
            onClick={openNewProject}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-cu-muted hover:bg-cu-hover hover:text-white transition-colors"
          >
            <Plus size={11}/> Novo projeto
          </button>

          {/* Space groups */}
          {spaceGroups.map(({ space: s, folders: sfolders, ungrouped: sup }) => (
            <div key={s.id} className="mt-2">

              {/* Space header */}
              <div className="flex items-center gap-0.5 group/space">
                <button
                  onClick={() => updateSpace(s.id, {collapsed: !s.collapsed})}
                  className="flex items-center gap-1.5 flex-1 px-2 py-1 text-[11px] font-semibold text-cu-text hover:text-white transition-colors rounded-lg hover:bg-cu-hover"
                >
                  {s.collapsed ? <ChevronRight size={11} className="text-cu-muted"/> : <ChevronDown size={11} className="text-cu-muted"/>}
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{background: s.color}}/>
                  {editingSpace === s.id ? (
                    <input
                      autoFocus
                      defaultValue={s.name}
                      onBlur={e => { updateSpace(s.id, {name: e.target.value}); setEditingSpace(null) }}
                      onKeyDown={e => { if(e.key==='Enter') (e.target as HTMLInputElement).blur(); if(e.key==='Escape') setEditingSpace(null) }}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 bg-transparent outline-none text-[11px] border-b border-brand-400 text-white"
                    />
                  ) : (
                    <span className="flex-1 truncate">{s.name}</span>
                  )}
                </button>

                {/* Space menu */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); setSpaceMenu(spaceMenu===s.id ? null : s.id) }}
                    className="w-5 h-5 opacity-0 group-hover/space:opacity-100 flex items-center justify-center rounded text-cu-muted hover:bg-cu-hover hover:text-white transition-all"
                  ><MoreHorizontal size={11}/></button>

                  {spaceMenu === s.id && (
                    <div
                      className="absolute right-0 top-5 z-50 bg-cu-active border border-cu-border rounded-xl shadow-2xl py-1 min-w-[150px]"
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <button onClick={() => { setAddingFolder(s.id); setSpaceMenu(null) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                        <FolderOpen size={11}/> Nova pasta
                      </button>
                      <button onClick={() => { openNewProject(); setSpaceMenu(null) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                        <Plus size={11}/> Novo projeto
                      </button>
                      <div className="h-px bg-cu-border my-1"/>
                      <button onClick={() => { setEditingSpace(s.id); setSpaceMenu(null) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                        <Pencil size={11}/> Renomear
                      </button>
                      <button onClick={() => { deleteSpace(s.id); setSpaceMenu(null) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={11}/> Excluir espaço
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!s.collapsed && (
                <div className="pl-2">

                  {/* Folders */}
                  {sfolders.map(({ folder: f, projects: fp }) => (
                    <div key={f.id} className="mt-0.5">
                      <div className="flex items-center gap-0.5 group/folder">
                        <button
                          onClick={() => updateFolder(f.id, {collapsed: !f.collapsed})}
                          className="flex items-center gap-1.5 flex-1 px-2 py-1 text-[11px] font-medium text-cu-text hover:text-white transition-colors rounded-lg hover:bg-cu-hover"
                        >
                          {f.collapsed ? <ChevronRight size={10} className="text-cu-muted"/> : <ChevronDown size={10} className="text-cu-muted"/>}
                          {f.collapsed
                            ? <FolderIcon size={11} className="text-amber-400"/>
                            : <FolderOpen  size={11} className="text-amber-400"/>}
                          {editingFolder === f.id ? (
                            <input
                              autoFocus
                              defaultValue={f.name}
                              onBlur={e => { updateFolder(f.id, {name: e.target.value}); setEditingFolder(null) }}
                              onKeyDown={e => { if(e.key==='Enter') (e.target as HTMLInputElement).blur(); if(e.key==='Escape') setEditingFolder(null) }}
                              onClick={e => e.stopPropagation()}
                              className="flex-1 bg-transparent outline-none text-[11px] border-b border-brand-400 text-white"
                            />
                          ) : (
                            <span className="flex-1 truncate">{f.name}</span>
                          )}
                          <span className="text-[9px] text-cu-muted ml-auto">{fp.length}</span>
                        </button>

                        {/* Folder menu */}
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); setFolderMenu(folderMenu===f.id ? null : f.id) }}
                            className="w-5 h-5 opacity-0 group-hover/folder:opacity-100 flex items-center justify-center rounded text-cu-muted hover:bg-cu-hover hover:text-white transition-all"
                          ><MoreHorizontal size={10}/></button>

                          {folderMenu === f.id && (
                            <div
                              className="absolute right-0 top-5 z-50 bg-cu-active border border-cu-border rounded-xl shadow-2xl py-1 min-w-[140px]"
                              onMouseDown={e => e.stopPropagation()}
                            >
                              <button onClick={() => { openNewProject(); setFolderMenu(null) }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                                <Plus size={11}/> Novo projeto
                              </button>
                              <button onClick={() => { setEditingFolder(f.id); setFolderMenu(null) }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                                <Pencil size={11}/> Renomear
                              </button>
                              <button onClick={() => { deleteFolder(f.id); setFolderMenu(null) }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                                <Trash2 size={11}/> Excluir pasta
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {!f.collapsed && (
                        <div className="pl-2 space-y-0.5">
                          {fp.map(p => renderProject(p, 1))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add folder input */}
                  {addingFolder === s.id && (
                    <div className="flex gap-1 px-1 py-1">
                      <input
                        autoFocus
                        value={folderName}
                        onChange={e => setFolderName(e.target.value)}
                        onKeyDown={e => { if(e.key==='Enter') saveFolder(s.id); if(e.key==='Escape') setAddingFolder(null) }}
                        placeholder="Nome da pasta..."
                        className={inputCls + ' text-[11px]'}
                      />
                      <button onClick={() => saveFolder(s.id)} className="text-[11px] px-1.5 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">OK</button>
                    </div>
                  )}

                  {/* Ungrouped projects in space */}
                  <div className="space-y-0.5 mt-0.5">
                    {sup.map(p => renderProject(p, 0))}
                  </div>

                  {/* Quick-add row */}
                  <div className="flex gap-1 px-1 mt-0.5">
                    <button onClick={() => { setAddingFolder(s.id); setSpaceMenu(null) }}
                      className="flex items-center gap-1 text-[11px] text-cu-muted hover:text-white px-2 py-1 rounded hover:bg-cu-hover transition-colors">
                      <FolderOpen size={10}/> Pasta
                    </button>
                    <button onClick={openNewProject}
                      className="flex items-center gap-1 text-[11px] text-cu-muted hover:text-white px-2 py-1 rounded hover:bg-cu-hover transition-colors">
                      <Plus size={10}/> Projeto
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer / User ── */}
      <div className="border-t border-cu-border px-2 py-3">
        <button
          onClick={openSettings}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-cu-hover transition-colors group"
        >
          <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-[10px] text-white font-semibold flex-shrink-0">
            DJ
          </div>
          <span className="text-[13px] text-cu-text font-medium flex-1 text-left group-hover:text-white transition-colors">Djemeson</span>
          <Settings size={13} className="text-cu-muted group-hover:text-white transition-colors"/>
        </button>
      </div>
    </aside>
  )
}
