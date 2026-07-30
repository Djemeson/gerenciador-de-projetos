import React from 'react'
import { CheckSquare } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskPanel } from '../components/tasks/TaskPanel'
import { DailyBriefingCard } from '../components/DailyBriefingCard'
import { INBOX_PROJECT_ID } from '../types'

export function MyTasksView() {
  const { tasks, projects, activeWorkspaceId } = useAppStore()

  const filtered = tasks.filter(t =>
    t.assignee === 'DJ' &&
    t.workspaceId === activeWorkspaceId &&
    t.projectId !== INBOX_PROJECT_ID
  )

  const headerRight = null

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Briefing "Começar o dia" — dispensável, volta no dia seguinte */}
      <DailyBriefingCard tasks={filtered}/>
      <TaskPanel
        scopeKey="mytasks"
        tasks={filtered}
        title="Minhas tarefas"
        icon={<CheckSquare size={16} className="text-brand-500 flex-shrink-0" />}
        headerRight={headerRight}
        showProject
        defaultProjectId={projects.find(p => p.workspaceId === activeWorkspaceId)?.id}
        groupOptions={['status','priority','dueDate','project']}
        views={['overview','list','board','table','calendar','dashboard']}
        defaultView="list"
      />
    </div>
  )
}
