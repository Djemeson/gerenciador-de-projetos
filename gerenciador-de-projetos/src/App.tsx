import React, { useEffect } from 'react'
import { useAppStore } from './stores/useAppStore'
import { Sidebar } from './components/layout/Sidebar'
import { MyTasksView }      from './views/MyTasksView'
import { AllTasksView }     from './views/AllTasksView'
import { ProjectsListView } from './views/ProjectsListView'
import { ProjectDetailView }from './views/ProjectDetailView'
import { CalendarView }     from './views/CalendarView'
import { NewTaskModal }     from './components/tasks/NewTaskModal'
import { NewProjectModal }  from './components/projects/NewProjectModal'
import { GUTModal }         from './components/projects/GUTModal'

export default function App() {
  const { activeView, init } = useAppStore()

  useEffect(() => { init() }, [])

  const view = () => {
    switch (activeView) {
      case 'my_tasks':       return <MyTasksView />
      case 'all_tasks':      return <AllTasksView />
      case 'projects':       return <ProjectsListView />
      case 'project_detail': return <ProjectDetailView />
      case 'calendar':       return <CalendarView />
      default:               return <MyTasksView />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <main className="flex flex-1 overflow-hidden">
        {view()}
      </main>

      {/* Global modals */}
      <NewTaskModal />
      <NewProjectModal />
      <GUTModal />
    </div>
  )
}
