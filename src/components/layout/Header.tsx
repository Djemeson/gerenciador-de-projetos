import React, { useState, useEffect, useRef } from 'react'
import {
  CheckSquare, Layers, Folder, Command, Sparkles, Undo2, Crown, X,
  ChevronRight, ArrowRight, CornerDownLeft, Inbox, Plus, Settings
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { INBOX_PROJECT_ID } from '../../types'

export function Header() {
  const {
    activeWorkspaceId,
    tasks,
    projects,
    spaces,
    workspaces,
    setView,
    openSpace,
    setSelectedTask,
    undo,
    undoStack,
    openNewProject
  } = useAppStore()

  const { openSettings } = useSettingsStore()

  // Current active workspace details
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) ?? workspaces[0]

  return (
    <div className="flex items-center justify-between px-6 py-3.5 bg-gray-50/50 backdrop-blur-md border-b border-gray-200/60 flex-shrink-0 z-40 relative">
      <div className="flex-1" />

      {/* Right Controls: Workspace Details & Premium User indicator */}
      <div className="flex items-center gap-3">
        {/* Pro Workspace Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-indigo-50 to-brand-50/50 border border-brand-100/60 px-3 py-1 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
          <Crown size={12} className="text-brand-500 fill-brand-400" />
          <span className="text-[11px] font-bold text-brand-700 uppercase tracking-wider">Premium Workspace</span>
        </div>

        {/* User Email Avatar Widget */}
        <div className="flex items-center gap-2 pl-1 border-l border-gray-200/80">
          <div className="flex flex-col text-right justify-center">
            <span className="text-[11px] font-bold text-gray-800 leading-3">djemeson16</span>
            <span className="text-[9.5px] font-medium text-gray-400">Owner</span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm select-none hover:shadow-md transition-all duration-200">
            DJ
          </div>
        </div>
      </div>
    </div>
  )
}

