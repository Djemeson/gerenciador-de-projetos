import React, { useEffect, useState } from 'react'
import { useAppStore }              from './stores/useAppStore'
import { useSettingsStore, matchHotkey } from './stores/useSettingsStore'
import { useNotificationStore }     from './stores/useNotificationStore'
import { Sidebar }                  from './components/layout/Sidebar'
import { MyTasksView }              from './views/MyTasksView'
import { AllTasksView }             from './views/AllTasksView'
import { ProjectsListView }         from './views/ProjectsListView'
import { ProjectDetailView, NewViewModal } from './views/ProjectDetailView'
import { CalendarView }             from './views/CalendarView'
import { ReportsView }              from './views/ReportsView'
import { InboxView }                from './views/InboxView'
import { AutomationsView }          from './views/AutomationsView'
import { NewProjectModal }          from './components/projects/NewProjectModal'
import { GUTModal }                 from './components/projects/GUTModal'
import { QuickCapture }             from './components/QuickCapture'
import { Notifications }            from './components/Notifications'
import { SettingsModal }            from './components/SettingsModal'
import { ColumnsModal }             from './components/ColumnsModal'

export default function App() {
  const { activeView, tasks, projects, init } = useAppStore()
  const { quickCaptureHotkey }  = useSettingsStore()
  const { generate }            = useNotificationStore()
  const [captureOpen, setCaptureOpen] = useState(false)

  useEffect(() => { init() }, [])

  useEffect(() => {
    if (tasks.length === 0) return
    const enriched = tasks.map(t => ({
      id: t.id, title: t.title, dueDate: t.dueDate, status: t.status,
      projectName: projects.find(p => p.id===t.projectId)?.name ?? '',
    }))
    generate(enriched)
    const interval = setInterval(() => generate(enriched), 60_000)
    return () => clearInterval(interval)
  }, [tasks, projects])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchHotkey(quickCaptureHotkey, e)) { e.preventDefault(); setCaptureOpen(v=>!v) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [quickCaptureHotkey])

  const view = () => {
    switch (activeView) {
      case 'inbox':          return <InboxView/>
      case 'my_tasks':       return <MyTasksView/>
      case 'all_tasks':      return <AllTasksView/>
      case 'projects':       return <ProjectsListView/>
      case 'project_detail': return <ProjectDetailView/>
      case 'calendar':       return <CalendarView/>
      case 'reports':        return <ReportsView/>
      case 'automations':    return <AutomationsView/>
      default:               return <MyTasksView/>
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar/>
      <main className="flex flex-1 overflow-hidden min-w-0">{view()}</main>

      <NewProjectModal/>
      <GUTModal/>
      <SettingsModal/>
      <ColumnsModal/>
      <NewViewModal/>
      <QuickCapture open={captureOpen} onClose={()=>setCaptureOpen(false)}/>
      <Notifications/>
    </div>
  )
}
