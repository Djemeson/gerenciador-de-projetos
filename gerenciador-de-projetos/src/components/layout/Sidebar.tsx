import React, { useState, useEffect } from 'react'
import {
  Zap, CheckSquare, Layers, Calendar, Plus, Settings,
  BarChart2, FileText, Inbox, ChevronRight, ChevronDown,
  FolderOpen, Folder as FolderIcon, MoreHorizontal, Pencil, Trash2,
  Smile, ArrowRightLeft, Target, Archive, Check, List,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useNotificationStore } from '../../stores/useNotificationStore'
import { gutTier, INBOX_PROJECT_ID } from '../../types'
import type { View, Project, Space, Folder } from '../../types'
import { EmojiPicker } from '../ui/EmojiPicker'

type IconTarget = { kind: 'space' | 'folder' | 'project'; id: string }

export function Sidebar() {
  const {
    activeView, activeProjectId, activeSpaceId, activeFolderId,
    projects, tasks, spaces, folders,
    setView, openSpace, openFolder, openNewProject, addSpace, updateSpace, deleteSpace,
    addFolder, updateFolder, deleteFolder,
    updateProject, moveProject, reorderProject, archiveProject, deleteProject, openGUT,
  } = useAppStore()
  const { openSettings } = useSettingsStore()
  const notifCount = useNotificationStore(s => s.notifications.length)

  const [addingSpace,   setAddingSpace]   = useState(false)
  const [spaceName,     setSpaceName]     = useState('')
  const [addingFolder,  setAddingFolder]  = useState<string|null>(null)
  const [folderName,    setFolderName]    = useState('')
  const [editingSpace,  setEditingSpace]  = useState<string|null>(null)
  const [editingFolder, setEditingFolder] = useState<string|null>(null)
  const [dragProjId,    setDragProjId]    = useState<string|null>(null)
  const [dropHint,      setDropHint]      = useState<string|null>(null)  // id do alvo destacado
  const [editingProject,setEditingProject]= useState<string|null>(null)
  const [spaceMenu,     setSpaceMenu]     = useState<string|null>(null)
  const [folderMenu,    setFolderMenu]    = useState<string|null>(null)
  const [projectMenu,   setProjectMenu]   = useState<string|null>(null)
  const [moveMenu,      setMoveMenu]      = useState<string|null>(null)
  const [iconPicker,    setIconPicker]    = useState<IconTarget|null>(null)

  const activeProjects = projects.filter(p => !p.archived)
  const inboxCount     = tasks.filter(t => t.projectId===INBOX_PROJECT_ID && t.status!=='done').length
  const taskCount      = (pid: string) => tasks.filter(t => t.projectId===pid).length

  const closeAllMenus = () => { setSpaceMenu(null); setFolderMenu(null); setProjectMenu(null); setMoveMenu(null); setIconPicker(null) }
  useEffect(() => {
    const handler = () => closeAllMenus()
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

  // ─── Icon badges ───────────────────────────────────────────────────────────
  const spaceBadge = (s: Space) => s.icon
    ? <span className="w-5 h-5 rounded-md flex items-center justify-center text-[13px] leading-none flex-shrink-0" style={{ background: `${s.color}26` }}>{s.icon}</span>
    : <span className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold text-white leading-none flex-shrink-0" style={{ background: s.color }}>{s.name.charAt(0).toUpperCase() || '#'}</span>

  const folderBadge = (f: Folder, open: boolean) => f.icon
    ? <span className="w-[18px] flex items-center justify-center text-[13px] leading-none flex-shrink-0">{f.icon}</span>
    : (open
        ? <FolderOpen size={14} className="text-amber-400 flex-shrink-0"/>
        : <FolderIcon size={14} className="text-amber-400 flex-shrink-0"/>)

  const projectBadge = (p: Project) => p.icon
    ? <span className="w-[18px] flex items-center justify-center text-[13px] leading-none flex-shrink-0">{p.icon}</span>
    : <span className="w-[18px] flex items-center justify-center flex-shrink-0">
        <span className="w-3 h-3 rounded-[4px]" style={{ background: p.color }}/>
      </span>

  // ─── Move-to submenu ─────────────────────────────────────────────────────────
  const moveSubmenu = (p: Project) => (
    <div
      className="absolute right-0 top-6 z-[60] bg-cu-active border border-cu-border rounded-xl shadow-2xl py-1 min-w-[180px] max-h-[280px] overflow-y-auto sidebar-scroll"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-cu-muted uppercase tracking-wider">Mover para</div>
      <button
        onClick={() => { moveProject(p.id, null, null); closeAllMenus() }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors"
      >
        <Inbox size={12} className="flex-shrink-0"/>
        <span className="flex-1 text-left truncate">Sem espaço</span>
        {!p.spaceId && <Check size={12} className="text-brand-400"/>}
      </button>
      {spaces.map(s => {
        const sFolders = folders.filter(f => f.spaceId===s.id)
        const atRoot = p.spaceId===s.id && !p.folderId
        return (
          <div key={s.id}>
            <button
              onClick={() => { moveProject(p.id, s.id, null); closeAllMenus() }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors"
            >
              {spaceBadge(s)}
              <span className="flex-1 text-left truncate">{s.name}</span>
              {atRoot && <Check size={12} className="text-brand-400"/>}
            </button>
            {sFolders.map(f => {
              const here = p.spaceId===s.id && p.folderId===f.id
              return (
                <button
                  key={f.id}
                  onClick={() => { moveProject(p.id, s.id, f.id); closeAllMenus() }}
                  className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors"
                >
                  {folderBadge(f, false)}
                  <span className="flex-1 text-left truncate">{f.name}</span>
                  {here && <Check size={12} className="text-brand-400"/>}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )

  // ─── Drag & drop de projetos ───────────────────────────────────────────────
  const onDropProject = (target: Project) => {
    if (dragProjId && dragProjId !== target.id) {
      const dragged = projects.find(p => p.id === dragProjId)
      if (dragged && (dragged.spaceId !== target.spaceId || dragged.folderId !== target.folderId))
        moveProject(dragProjId, target.spaceId, target.folderId)
      reorderProject(dragProjId, target.id)
    }
    setDragProjId(null); setDropHint(null)
  }
  const onDropContainer = (spaceId: string|null, folderId: string|null) => {
    if (dragProjId) moveProject(dragProjId, spaceId, folderId)
    setDragProjId(null); setDropHint(null)
  }

  // ─── Project item ─────────────────────────────────────────────────────────────
  const renderProject = (p: Project, indent = 0) => {
    const isActive = activeView==='project_detail' && activeProjectId===p.id
    const tier     = gutTier(p.gut.score)
    const count    = taskCount(p.id)
    return (
      <div key={p.id}
        draggable
        onDragStart={e => { setDragProjId(p.id); e.dataTransfer.effectAllowed = 'move' }}
        onDragOver={e => { e.preventDefault(); if (dragProjId && dropHint !== p.id) setDropHint(p.id) }}
        onDragLeave={() => setDropHint(h => (h === p.id ? null : h))}
        onDrop={e => { e.preventDefault(); onDropProject(p) }}
        onDragEnd={() => { setDragProjId(null); setDropHint(null) }}
        className={`flex items-center gap-0.5 group/proj rounded-lg ${dragProjId===p.id ? 'opacity-40' : ''} ${dropHint===p.id && dragProjId!==p.id ? 'ring-1 ring-brand-400 ring-inset' : ''}`}>
        <button
          onClick={() => setView('project_detail', p.id)}
          className={`flex items-center gap-2 flex-1 min-w-0 py-1.5 rounded-lg transition-colors text-left
            ${isActive ? 'bg-cu-active text-white font-medium' : 'text-cu-text hover:bg-cu-hover hover:text-white'}`}
          style={{ paddingLeft: `${8 + indent * 12}px`, paddingRight: '8px' }}
        >
          {projectBadge(p)}
          {editingProject === p.id ? (
            <input
              autoFocus
              defaultValue={p.name}
              onBlur={e => { const v=e.target.value.trim(); if(v) updateProject(p.id,{name:v}); setEditingProject(null) }}
              onKeyDown={e => { if(e.key==='Enter') (e.target as HTMLInputElement).blur(); if(e.key==='Escape') setEditingProject(null) }}
              onClick={e => e.stopPropagation()}
              className="flex-1 bg-transparent outline-none text-[13px] border-b border-brand-400 text-white"
            />
          ) : (
            <span className="flex-1 truncate text-[13px]">{p.name}</span>
          )}
          {count > 0 && (
            <span className="text-[10px] text-cu-muted flex-shrink-0 group-hover/proj:hidden">{count}</span>
          )}
          <span
            className="text-[9px] font-semibold px-1 py-0.5 rounded-full flex-shrink-0 hidden group-hover/proj:inline"
            style={{ background: tier.bg, color: tier.color }}
            title={`GUT ${p.gut.score}`}
          >{p.gut.score}</span>
        </button>

        {/* Project menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setProjectMenu(projectMenu===p.id ? null : p.id); setMoveMenu(null); setIconPicker(null) }}
            className="w-5 h-5 opacity-0 group-hover/proj:opacity-100 flex items-center justify-center rounded text-cu-muted hover:bg-cu-hover hover:text-white transition-all"
          ><MoreHorizontal size={12}/></button>

          {iconPicker?.kind==='project' && iconPicker.id===p.id && (
            <EmojiPicker
              className="absolute right-0 top-6"
              onPick={emoji => updateProject(p.id, { icon: emoji })}
              onClose={() => setIconPicker(null)}
            />
          )}

          {projectMenu === p.id && (
            <div
              className="absolute right-0 top-6 z-50 bg-cu-active border border-cu-border rounded-xl shadow-2xl py-1 min-w-[170px]"
              onMouseDown={e => e.stopPropagation()}
            >
              <button onClick={() => { setEditingProject(p.id); closeAllMenus() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                <Pencil size={12}/> Renomear
              </button>
              <button onClick={() => { setIconPicker({kind:'project',id:p.id}); setProjectMenu(null); setMoveMenu(null) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                <Smile size={12}/> Alterar ícone
              </button>
              <div className="relative">
                <button onClick={() => setMoveMenu(moveMenu===p.id ? null : p.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                  <ArrowRightLeft size={12}/> <span className="flex-1 text-left">Mover para</span> <ChevronRight size={12}/>
                </button>
                {moveMenu === p.id && moveSubmenu(p)}
              </div>
              <button onClick={() => { openGUT(p.id); closeAllMenus() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                <Target size={12}/> Pontuação GUT
              </button>
              <div className="h-px bg-cu-border my-1"/>
              <button onClick={() => { archiveProject(p.id); closeAllMenus() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                <Archive size={12}/> Arquivar
              </button>
              <button onClick={() => { deleteProject(p.id); closeAllMenus() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 size={12}/> Excluir
              </button>
            </div>
          )}
        </div>
      </div>
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

          {/* Empty state: no spaces yet */}
          {spaces.length === 0 && !addingSpace && (
            <button
              onClick={() => setAddingSpace(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-cu-muted hover:bg-cu-hover hover:text-white transition-colors"
            >
              <Plus size={11}/> Criar espaço
            </button>
          )}

          {/* Space groups */}
          {spaceGroups.map(({ space: s, folders: sfolders, ungrouped: sup }) => (
            <div key={s.id} className="mt-0.5">

              {/* Space header */}
              <div
                onDragOver={e => { if (dragProjId) { e.preventDefault(); if (dropHint !== 'sp:'+s.id) setDropHint('sp:'+s.id) } }}
                onDragLeave={() => setDropHint(h => (h === 'sp:'+s.id ? null : h))}
                onDrop={e => { e.preventDefault(); onDropContainer(s.id, null) }}
                className={`flex items-center gap-0.5 group/space rounded-lg ${activeView==='space_detail' && activeSpaceId===s.id ? 'bg-cu-active' : ''} ${dropHint==='sp:'+s.id ? 'ring-1 ring-brand-400 ring-inset' : ''}`}>
                <button
                  onClick={() => updateSpace(s.id, {collapsed: !s.collapsed})}
                  title={s.collapsed ? 'Expandir' : 'Recolher'}
                  className="w-5 h-7 flex items-center justify-center flex-shrink-0 rounded text-cu-muted hover:text-white hover:bg-cu-hover transition-colors"
                >
                  {s.collapsed ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}
                </button>
                <button
                  onClick={() => openSpace(s.id)}
                  className={`flex items-center gap-1.5 flex-1 min-w-0 px-1 py-1.5 text-[13px] font-semibold transition-colors rounded-lg hover:bg-cu-hover
                    ${activeView==='space_detail' && activeSpaceId===s.id ? 'text-white' : 'text-white/90 hover:text-white'}`}
                >
                  {spaceBadge(s)}
                  {editingSpace === s.id ? (
                    <input
                      autoFocus
                      defaultValue={s.name}
                      onBlur={e => { updateSpace(s.id, {name: e.target.value}); setEditingSpace(null) }}
                      onKeyDown={e => { if(e.key==='Enter') (e.target as HTMLInputElement).blur(); if(e.key==='Escape') setEditingSpace(null) }}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 bg-transparent outline-none text-[13px] border-b border-brand-400 text-white"
                    />
                  ) : (
                    <span className="flex-1 truncate text-left">{s.name}</span>
                  )}
                </button>

                {/* Space actions */}
                <div className="relative flex-shrink-0 flex items-center">
                  <button
                    onClick={e => { e.stopPropagation(); setSpaceMenu(spaceMenu===s.id ? null : s.id); setIconPicker(null) }}
                    className="w-5 h-5 opacity-0 group-hover/space:opacity-100 flex items-center justify-center rounded text-cu-muted hover:bg-cu-hover hover:text-white transition-all"
                  ><MoreHorizontal size={13}/></button>
                  <button
                    onClick={e => { e.stopPropagation(); openNewProject(s.id) }}
                    className="w-5 h-5 opacity-0 group-hover/space:opacity-100 flex items-center justify-center rounded text-cu-muted hover:bg-cu-hover hover:text-white transition-all"
                    title="Novo projeto"
                  ><Plus size={13}/></button>

                  {iconPicker?.kind==='space' && iconPicker.id===s.id && (
                    <EmojiPicker
                      className="absolute right-0 top-6"
                      onPick={emoji => updateSpace(s.id, { icon: emoji })}
                      onClose={() => setIconPicker(null)}
                    />
                  )}

                  {spaceMenu === s.id && (
                    <div
                      className="absolute right-0 top-6 z-50 bg-cu-active border border-cu-border rounded-xl shadow-2xl py-1 min-w-[160px]"
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <button onClick={() => { openNewProject(s.id); closeAllMenus() }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                        <Plus size={12}/> Novo projeto
                      </button>
                      <button onClick={() => { setAddingFolder(s.id); closeAllMenus() }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                        <FolderOpen size={12}/> Nova pasta
                      </button>
                      <button onClick={() => { setIconPicker({kind:'space',id:s.id}); setSpaceMenu(null) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                        <Smile size={12}/> Alterar ícone
                      </button>
                      <div className="h-px bg-cu-border my-1"/>
                      <button onClick={() => { setEditingSpace(s.id); closeAllMenus() }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                        <Pencil size={12}/> Renomear
                      </button>
                      <button onClick={() => { deleteSpace(s.id); closeAllMenus() }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={12}/> Excluir espaço
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!s.collapsed && (
                <div className="ml-3 pl-1.5 border-l border-cu-border/60">

                  {/* Folders */}
                  {sfolders.map(({ folder: f, projects: fp }) => (
                    <div key={f.id} className="mt-0.5">
                      <div
                        onDragOver={e => { if (dragProjId) { e.preventDefault(); if (dropHint !== 'fd:'+f.id) setDropHint('fd:'+f.id) } }}
                        onDragLeave={() => setDropHint(h => (h === 'fd:'+f.id ? null : h))}
                        onDrop={e => { e.preventDefault(); onDropContainer(f.spaceId, f.id) }}
                        className={`flex items-center gap-0.5 group/folder rounded-lg ${activeView==='folder_detail' && activeFolderId===f.id ? 'bg-cu-active' : ''} ${dropHint==='fd:'+f.id ? 'ring-1 ring-brand-400 ring-inset' : ''}`}>
                        <button
                          onClick={() => updateFolder(f.id, {collapsed: !f.collapsed})}
                          title={f.collapsed ? 'Expandir' : 'Recolher'}
                          className="w-5 h-7 flex items-center justify-center flex-shrink-0 rounded text-cu-muted hover:text-white hover:bg-cu-hover transition-colors"
                        >
                          {f.collapsed ? <ChevronRight size={11}/> : <ChevronDown size={11}/>}
                        </button>
                        <button
                          onClick={() => openFolder(f.id)}
                          className={`flex items-center gap-1.5 flex-1 min-w-0 px-1 py-1.5 text-[13px] font-medium transition-colors rounded-lg hover:bg-cu-hover
                            ${activeView==='folder_detail' && activeFolderId===f.id ? 'text-white' : 'text-cu-text hover:text-white'}`}
                        >
                          {folderBadge(f, !f.collapsed)}
                          {editingFolder === f.id ? (
                            <input
                              autoFocus
                              defaultValue={f.name}
                              onBlur={e => { updateFolder(f.id, {name: e.target.value}); setEditingFolder(null) }}
                              onKeyDown={e => { if(e.key==='Enter') (e.target as HTMLInputElement).blur(); if(e.key==='Escape') setEditingFolder(null) }}
                              onClick={e => e.stopPropagation()}
                              className="flex-1 bg-transparent outline-none text-[13px] border-b border-brand-400 text-white"
                            />
                          ) : (
                            <span className="flex-1 truncate text-left">{f.name}</span>
                          )}
                          <span className="text-[10px] text-cu-muted ml-auto flex-shrink-0">{fp.length}</span>
                        </button>

                        {/* Folder actions */}
                        <div className="relative flex-shrink-0 flex items-center">
                          <button
                            onClick={e => { e.stopPropagation(); setFolderMenu(folderMenu===f.id ? null : f.id); setIconPicker(null) }}
                            className="w-5 h-5 opacity-0 group-hover/folder:opacity-100 flex items-center justify-center rounded text-cu-muted hover:bg-cu-hover hover:text-white transition-all"
                          ><MoreHorizontal size={12}/></button>
                          <button
                            onClick={e => { e.stopPropagation(); openNewProject(f.spaceId, f.id) }}
                            className="w-5 h-5 opacity-0 group-hover/folder:opacity-100 flex items-center justify-center rounded text-cu-muted hover:bg-cu-hover hover:text-white transition-all"
                            title="Novo projeto"
                          ><Plus size={12}/></button>

                          {iconPicker?.kind==='folder' && iconPicker.id===f.id && (
                            <EmojiPicker
                              className="absolute right-0 top-6"
                              onPick={emoji => updateFolder(f.id, { icon: emoji })}
                              onClose={() => setIconPicker(null)}
                            />
                          )}

                          {folderMenu === f.id && (
                            <div
                              className="absolute right-0 top-6 z-50 bg-cu-active border border-cu-border rounded-xl shadow-2xl py-1 min-w-[150px]"
                              onMouseDown={e => e.stopPropagation()}
                            >
                              <button onClick={() => { openNewProject(f.spaceId, f.id); closeAllMenus() }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                                <Plus size={12}/> Novo projeto
                              </button>
                              <button onClick={() => { setIconPicker({kind:'folder',id:f.id}); setFolderMenu(null) }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                                <Smile size={12}/> Alterar ícone
                              </button>
                              <button onClick={() => { setEditingFolder(f.id); closeAllMenus() }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cu-text hover:bg-cu-hover hover:text-white transition-colors">
                                <Pencil size={12}/> Renomear
                              </button>
                              <button onClick={() => { deleteFolder(f.id); closeAllMenus() }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                                <Trash2 size={12}/> Excluir pasta
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {!f.collapsed && (
                        <div className="ml-3 pl-1 space-y-0.5">
                          {fp.length === 0
                            ? <div className="pl-3 py-1 text-[11px] text-cu-muted/70 italic">Vazia</div>
                            : fp.map(p => renderProject(p, 0))}
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

                  {/* Projects directly in space */}
                  <div className="space-y-0.5 mt-0.5">
                    {sup.map(p => renderProject(p, 0))}
                  </div>

                  {/* Quick-add row */}
                  <div className="flex gap-1 px-1 mt-0.5">
                    <button onClick={() => { setAddingFolder(s.id); closeAllMenus() }}
                      className="flex items-center gap-1 text-[11px] text-cu-muted hover:text-white px-2 py-1 rounded hover:bg-cu-hover transition-colors">
                      <FolderOpen size={11}/> Pasta
                    </button>
                    <button onClick={() => openNewProject(s.id)}
                      className="flex items-center gap-1 text-[11px] text-cu-muted hover:text-white px-2 py-1 rounded hover:bg-cu-hover transition-colors">
                      <Plus size={11}/> Projeto
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Projetos sem espaço (legado) */}
          {ungrouped.length > 0 && (
            <div className="mt-3"
              onDragOver={e => { if (dragProjId) { e.preventDefault(); if (dropHint !== 'none') setDropHint('none') } }}
              onDragLeave={() => setDropHint(h => (h === 'none' ? null : h))}
              onDrop={e => { e.preventDefault(); onDropContainer(null, null) }}>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-cu-muted uppercase tracking-wider rounded ${dropHint==='none' ? 'ring-1 ring-brand-400 ring-inset' : ''}`}>
                <List size={11}/> Sem espaço
              </div>
              <div className="space-y-0.5">
                {ungrouped.map(p => renderProject(p))}
              </div>
            </div>
          )}
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
