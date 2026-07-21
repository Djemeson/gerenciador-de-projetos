import React, { useEffect, useMemo } from 'react'
import { Menu }                     from 'lucide-react'
import { useAppStore }              from './stores/useAppStore'
import { useAuthStore }             from './stores/useAuthStore'
import { useSettingsStore, matchHotkey } from './stores/useSettingsStore'
import { useNotificationStore }     from './stores/useNotificationStore'
import { Sidebar }                  from './components/layout/Sidebar'
import { MyTasksView }              from './views/MyTasksView'
import { AllTasksView }             from './views/AllTasksView'
import { ProjectsListView }         from './views/ProjectsListView'
import { ProjectDetailView }         from './views/ProjectDetailView'
import { SpaceDetailView, FolderDetailView } from './views/SpaceFolderView'
import { CalendarView }             from './views/CalendarView'
import { ReportsView }              from './views/ReportsView'
import { InboxView }                from './views/InboxView'
import { AutomationsView }          from './views/AutomationsView'
import { GoalsView }                from './views/GoalsView'
import { NewProjectModal }          from './components/projects/NewProjectModal'
import { AIProjectModal }           from './components/projects/AIProjectModal'
import { EnrichProjectModal }       from './components/projects/EnrichProjectModal'
import { GUTModal }                 from './components/projects/GUTModal'
import { QuickCapture }             from './components/QuickCapture'
import { Notifications }            from './components/Notifications'
import { SettingsModal }            from './components/SettingsModal'
import { ColumnsModal }             from './components/ColumnsModal'
import { NewViewModal }             from './components/tasks/NewViewModal'

export default function App() {
  const { activeView, tasks: allTasks, projects, init, undo, activeWorkspaceId, quickCaptureOpen, toggleQuickCapture, closeQuickCapture, toggleMobileSidebar, startCloudSync, stopCloudSync } = useAppStore()
  const { quickCaptureHotkey }  = useSettingsStore()
  const generate                = useNotificationStore(s => s.generate)
  const { user, init: initAuth } = useAuthStore()

  // useMemo (não recalcular a cada render): allTasks.filter cria uma referência nova toda
  // vez, e como esse array é dependência do useEffect abaixo, isso disparava o efeito em
  // loop infinito (o efeito chama generate() → muda o store de notificações → re-renderiza
  // App → novo array → efeito de novo...). Bug real que travava o app com tela branca
  // (erro React #185 "Maximum update depth exceeded") assim que havia tarefas com prazo.
  const tasks = useMemo(() => allTasks.filter(t => t.workspaceId === activeWorkspaceId), [allTasks, activeWorkspaceId])

  useEffect(() => { init(); initAuth() }, [])

  // Liga a sincronização em tempo real com o Firestore assim que o login anônimo (silencioso,
  // sem tela) resolve — o Firestore exige *algum* usuário autenticado pelas regras de
  // segurança, mesmo sem conta visível.
  useEffect(() => {
    if (user) {
      startCloudSync()
      return () => stopCloudSync()
    }
  }, [user])

  // Todos os hooks (useEffect) precisam rodar sempre, em toda renderização — inclusive
  // enquanto a tela de login/carregamento está sendo exibida. Por isso ficam todos ANTES
  // dos `return` condicionais abaixo (regra dos Hooks do React); colocá-los depois faz o
  // número de hooks mudar entre a tela de login e o app principal, e o React trava com
  // tela branca (sem erro visível) assim que o login termina.
  useEffect(() => {
    if (!user || tasks.length === 0) return
    const enriched = tasks.map(t => ({
      id: t.id, title: t.title, dueDate: t.dueDate, status: t.status,
      projectName: projects.find(p => p.id===t.projectId)?.name ?? '',
    }))
    generate(enriched)
    const interval = setInterval(() => generate(enriched), 60_000)
    return () => clearInterval(interval)
  }, [user, tasks, projects])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchHotkey(quickCaptureHotkey, e)) { e.preventDefault(); toggleQuickCapture() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [quickCaptureHotkey])

  // Ctrl+Z / Cmd+Z → desfazer (mover/excluir/reordenar)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey && !editing) {
        e.preventDefault(); undo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])

  const view = () => {
    switch (activeView) {
      case 'inbox':          return <InboxView/>
      case 'my_tasks':       return <MyTasksView/>
      case 'all_tasks':      return <AllTasksView/>
      case 'projects':       return <ProjectsListView/>
      case 'project_detail': return <ProjectDetailView/>
      case 'space_detail':   return <SpaceDetailView/>
      case 'folder_detail':  return <FolderDetailView/>
      case 'calendar':       return <CalendarView/>
      case 'reports':        return <ReportsView/>
      case 'automations':    return <AutomationsView/>
      case 'goals':          return <GoalsView/>
      default:               return <MyTasksView/>
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-app)]">
      <Sidebar/>
      <main className="flex flex-col flex-1 overflow-hidden min-w-0 p-2 md:p-4">
        {/* Mobile Top Bar */}
        <div className="flex md:hidden items-center justify-between px-3 py-2 bg-white rounded-xl mb-2 border border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleMobileSidebar}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              title="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <span className="font-extrabold text-[15px] text-gray-800 tracking-tight">Gerenciador de Projetos</span>
          </div>
          <button 
            onClick={toggleQuickCapture}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-500 hover:bg-brand-600 transition-colors text-white text-[11px] font-bold rounded-lg shadow-sm"
          >
            Capturar
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-w-0 rounded-2xl bg-white shadow-[0_1px_2px_rgba(23,24,28,.04),0_14px_32px_-10px_rgba(23,24,28,.12)]">
          {view()}
        </div>
      </main>

      <NewProjectModal/>
      <AIProjectModal/>
      <EnrichProjectModal/>
      <GUTModal/>
      <SettingsModal/>
      <ColumnsModal/>
      <NewViewModal/>
      <QuickCapture open={quickCaptureOpen} onClose={closeQuickCapture}/>
      <Notifications/>
    </div>
  )
}
