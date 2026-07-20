import React, { useState, useEffect } from 'react'
import {
  Zap, CheckSquare, Layers, Calendar, Plus, Settings,
  BarChart2, FileText, Inbox, ChevronRight, ChevronDown, ChevronLeft,
  MoreHorizontal, Trash2, Copy, CornerUpRight, Archive, Check, List,
  PanelLeftClose, PanelLeftOpen, ChevronsUpDown, Sun, Moon, Ban, Square, Folder as FolderIcon,
  LayoutGrid, GitFork,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useNotificationStore } from '../../stores/useNotificationStore'
import { INBOX_PROJECT_ID, DEFAULT_WORKSPACE_ID, DEFAULT_FOLDER_COLOR } from '../../types'
import type { View, Project } from '../../types'
import { SpaceBadge, FolderBadgeIcon, ProjectIcon } from '../ui/EntityBadges'
import { IconColorPicker } from '../ui/IconColorPicker'
import { FloatingPanel } from '../ui/FloatingPanel'
import { getIconComponent } from '../../lib/sidebarIcons'

type ItemKind = 'space' | 'folder' | 'project' | 'workspace'
type IconTarget = { kind: ItemKind; id: string; anchor: HTMLElement }
type RenameTarget = { kind: ItemKind; id: string }
type ItemMenuState = { kind: ItemKind; id: string; view: 'root' | 'move'; anchor: HTMLElement }

export function Sidebar() {
  const {
    activeView, activeProjectId, activeSpaceId, activeFolderId,
    projects, tasks, spaces, folders, workspaces, activeWorkspaceId,
    setView, openSpace, openFolder,
    addSpace, updateSpace, deleteSpace, reorderSpace, duplicateSpace,
    addFolder, updateFolder, deleteFolder, reorderFolder, duplicateFolder,
    addProject, updateProject, moveProject, reorderProject, archiveProject, deleteProject, duplicateProject,
    addWorkspace, updateWorkspace, switchWorkspace,
  } = useAppStore()
  const { openSettings } = useSettingsStore()
  const notifCount = useNotificationStore(s => s.notifications.length)

  const [addingSpace,   setAddingSpace]   = useState<'top'|'bottom'|null>(null)
  const [spaceName,     setSpaceName]     = useState('')
  const [addingWs,      setAddingWs]      = useState(false)
  const [wsName,        setWsName]        = useState('')
  const [renaming,      setRenaming]      = useState<RenameTarget|null>(null)
  const [renameValue,   setRenameValue]   = useState('')
  const [dragProjId,    setDragProjId]    = useState<string|null>(null)
  const [dragFolderId,  setDragFolderId]  = useState<string|null>(null)
  const [dragSpaceId,   setDragSpaceId]   = useState<string|null>(null)
  const [dropHint,      setDropHint]      = useState<string|null>(null)  // id do alvo destacado
  const [wsMenuOpen,    setWsMenuOpen]    = useState(false)
  const [itemMenu,      setItemMenu]      = useState<ItemMenuState|null>(null)
  const [iconPicker,    setIconPicker]    = useState<IconTarget|null>(null)
  const [createMenu,    setCreateMenu]    = useState<{spaceId: string; anchor: HTMLElement}|null>(null)

  // Largura, recolhimento e tema da sidebar (persistidos por usuário)
  const [width,     setWidth]     = useState<number>(() => { try { return Number(localStorage.getItem('tf_sidebar_width')) || 240 } catch { return 240 } })
  const [collapsed, setCollapsed] = useState<boolean>(() => { try { return localStorage.getItem('tf_sidebar_collapsed') === '1' } catch { return false } })
  const [theme,     setTheme]     = useState<'dark'|'light'>(() => { try { return localStorage.getItem('tf_sidebar_theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' } })
  // Modo da navegação: 'nav' (Caixa de entrada...Automações) ou 'spaces' (Espaços/projetos)
  // — mutuamente exclusivos, nunca os dois ao mesmo tempo (padrão do protótipo).
  const [navMode,   setNavMode]   = useState<'nav'|'spaces'>(() => { try { return localStorage.getItem('tf_sidebar_navmode') === 'nav' ? 'nav' : 'spaces' } catch { return 'spaces' } })
  useEffect(() => { try { localStorage.setItem('tf_sidebar_width', String(width)) } catch {} }, [width])
  useEffect(() => { try { localStorage.setItem('tf_sidebar_collapsed', collapsed ? '1' : '0') } catch {} }, [collapsed])
  useEffect(() => {
    try {
      localStorage.setItem('tf_sidebar_theme', theme)
      if (theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    } catch {}
  }, [theme])
  useEffect(() => { try { localStorage.setItem('tf_sidebar_navmode', navMode) } catch {} }, [navMode])
  const dark = theme === 'dark'

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX, startW = width
    const onMove = (ev: MouseEvent) => setWidth(Math.min(420, Math.max(184, startW + ev.clientX - startX)))
    const onUp = () => {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
  }

  const wsSpaces      = spaces.filter(s => s.workspaceId === activeWorkspaceId)
  const activeProjects = projects.filter(p => !p.archived && p.workspaceId === activeWorkspaceId)
  const inboxCount     = tasks.filter(t => t.projectId===INBOX_PROJECT_ID && t.status!=='done').length
  const taskCount      = (pid: string) => tasks.filter(t => t.projectId===pid && t.status!=='done').length
  const spaceTaskCount = (spaceId: string) => activeProjects.filter(p => p.spaceId === spaceId).reduce((sum, p) => sum + taskCount(p.id), 0)
  const folderTaskCount = (fp: Project[]) => fp.reduce((sum, p) => sum + taskCount(p.id), 0)
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) ?? workspaces[0]

  const closeAllMenus = () => { setWsMenuOpen(false); setItemMenu(null); setIconPicker(null); setCreateMenu(null) }
  useEffect(() => {
    const handler = () => closeAllMenus()
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ─── Renomear inline (duplo-clique) ─────────────────────────────────────────
  const startRename = (target: RenameTarget, current: string) => { setRenaming(target); setRenameValue(current) }
  const commitRename = () => {
    if (!renaming) return
    const val = renameValue.trim()
    if (val) {
      if (renaming.kind === 'space')     updateSpace(renaming.id, { name: val })
      if (renaming.kind === 'folder')    updateFolder(renaming.id, { name: val })
      if (renaming.kind === 'project')   updateProject(renaming.id, { name: val })
      if (renaming.kind === 'workspace') updateWorkspace(renaming.id, { name: val })
    }
    setRenaming(null)
  }

  const handlePickIcon = (kind: ItemKind, id: string, icon: string) => {
    if (kind === 'space')     updateSpace(id, { icon: icon || undefined })
    if (kind === 'folder')    {/* folders use color picker, not icon */}
    if (kind === 'project')   updateProject(id, { icon: icon || undefined })
    if (kind === 'workspace') updateWorkspace(id, { icon: icon || undefined })
  }

  const handlePickColor = (kind: ItemKind, id: string, color: string | undefined) => {
    if (kind === 'space')     updateSpace(id, { color: color ?? '#6366F1' })
    if (kind === 'folder')    updateFolder(id, { color })
    if (kind === 'project')   updateProject(id, { color: color ?? '#6366F1' })
    if (kind === 'workspace') updateWorkspace(id, { color: color ?? '#6366F1' })
  }
  const renameInput = (
    <input
      autoFocus
      value={renameValue}
      onFocus={e => e.target.select()}
      onChange={e => setRenameValue(e.target.value)}
      onBlur={commitRename}
      onKeyDown={e => { if(e.key==='Enter') (e.target as HTMLInputElement).blur(); if(e.key==='Escape') { setRenaming(null) } }}
      onClick={e => e.stopPropagation()}
      className="flex-1 bg-transparent outline-none text-inherit border-b border-brand-400 min-w-0"
    />
  )

  // ─── Nav item (pílula) ───────────────────────────────────────────────────────
  const navItem = (view: View, label: string, Icon: React.ElementType, bg: string, iconColor: string, badge?: number, projectId?: string) => {
    const isActive = activeView===view && (projectId ? activeProjectId===projectId : !activeProjectId || view!=='project_detail')
    return (
      <button
        onClick={() => setView(view, projectId)}
        className={`w-full flex items-center gap-2 px-2.5 py-[5px] rounded-full text-[13px] transition-colors text-left
          ${isActive
            ? `bg-[#EEF0FF] font-bold ${dark ? 'text-[#3730A3]' : 'text-[#4338CA]'}`
            : `font-medium ${dark ? 'text-[#9195A0] hover:text-white hover:bg-white/5' : 'text-[#52555D] hover:text-[#17181C] hover:bg-black/[.04]'}`}`}
      >
        <span className="w-[22px] h-[22px] rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg, color: iconColor }}>
          <Icon size={12.5}/>
        </span>
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-brand-600 text-white rounded-full">
            {badge}
          </span>
        )}
      </button>
    )
  }

  const saveSpace = () => {
    if (spaceName.trim()) { addSpace(spaceName.trim(), '#6366F1'); setSpaceName(''); setAddingSpace(null) }
  }
  const createFolder = (spaceId: string) => {
    const f = addFolder('Nova Pasta', spaceId)
    startRename({ kind:'folder', id: f.id }, f.name)
    setCreateMenu(null)
  }
  const createProject = (spaceId?: string, folderId?: string, color?: string) => {
    const p = addProject('Novo Projeto', color ?? '#6366F1', '', spaceId, folderId, 'list')
    startRename({ kind:'project', id: p.id }, p.name)
  }
  const WS_COLORS = ['#EF4444','#F59E0B','#10B981','#378ADD','#8B5CF6','#EC4899']
  const saveWorkspace = () => {
    if (wsName.trim()) { addWorkspace(wsName.trim(), WS_COLORS[Math.floor(Math.random()*WS_COLORS.length)]); setWsName(''); setAddingWs(false) }
  }

  // ─── Menu de item (⋯): Mover / Duplicar / Arquivar / Excluir ───────────────
  const openItemMenu = (kind: ItemKind, id: string, anchor: HTMLElement) => setItemMenu(m => (m?.kind===kind && m.id===id) ? null : { kind, id, view: 'root', anchor })

  const doMove = (id: string, spaceId: string | null, folderId: string | null) => { moveProject(id, spaceId, folderId); setItemMenu(null) }
  const doDuplicate = () => {
    if (!itemMenu) return
    if (itemMenu.kind === 'space')   duplicateSpace(itemMenu.id)
    if (itemMenu.kind === 'folder')  duplicateFolder(itemMenu.id)
    if (itemMenu.kind === 'project') duplicateProject(itemMenu.id)
    setItemMenu(null)
  }
  const doDelete = () => {
    if (!itemMenu) return
    if (itemMenu.kind === 'space')   deleteSpace(itemMenu.id)
    if (itemMenu.kind === 'folder')  deleteFolder(itemMenu.id)
    if (itemMenu.kind === 'project') deleteProject(itemMenu.id)
    setItemMenu(null)
  }
  const doArchive = () => {
    if (itemMenu?.kind === 'project') archiveProject(itemMenu.id)
    setItemMenu(null)
  }

  const menuCls = dark ? 'bg-[#1B1C21] border-[#2E2F36] text-[#DADBE0]' : 'bg-white border-gray-200 text-[#3B3E45]'
  const menuItemCls = dark ? 'hover:bg-white/6' : 'hover:bg-black/5'
  const menuSepCls = dark ? 'bg-[#2E2F36]' : 'bg-gray-100'

  const itemMenuPopover = () => {
    if (!itemMenu) return null
    if (itemMenu.view === 'move') {
      const project = itemMenu.kind === 'project' ? projects.find(p => p.id===itemMenu.id) : null
      return (
        <FloatingPanel anchor={itemMenu.anchor} onClose={() => setItemMenu(null)} align="right">
        <div className={`border rounded-xl shadow-2xl py-1 min-w-[190px] max-h-[280px] overflow-y-auto sidebar-scroll ${menuCls}`}>
          <button onClick={() => setItemMenu({...itemMenu, view:'root'})}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-bold ${dark ? 'text-white' : 'text-[#17181C]'} ${menuItemCls}`}>
            <ChevronLeft size={12}/> Mover para
          </button>
          <div className={`h-px my-1 ${menuSepCls}`}/>
          {itemMenu.kind === 'project' && (
            <button onClick={() => doMove(itemMenu.id, null, null)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs ${menuItemCls}`}>
              <Ban size={12}/> Sem espaço {project && !project.spaceId && <Check size={12} className="ml-auto text-brand-400"/>}
            </button>
          )}
          {wsSpaces.map(s => (
            <div key={s.id}>
              <button
                onClick={() => itemMenu.kind==='folder' ? (updateFolder(itemMenu.id,{spaceId:s.id}), setItemMenu(null)) : doMove(itemMenu.id, s.id, null)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs ${menuItemCls}`}
              >
                <Square size={12}/> <span className="flex-1 text-left truncate">{s.name}</span>
                {itemMenu.kind==='project' && project?.spaceId===s.id && !project.folderId && <Check size={12} className="text-brand-400"/>}
              </button>
              {itemMenu.kind === 'project' && folders.filter(f => f.spaceId===s.id).map(f => (
                <button key={f.id} onClick={() => doMove(itemMenu.id, s.id, f.id)}
                  className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-xs ${menuItemCls}`}>
                  <FolderIcon size={12}/> <span className="flex-1 text-left truncate">{f.name}</span>
                  {project?.spaceId===s.id && project.folderId===f.id && <Check size={12} className="text-brand-400"/>}
                </button>
              ))}
            </div>
          ))}
        </div>
        </FloatingPanel>
      )
    }
    return (
      <FloatingPanel anchor={itemMenu.anchor} onClose={() => setItemMenu(null)} align="right">
      <div className={`border rounded-xl shadow-2xl py-1 min-w-[170px] ${menuCls}`}>
        {itemMenu.kind !== 'space' && (
          <button onClick={() => setItemMenu({...itemMenu, view:'move'})}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs ${menuItemCls}`}>
            <CornerUpRight size={12}/> <span className="flex-1 text-left">Mover</span> <ChevronRight size={12}/>
          </button>
        )}
        <button onClick={doDuplicate} className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs ${menuItemCls}`}>
          <Copy size={12}/> Duplicar
        </button>
        {itemMenu.kind === 'project' && (
          <button onClick={doArchive} className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs ${menuItemCls}`}>
            <Archive size={12}/> Arquivar
          </button>
        )}
        <div className={`h-px my-1 ${menuSepCls}`}/>
        <button onClick={doDelete} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors">
          <Trash2 size={12}/> Excluir
        </button>
      </div>
      </FloatingPanel>
    )
  }

  // ─── Menu de criação (+): Pasta / Projeto ───────────────────────────────────
  const createMenuPopover = () => {
    if (!createMenu) return null
    return (
      <FloatingPanel anchor={createMenu.anchor} onClose={() => setCreateMenu(null)} align="right">
        <div className={`border rounded-xl shadow-2xl py-1.5 px-1.5 w-[240px] ${menuCls}`}>
          <button onClick={() => createFolder(createMenu.spaceId)}
            className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${menuItemCls}`}>
            <FolderIcon size={16} className="text-brand-400 flex-shrink-0"/>
            <span>
              <div className={`text-[12.5px] font-semibold ${nameCls}`}>Pasta</div>
              <div className={`text-[10.5px] ${mutedCls}`}>Agrupe projetos relacionados</div>
            </span>
          </button>
          <button onClick={() => { createProject(createMenu.spaceId); setCreateMenu(null) }}
            className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${menuItemCls}`}>
            <List size={16} className="text-brand-400 flex-shrink-0"/>
            <span>
              <div className={`text-[12.5px] font-semibold ${nameCls}`}>Projeto</div>
              <div className={`text-[10.5px] ${mutedCls}`}>Lista de tarefas</div>
            </span>
          </button>
        </div>
      </FloatingPanel>
    )
  }

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

  const nameCls = dark ? 'text-white' : 'text-[#17181C]'
  const mutedCls = dark ? 'text-[#54565f]' : 'text-[#9B9EA8]'
  const rowTextCls = dark ? 'text-[#9195A0]' : 'text-[#52555D]'
  const rowHoverCls = dark ? 'hover:bg-white/[.04] hover:text-white' : 'hover:bg-black/[.045] hover:text-[#17181C]'
  const actionBtnCls = dark ? 'text-[#9195A0] hover:bg-white/10 hover:text-white' : 'text-[#6B6D75] hover:bg-black/10 hover:text-[#17181C]'

  // ─── Project item ─────────────────────────────────────────────────────────────
  const renderProject = (p: Project, inFolder: boolean, isLastInFolder = false) => {
    const isActive = activeView==='project_detail' && activeProjectId===p.id
    const count    = taskCount(p.id)
    const isRenaming = renaming?.kind==='project' && renaming.id===p.id
    const isLastCls = isLastInFolder ? (dark ? 'folder-line-item-last-dark' : 'folder-line-item-last-light') : ''
    return (
      <div key={p.id}
        draggable
        onDragStart={e => { setDragProjId(p.id); e.dataTransfer.effectAllowed = 'move' }}
        onDragOver={e => { e.preventDefault(); if (dragProjId && dropHint !== p.id) setDropHint(p.id) }}
        onDragLeave={() => setDropHint(h => (h === p.id ? null : h))}
        onDrop={e => { e.preventDefault(); onDropProject(p) }}
        onDragEnd={() => { setDragProjId(null); setDropHint(null) }}
        className={`relative flex items-center group/proj rounded-lg mx-2 ${inFolder ? (dark ? 'folder-line-item-dark' : 'folder-line-item-light') : ''} ${isLastCls} ${dragProjId===p.id ? 'opacity-40' : ''} ${dropHint===p.id && dragProjId!==p.id ? 'ring-1 ring-brand-400 ring-inset' : ''}`}>
        <button
          onClick={() => setView('project_detail', p.id)}
          className={`flex items-center gap-2.5 flex-1 min-w-0 py-[7px] pr-16 rounded-lg transition-colors text-left text-[13px] ${inFolder ? 'pl-[64px]' : 'pl-10'}
            ${isActive ? `bg-[#EEF0FF] font-semibold ${dark ? 'text-[#3730A3]' : 'text-[#4338CA]'}` : `${rowTextCls} ${rowHoverCls}`}`}
        >
          <span className="iconpick-trigger transition-[filter] hover:brightness-125" onClick={e => { e.stopPropagation(); const anchor=e.currentTarget; setIconPicker(t => (t?.kind==='project'&&t.id===p.id) ? null : {kind:'project',id:p.id,anchor}) }}>
            <ProjectIcon project={p}/>
          </span>
          {isRenaming ? renameInput : (
            <span className="flex-1 truncate cursor-text" onDoubleClick={e => { e.stopPropagation(); startRename({kind:'project',id:p.id}, p.name) }}>{p.name}</span>
          )}
        </button>

        {iconPicker?.kind==='project' && iconPicker.id===p.id && (
          <IconColorPicker
            mode="icon" theme={theme} anchor={iconPicker.anchor}
            icon={p.icon} color={p.color}
            onPickIcon={name => updateProject(p.id, { icon: name || undefined })}
            onPickColor={c => updateProject(p.id, { color: c ?? '#888780' })}
            onClose={() => setIconPicker(null)}
          />
        )}

        {/* Alinhamento uniforme das ações e contagem à direita */}
        <div className="absolute right-2 flex items-center gap-1">
          <div className="relative w-14 h-6 flex items-center justify-end">
            {count > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center transition-all duration-200 group-hover/proj:opacity-0 group-hover/proj:pointer-events-none"
                style={{ backgroundColor: `${p.color}15`, color: p.color }}
              >
                {count}
              </span>
            )}
            <div className="absolute inset-0 opacity-0 group-hover/proj:opacity-100 flex items-center justify-end gap-1 transition-all duration-200 pointer-events-none group-hover/proj:pointer-events-auto">
              <button
                onClick={e => {
                  e.stopPropagation()
                  const newProj = addProject('Novo Projeto', p.color, '', p.spaceId, p.folderId, 'list')
                  // Encontrar o próximo projeto na mesma pasta/espaço
                  const siblingProjects = activeProjects.filter(proj => proj.spaceId === p.spaceId && proj.folderId === p.folderId)
                  const currentIdx = siblingProjects.findIndex(proj => proj.id === p.id)
                  if (currentIdx >= 0 && currentIdx < siblingProjects.length - 1) {
                    // Se não é o último, reordenar para ficar antes do próximo
                    const nextProj = siblingProjects[currentIdx + 1]
                    reorderProject(newProj.id, nextProj.id)
                  }
                  startRename({kind:'project', id: newProj.id}, newProj.name)
                }}
                className={`w-6 h-6 flex items-center justify-center rounded transition-all ${actionBtnCls}`}
                title="Novo projeto"
              >
                <Plus size={12}/>
              </button>
              <button
                onClick={e => { e.stopPropagation(); openItemMenu('project', p.id, e.currentTarget); setIconPicker(null) }}
                className={`w-6 h-6 flex items-center justify-center rounded transition-all ${actionBtnCls}`}
              >
                <MoreHorizontal size={12}/>
              </button>
            </div>
          </div>
          {itemMenu?.kind==='project' && itemMenu.id===p.id && itemMenuPopover()}
        </div>
      </div>
    )
  }

  const ungrouped   = activeProjects.filter(p => !p.spaceId)
  const spaceGroups = wsSpaces.map(s => {
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

  const inputCls = `flex-1 text-xs px-2 py-1 border rounded-lg outline-none focus:ring-1 focus:ring-brand-500 ${dark ? 'bg-[#111114] border-[#2E2F36] text-white placeholder:text-[#5A5C66]' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'}`

  const mobileSidebarOpen = useAppStore(s => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore(s => s.setMobileSidebarOpen)

  // ── Estado recolhido: trilho fino com logo + botão de expandir ──────────────
  if (collapsed) {
    return (
      <div className={`hidden md:flex flex-col items-center gap-2 py-3 border-r h-full flex-shrink-0 w-12 select-none ${dark ? 'bg-[#0E0E11] border-white/5' : 'bg-[#FAFAFA] border-[#EAEAEC]'}`}>
        <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-white"/>
        </div>
        <button onClick={() => setCollapsed(false)} title="Expandir barra lateral"
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${actionBtnCls}`}>
          <PanelLeftOpen size={16}/>
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Drawer Overlay on Mobile */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity duration-300"
        />
      )}

      <aside 
        style={{ width }} 
        className={`fixed inset-y-0 left-0 z-50 md:relative flex flex-col h-full select-none flex-shrink-0 border-r transition-transform duration-300 md:translate-x-0
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${dark ? 'bg-[#0E0E11] border-white/5' : 'bg-[#FAFAFA] border-[#EAEAEC]'}`}
      >

      {/* ── Workspace header ── */}
      <div className="relative">
        <div
          onClick={() => setWsMenuOpen(v => !v)}
          className={`px-4 py-[18px] flex items-center gap-2.5 cursor-pointer transition-colors ${dark ? 'bg-[#151519] hover:bg-[#1A1B20]' : 'bg-[#F4F4F5] hover:bg-black/5'}`}
        >
          <div
            className="iconpick-trigger transition-[filter] hover:brightness-125 w-8 h-8 rounded-[10px] border border-transparent flex items-center justify-center flex-shrink-0"
            style={{ background: activeWorkspace?.color ?? '#4F46E5' }}
            onClick={e => { e.stopPropagation(); const anchor=e.currentTarget; setIconPicker(t => (t?.kind==='workspace'&&t.id===activeWorkspaceId) ? null : {kind:'workspace' as any,id:activeWorkspaceId,anchor}) }}
          >
            {activeWorkspace?.icon && getIconComponent(activeWorkspace.icon)
              ? (() => { const Icon = getIconComponent(activeWorkspace.icon)!; return <Icon size={14} className="text-white"/> })()
              : activeWorkspaceId===DEFAULT_WORKSPACE_ID
              ? <Zap size={14} className="text-white"/>
              : <span className="text-white text-[11px] font-bold">{(activeWorkspace?.name ?? '?').charAt(0).toUpperCase()}</span>}
          </div>
          <div className="flex-1 min-w-0">
            {renaming?.kind==='workspace' && renaming.id===activeWorkspaceId ? (
              <div className={`flex ${nameCls} text-[14px] font-bold`} onClick={e => e.stopPropagation()}>{renameInput}</div>
            ) : (
              <div className={`text-[14px] font-bold truncate cursor-text ${nameCls}`}
                onDoubleClick={e => { e.stopPropagation(); startRename({kind:'workspace', id:activeWorkspaceId}, activeWorkspace?.name ?? '') }}
              >{activeWorkspace?.name}</div>
            )}
            <div className={`text-[11px] ${mutedCls}`}>Workspace</div>
          </div>
          {notifCount > 0 && (
            <span className="text-[10px] w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
              {notifCount}
            </span>
          )}
          <ChevronsUpDown size={13} className={`flex-shrink-0 ${mutedCls}`}/>
          <button onClick={e => { e.stopPropagation(); setCollapsed(true) }} title="Recolher barra lateral"
            className={`hidden md:flex w-6 h-6 items-center justify-center rounded-md transition-colors flex-shrink-0 ${actionBtnCls}`}>
            <PanelLeftClose size={15}/>
          </button>
        </div>

        {/* Alternância Espaços/Navegação — mutuamente exclusivos (nunca os dois juntos) */}
        <div className={`px-4 pb-3 flex items-center gap-1.5 ${dark ? 'bg-[#151519]' : 'bg-[#F4F4F5]'}`}>
          <button onClick={() => setNavMode('spaces')} title="Mostrar espaços e projetos"
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${navMode==='spaces' ? (dark ? 'bg-[#3730A3]/30 text-[#A6ADFB]' : 'bg-[#EEF0FF] text-brand-600') : actionBtnCls}`}>
            <GitFork size={14}/>
          </button>
          <button onClick={() => setNavMode('nav')} title="Mostrar opções (Caixa de entrada...Automações)"
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${navMode==='nav' ? (dark ? 'bg-[#3730A3]/30 text-[#A6ADFB]' : 'bg-[#EEF0FF] text-brand-600') : actionBtnCls}`}>
            <List size={14}/>
          </button>
        </div>

        {wsMenuOpen && (
          <div className={`absolute left-2 top-[calc(100%-4px)] z-50 border rounded-xl shadow-2xl p-1.5 w-[230px] ${menuCls}`}
            onMouseDown={e => e.stopPropagation()}>
            <div className="flex flex-col gap-0.5">
              {workspaces.map(w => (
                <button key={w.id} onClick={() => { switchWorkspace(w.id); setWsMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors"
                  style={{ background: 'transparent' }}>
                  <span className="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                    style={{ background: w.color ?? '#4F46E5' }}>
                    {w.icon && getIconComponent(w.icon)
                      ? (() => { const Icon = getIconComponent(w.icon)!; return <Icon size={13}/> })()
                      : w.id===DEFAULT_WORKSPACE_ID
                      ? <Zap size={13}/>
                      : <span>{w.name.charAt(0).toUpperCase()}</span>}
                  </span>
                  <span className="flex-1 min-w-0">
                    <div className={`text-[12.5px] font-semibold truncate ${nameCls}`}>{w.name}</div>
                    <div className={`text-[10.5px] ${mutedCls}`}>Workspace</div>
                  </span>
                  {w.id===activeWorkspaceId && <Check size={13} className="text-brand-400 flex-shrink-0"/>}
                </button>
              ))}
            </div>
            <div className={`h-px my-1.5 mx-0.5 ${menuSepCls}`}/>
            {addingWs ? (
              <div className="flex gap-1 p-1">
                <input autoFocus value={wsName} onChange={e => setWsName(e.target.value)}
                  onKeyDown={e => { if(e.key==='Enter') saveWorkspace(); if(e.key==='Escape') setAddingWs(false) }}
                  placeholder="Novo workspace..." className={inputCls}/>
                <button onClick={saveWorkspace} className="text-xs px-1.5 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">OK</button>
              </div>
            ) : (
              <button onClick={() => setAddingWs(true)}
                className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${menuItemCls}`}>
                <Plus size={16} className="text-brand-400 flex-shrink-0"/>
                <span>
                  <div className={`text-[12.5px] font-semibold ${nameCls}`}>Criar workspace</div>
                  <div className={`text-[10.5px] ${mutedCls}`}>Novo espaço de trabalho separado</div>
                </span>
              </button>
            )}
          </div>
        )}

        {/* Workspace icon picker */}
        {iconPicker?.kind==='workspace' && iconPicker.id===activeWorkspaceId && (
          <IconColorPicker
            mode="icon" theme={theme} anchor={iconPicker.anchor}
            icon={activeWorkspace?.icon} color={activeWorkspace?.color}
            onPickIcon={name => handlePickIcon('workspace', activeWorkspaceId, name)}
            onPickColor={color => handlePickColor('workspace', activeWorkspaceId, color)}
            onClose={() => setIconPicker(null)}
          />
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-4 sidebar-scroll">

        {/* Sempre visíveis no topo, acima de Espaços */}
        {navMode==='spaces' && (
          <>
            <div className="space-y-px mt-2 mb-1.5">
              {navItem('inbox',       'Caixa de entrada', Inbox,      '#EAF1FF', '#2F6FE4', inboxCount)}
              {navItem('my_tasks',    'Minhas tarefas',   CheckSquare,'#E9FBF2', '#16A34A')}
              {navItem('all_tasks',   'Todas as tarefas', Layers,     '#EEF0FF', '#4F46E5')}
            </div>
            <div className={`h-px my-2 mx-1 ${dark ? 'bg-white/5' : 'bg-gray-100'}`} />
          </>
        )}

        {/* Primary nav (restantes) */}
        {navMode==='nav' && (
        <div className="space-y-0.5 mt-3 mb-3">
          {navItem('calendar',    'Calendário',       Calendar,   '#FFF1E6', '#EA7317')}
          {navItem('projects',    'Projetos',         BarChart2,  '#F5EEFF', '#8B5CF6')}
          {navItem('reports',     'Relatórios',       FileText,   '#E9FBFC', '#0E9AA6')}
          {navItem('automations', 'Automações',       Zap,        '#FFEAF3', '#DB2777')}
        </div>
        )}

        {/* Spaces */}
        {navMode==='spaces' && (
        <div>
          <div className="flex items-center justify-between px-2 py-1 mb-0.5">
            <span className={`text-[10.5px] font-bold uppercase tracking-wider ${mutedCls}`}>Espaços</span>
            <button
              onClick={() => setAddingSpace(v => v==='top' ? null : 'top')}
              className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${actionBtnCls}`}
              title="Novo espaço"
            ><Plus size={12}/></button>
          </div>

          {addingSpace === 'top' && (
            <div className="px-1 pb-2 flex gap-1">
              <input
                autoFocus
                value={spaceName}
                onChange={e => setSpaceName(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter') saveSpace(); if(e.key==='Escape') setAddingSpace(null) }}
                placeholder="Nome do espaço..."
                className={inputCls}
              />
              <button onClick={saveSpace} className="text-xs px-1.5 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">OK</button>
            </div>
          )}

          {/* Empty state: no spaces yet */}
          {wsSpaces.length === 0 && !addingSpace && (
            <div className="flex flex-col items-center text-center px-6 py-7 gap-2.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-white/5 text-[#54565f]' : 'bg-black/[.04] text-[#9B9EA8]'}`}>
                <LayoutGrid size={18}/>
              </div>
              <div className={`text-[12.5px] font-semibold ${dark ? 'text-[#9195A0]' : 'text-[#3B3E45]'}`}>Nenhum espaço ainda</div>
              <div className={`text-[11.5px] leading-relaxed ${mutedCls}`}>Crie o primeiro espaço para começar<br/>a organizar este workspace</div>
            </div>
          )}

          {/* Space groups */}
          {spaceGroups.map(({ space: s, folders: sfolders, ungrouped: sup }) => {
            const isRenamingSpace = renaming?.kind==='space' && renaming.id===s.id
            const isActiveSpace = s.id === activeSpaceId
            const spaceBg = isActiveSpace
              ? (dark ? `${s.color}24` : `${s.color}14`)
              : 'transparent'
            const spaceBorderColor = isActiveSpace
              ? (dark ? `${s.color}3e` : `${s.color}2c`)
              : 'transparent'
            return (
            <div key={s.id} className="mt-1">

              {/* Space header */}
              <div
                draggable={!isRenamingSpace}
                onDragStart={e => { setDragSpaceId(s.id); e.dataTransfer.effectAllowed = 'move' }}
                onDragEnd={() => { setDragSpaceId(null); setDropHint(null) }}
                onDragOver={e => { if (dragProjId || dragSpaceId) { e.preventDefault(); if (dropHint !== 'sp:'+s.id) setDropHint('sp:'+s.id) } }}
                onDragLeave={() => setDropHint(h => (h === 'sp:'+s.id ? null : h))}
                onDrop={e => {
                  e.preventDefault()
                  if (dragProjId) onDropContainer(s.id, null)
                  else if (dragSpaceId && dragSpaceId !== s.id) reorderSpace(dragSpaceId, s.id)
                  setDragSpaceId(null); setDropHint(null)
                }}
                style={{ background: spaceBg, borderColor: spaceBorderColor }}
                className={`relative flex items-center group/space rounded-xl mx-2 border transition-colors ${dropHint==='sp:'+s.id ? 'ring-1 ring-brand-400 ring-inset' : ''} ${dragSpaceId===s.id ? 'opacity-40' : ''} ${isActiveSpace ? 'shadow-sm' : ''}`}>
                <button
                  onClick={() => openSpace(s.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 py-2 pl-2 pr-24 text-[14px] font-bold transition-colors text-left"
                >
                  <span className="iconpick-trigger transition-transform group-hover/space:scale-105" onClick={e => { e.stopPropagation(); const anchor=e.currentTarget; setIconPicker(t => (t?.kind==='space'&&t.id===s.id) ? null : {kind:'space',id:s.id,anchor}) }}>
                    <SpaceBadge space={s} size={24}/>
                  </span>
                  {isRenamingSpace ? renameInput : (
                    <span className={`flex-1 truncate cursor-text ${isActiveSpace ? (dark ? 'text-white font-extrabold' : 'text-slate-900 font-extrabold') : nameCls}`} onDoubleClick={e => { e.stopPropagation(); startRename({kind:'space',id:s.id}, s.name) }}>{s.name}</span>
                  )}
                </button>

                {/* Alinhamento uniforme: collapse icon | tarefas | ações */}
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); updateSpace(s.id, {collapsed: !s.collapsed}) }}
                    title={s.collapsed ? 'Expandir' : 'Recolher'}
                    className={`w-6 h-6 flex items-center justify-center flex-shrink-0 rounded transition-colors ${actionBtnCls}`}
                  >
                    {s.collapsed ? <ChevronRight size={13}/> : <ChevronDown size={13}/>}
                  </button>

                  <div className="relative w-14 h-6 flex items-center justify-end">
                    {spaceTaskCount(s.id) > 0 && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center transition-all duration-200 group-hover/space:opacity-0 group-hover/space:pointer-events-none"
                        style={{ backgroundColor: `${s.color}15`, color: s.color }}
                      >
                        {spaceTaskCount(s.id)}
                      </span>
                    )}
                    <div className="absolute inset-0 opacity-0 group-hover/space:opacity-100 flex items-center justify-end gap-1 transition-all duration-200 pointer-events-none group-hover/space:pointer-events-auto">
                      <button
                        onClick={e => { e.stopPropagation(); const anchor=e.currentTarget; setCreateMenu(m => m?.spaceId===s.id ? null : {spaceId:s.id,anchor}); setIconPicker(null) }}
                        className={`w-6 h-6 flex items-center justify-center rounded transition-all ${actionBtnCls}`}
                        title="Adicionar"
                      >
                        <Plus size={13}/>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openItemMenu('space', s.id, e.currentTarget); setIconPicker(null) }}
                        className={`w-6 h-6 flex items-center justify-center rounded transition-all ${actionBtnCls}`}
                      >
                        <MoreHorizontal size={13}/>
                      </button>
                    </div>
                  </div>

                  {createMenu?.spaceId===s.id && createMenuPopover()}
                  {itemMenu?.kind==='space' && itemMenu.id===s.id && itemMenuPopover()}
                </div>

                {iconPicker?.kind==='space' && iconPicker.id===s.id && (
                  <IconColorPicker
                    mode="icon" theme={theme} anchor={iconPicker.anchor}
                    icon={s.icon} color={s.color}
                    onPickIcon={name => updateSpace(s.id, { icon: name || undefined })}
                    onPickColor={c => updateSpace(s.id, { color: c ?? '#8A8D98' })}
                    onClose={() => setIconPicker(null)}
                  />
                )}
              </div>

              {!s.collapsed && (
                <div className="mt-0.5 space-y-0.5 animate-fade-in">

                  {/* Folders */}
                  {sfolders.map(({ folder: f, projects: fp }) => {
                    const isRenamingFolder = renaming?.kind==='folder' && renaming.id===f.id
                    const fCount = folderTaskCount(fp)
                    return (
                    <div key={f.id}>
                      <div
                        draggable={!isRenamingFolder}
                        onDragStart={e => { e.stopPropagation(); setDragFolderId(f.id); e.dataTransfer.effectAllowed = 'move' }}
                        onDragEnd={() => { setDragFolderId(null); setDropHint(null) }}
                        onDragOver={e => { if (dragProjId || dragFolderId) { e.preventDefault(); if (dropHint !== 'fd:'+f.id) setDropHint('fd:'+f.id) } }}
                        onDragLeave={() => setDropHint(h => (h === 'fd:'+f.id ? null : h))}
                        onDrop={e => {
                          e.preventDefault(); e.stopPropagation()
                          if (dragProjId) onDropContainer(f.spaceId, f.id)
                          else if (dragFolderId && dragFolderId !== f.id) reorderFolder(dragFolderId, f.id)
                          setDragFolderId(null); setDropHint(null)
                        }}
                        className={`relative flex items-center group/folder rounded-lg mx-2 ${!f.collapsed && fp.length>0 ? (dark ? 'folder-line-head-dark' : 'folder-line-head-light') : ''} ${dropHint==='fd:'+f.id ? 'ring-1 ring-brand-400 ring-inset' : ''} ${dragFolderId===f.id ? 'opacity-40' : ''}`}>
                        <button
                          onClick={() => {
                            const isActiveFolder = activeView==='folder_detail' && activeFolderId===f.id
                            if (isActiveFolder) updateFolder(f.id, { collapsed: !f.collapsed })
                            else openFolder(f.id)
                          }}
                          className="flex items-center gap-2.5 flex-1 min-w-0 py-[7px] pl-10 pr-16 text-[13.5px] font-semibold transition-colors text-left"
                        >
                          <span className="colorpick-trigger" onClick={e => { e.stopPropagation(); const anchor=e.currentTarget; setIconPicker(t => (t?.kind==='folder'&&t.id===f.id) ? null : {kind:'folder',id:f.id,anchor}) }}>
                            <FolderBadgeIcon folder={f} open={!f.collapsed} size={16}/>
                          </span>
                          {isRenamingFolder ? renameInput : (
                            <span
                              style={{ color: f.color ?? DEFAULT_FOLDER_COLOR }}
                              className="flex-1 truncate cursor-text"
                              onDoubleClick={e => { e.stopPropagation(); startRename({kind:'folder',id:f.id}, f.name) }}
                            >
                              {f.name}
                            </span>
                          )}
                        </button>

                        {/* Alinhamento uniforme das ações e contagem da Pasta à direita */}
                        <div className="absolute right-2 flex items-center gap-1">
                          <div className="relative w-14 h-6 flex items-center justify-end">
                            {fCount > 0 && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center transition-all duration-200 group-hover/folder:opacity-0 group-hover/folder:pointer-events-none"
                                style={{ backgroundColor: `${f.color ?? DEFAULT_FOLDER_COLOR}15`, color: f.color ?? DEFAULT_FOLDER_COLOR }}
                              >
                                {fCount}
                              </span>
                            )}
                            <div className="absolute inset-0 opacity-0 group-hover/folder:opacity-100 flex items-center justify-end gap-1 transition-all duration-200 pointer-events-none group-hover/folder:pointer-events-auto">
                              <button
                                onClick={e => { e.stopPropagation(); createProject(f.spaceId, f.id, f.color ?? DEFAULT_FOLDER_COLOR) }}
                                className={`w-6 h-6 flex items-center justify-center rounded transition-all ${actionBtnCls}`}
                                title="Novo projeto"
                              >
                                <Plus size={12}/>
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); openItemMenu('folder', f.id, e.currentTarget); setIconPicker(null) }}
                                className={`w-6 h-6 flex items-center justify-center rounded transition-all ${actionBtnCls}`}
                              >
                                <MoreHorizontal size={12}/>
                              </button>
                            </div>
                          </div>
                          {itemMenu?.kind==='folder' && itemMenu.id===f.id && itemMenuPopover()}
                        </div>

                        {iconPicker?.kind==='folder' && iconPicker.id===f.id && (
                          <IconColorPicker
                            mode="color" theme={theme} anchor={iconPicker.anchor}
                            color={f.color}
                            onPickColor={c => updateFolder(f.id, { color: c })}
                            onClose={() => setIconPicker(null)}
                          />
                        )}
                      </div>

                      {!f.collapsed && (
                        <div className="space-y-0.5 animate-fade-in">
                          {fp.length === 0
                            ? <div className={`pl-1 py-1 text-[11px] italic ${mutedCls}`}>Vazia</div>
                            : fp.map((p, idx) => renderProject(p, true, idx === fp.length - 1))}
                        </div>
                      )}
                    </div>
                  )})}

                  {/* Projects directly in space */}
                  {sup.map(p => renderProject(p, false))}
                </div>
              )}
            </div>
          )})}

          {/* Projetos sem espaço (legado) */}
          {ungrouped.length > 0 && (
            <div className="mt-3"
              onDragOver={e => { if (dragProjId) { e.preventDefault(); if (dropHint !== 'none') setDropHint('none') } }}
              onDragLeave={() => setDropHint(h => (h === 'none' ? null : h))}
              onDrop={e => { e.preventDefault(); onDropContainer(null, null) }}>
              <div className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${mutedCls} ${dropHint==='none' ? 'ring-1 ring-brand-400 ring-inset' : ''}`}>
                <List size={11}/> Sem espaço
              </div>
              <div className="space-y-0.5">
                {ungrouped.map(p => renderProject(p, false))}
              </div>
            </div>
          )}

          {/* Novo espaço */}
          {addingSpace === 'bottom' ? (
            <div className="px-1 pt-2 flex gap-1">
              <input
                autoFocus
                value={spaceName}
                onChange={e => setSpaceName(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter') saveSpace(); if(e.key==='Escape') setAddingSpace(null) }}
                placeholder="Nome do espaço..."
                className={inputCls}
              />
              <button onClick={saveSpace} className="text-xs px-1.5 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">OK</button>
            </div>
          ) : (
            <button onClick={() => setAddingSpace('bottom')}
              className={`flex items-center gap-2 w-[calc(100%-8px)] mx-1 mt-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${mutedCls} ${rowHoverCls}`}>
              <Plus size={13}/> Novo espaço
            </button>
          )}
        </div>
        )}
      </div>

      {/* ── Footer / User ── */}
      <div className={`border-t px-2.5 py-3 flex items-center gap-2.5 ${dark ? 'border-white/5 bg-[#151519]' : 'border-[#EAEAEC] bg-[#F4F4F5]'}`}>
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-[11px] text-white font-bold flex-shrink-0">
          DJ
        </div>
        <span className={`text-[13px] font-semibold flex-1 truncate min-w-0 ${dark ? 'text-[#DADBE0]' : 'text-[#3B3E45]'}`}>Djemeson</span>
        <button
          onClick={() => setTheme(t => t==='dark' ? 'light' : 'dark')}
          title={dark ? 'Tema claro' : 'Tema escuro'}
          className={`w-[26px] h-[26px] rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${dark ? 'bg-white/[.06] text-[#9195A0] hover:bg-white/10 hover:text-white' : 'bg-black/[.05] text-[#52555D] hover:bg-black/[.09] hover:text-[#17181C]'}`}
        >{dark ? <Sun size={13}/> : <Moon size={13}/>}</button>
        <button onClick={openSettings} title="Configurações"
          className={`w-[26px] h-[26px] flex items-center justify-center transition-colors flex-shrink-0 ${mutedCls} ${dark ? 'hover:text-white' : 'hover:text-[#17181C]'}`}>
          <Settings size={13}/>
        </button>
      </div>

      {/* ── Alça de redimensionar (borda direita) ── */}
      <div onMouseDown={startResize} title="Arraste para redimensionar"
        className="group/resize absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-20 -mr-0.5">
        <div className="w-px h-full ml-auto bg-transparent group-hover/resize:bg-brand-500 transition-colors"/>
      </div>
    </aside>
    </>
  )
}
