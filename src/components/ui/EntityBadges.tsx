import React from 'react'
import { FolderOpen, Folder as FolderIcon } from 'lucide-react'
import type { Space, Folder, Project } from '../../types'
import { DEFAULT_FOLDER_COLOR } from '../../types'
import { getIconComponent, lightenColor } from '../../lib/sidebarIcons'

/** Quadrado em degradê com a inicial do espaço (ou o ícone escolhido) — fonte única de verdade do "avatar" de espaço. */
export function SpaceBadge({ space, size = 20 }: { space: Space; size?: number }) {
  const Icon = getIconComponent(space.icon)
  return (
    <span
      className="rounded-md flex items-center justify-center font-bold text-white leading-none flex-shrink-0"
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.5),
        background: `linear-gradient(135deg, ${lightenColor(space.color, .35)}, ${space.color})`,
        boxShadow: `0 3px 8px -2px ${space.color}8C, 0 0 0 1px rgba(255,255,255,.08) inset`,
      }}
    >{Icon ? <Icon size={Math.round(size * 0.6)}/> : (space.name.charAt(0).toUpperCase() || '#')}</span>
  )
}

/** Ícone de pasta, colorido pela cor escolhida (padrão âmbar). */
export function FolderBadgeIcon({ folder, open = false, size = 15 }: { folder: Folder; open?: boolean; size?: number }) {
  const Icon = open ? FolderOpen : FolderIcon
  return <Icon size={size} className="flex-shrink-0" style={{ color: folder.color ?? DEFAULT_FOLDER_COLOR }} />
}

/** Ícone lucide do projeto (se definido) ou quadradinho na cor do projeto. */
export function ProjectIcon({ project, size = 15 }: { project: Project; size?: number }) {
  const Icon = getIconComponent(project.icon)
  if (Icon) return <Icon size={size} className="flex-shrink-0" style={{ color: project.color }} />
  return (
    <span className="flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <span className="rounded-[4px]" style={{ width: size * 0.65, height: size * 0.65, background: project.color }} />
    </span>
  )
}
