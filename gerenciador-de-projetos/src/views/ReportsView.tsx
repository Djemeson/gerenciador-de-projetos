import React, { useMemo } from 'react'
import { BarChart2, TrendingUp, AlertTriangle, CheckCircle2, Clock, Printer, Users, Zap } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { gutTier } from '../types'

function startOfWeek() {
  const d = new Date(); d.setHours(0,0,0,0)
  d.setDate(d.getDate() - d.getDay()); return d
}

export function ReportsView() {
  const { tasks, projects } = useAppStore()

  const now      = new Date()
  const weekStart= startOfWeek()

  const stats = useMemo(() => {
    const active      = tasks.filter(t => t.status !== 'done' && !t.parentId)
    const done        = tasks.filter(t => t.status === 'done')
    const doneThisWeek= done.filter(t => new Date(t.updatedAt) >= weekStart)
    const overdue     = active.filter(t => t.dueDate && new Date(t.dueDate) < now)
    const urgent      = active.filter(t => t.priority === 'urgent')
    const total       = tasks.filter(t => !t.parentId).length
    const completionRate = total > 0 ? Math.round((done.length / total) * 100) : 0

    return { active: active.length, done: done.length, doneThisWeek: doneThisWeek.length, overdue: overdue.length, urgent: urgent.length, total, completionRate }
  }, [tasks])

  const projectHealth = useMemo(() =>
    [...projects].filter(p => !p.archived).sort((a, b) => b.gut.score - a.gut.score).map(p => {
      const pt      = tasks.filter(t => t.projectId === p.id && !t.parentId)
      const donePt  = pt.filter(t => t.status === 'done').length
      const overdPt = pt.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now).length
      const urgPt   = pt.filter(t => t.priority === 'urgent' && t.status !== 'done').length
      const pct     = pt.length > 0 ? Math.round((donePt / pt.length) * 100) : 0
      return { project: p, total: pt.length, done: donePt, overdue: overdPt, urgent: urgPt, pct }
    })
  , [tasks, projects])

  const priorityDist = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'done' && !t.parentId)
    const total  = active.length || 1
    return (['urgent','high','medium','low'] as const).map(p => ({
      label: { urgent:'Urgente', high:'Alta', medium:'Média', low:'Baixa' }[p],
      count: active.filter(t => t.priority === p).length,
      color: { urgent:'#D85A30', high:'#BA7517', medium:'#378ADD', low:'#888780' }[p],
      pct: Math.round((active.filter(t => t.priority === p).length / total) * 100),
    }))
  }, [tasks])

  const workload = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'done')
    const people = [...new Set(active.map(t => t.assignee))].filter(Boolean)
    return people.map(person => ({
      person,
      total:   active.filter(t => t.assignee === person).length,
      urgent:  active.filter(t => t.assignee === person && t.priority === 'urgent').length,
      overdue: active.filter(t => t.assignee === person && t.dueDate && new Date(t.dueDate) < now).length,
    })).sort((a, b) => b.total - a.total)
  }, [tasks])

  // Last 7 days activity
  const weekActivity = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0)
      const next = new Date(d); next.setDate(next.getDate() + 1)
      return {
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
        completed: tasks.filter(t => t.status === 'done' && new Date(t.updatedAt) >= d && new Date(t.updatedAt) < next).length,
      }
    })
  }, [tasks])

  const maxActivity = Math.max(...weekActivity.map(d => d.completed), 1)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white">
        <BarChart2 size={15} className="text-gray-400" />
        <h1 className="text-sm font-semibold text-gray-900 flex-1">Relatório semanal</h1>
        <span className="text-xs text-gray-400">
          Semana de {weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} a {now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Printer size={13} /> Imprimir
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 print:p-4">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={<CheckCircle2 size={16} className="text-green-600" />} label="Concluídas esta semana" value={stats.doneThisWeek} sub={`${stats.done} total`} accent="green" />
          <KpiCard icon={<TrendingUp    size={16} className="text-brand-600" />} label="Taxa de conclusão"      value={`${stats.completionRate}%`} sub={`${stats.done}/${stats.total} tarefas`} accent="brand" />
          <KpiCard icon={<AlertTriangle size={16} className="text-red-500" />}  label="Em atraso"              value={stats.overdue}  sub="tarefas atrasadas" accent="red" />
          <KpiCard icon={<Zap           size={16} className="text-orange-500" />} label="Urgentes ativas"      value={stats.urgent}   sub="precisam atenção" accent="orange" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Project Health */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <BarChart2 size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Saúde dos projetos</span>
              <span className="text-[10px] text-gray-400 ml-1">ordenado por GUT</span>
            </div>
            <div className="divide-y divide-gray-50">
              {projectHealth.map(({ project: p, total, done, overdue, urgent, pct }) => {
                const tier = gutTier(p.gut.score)
                return (
                  <div key={p.id} className="px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="text-sm font-medium text-gray-800 flex-1">{p.name}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: tier.bg, color: tier.color }}>
                        GUT {p.gut.score}
                      </span>
                      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.color }} />
                      </div>
                      <div className="flex gap-2 text-[10px] text-gray-400 flex-shrink-0">
                        <span>{done}/{total}</span>
                        {overdue > 0 && <span className="text-red-500">{overdue} atraso</span>}
                        {urgent > 0  && <span className="text-orange-500">{urgent} urgente</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Atividade semanal */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <TrendingUp size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Atividade (7 dias)</span>
            </div>
            <div className="px-4 py-4 flex items-end gap-1.5 h-44">
              {weekActivity.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500">{d.completed > 0 ? d.completed : ''}</span>
                  <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(4, (d.completed / maxActivity) * 100)}px`, background: d.completed > 0 ? '#6B5EE8' : '#E5E7EB' }} />
                  <span className="text-[10px] text-gray-400">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Priority distribution */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Distribuição por prioridade</span>
              <span className="text-[10px] text-gray-400">(tarefas ativas)</span>
            </div>
            <div className="px-4 py-4 space-y-3">
              {priorityDist.map(({ label, count, color, pct }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{label}</span>
                    <span className="text-xs font-medium text-gray-700">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workload */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Users size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Carga da equipe</span>
            </div>
            <div className="divide-y divide-gray-50">
              {workload.length === 0 && <p className="text-xs text-gray-400 px-4 py-4">Nenhuma tarefa ativa.</p>}
              {workload.map(({ person, total, urgent, overdue }) => (
                <div key={person} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-[11px] font-medium flex items-center justify-center flex-shrink-0">
                    {person.slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-800">{person}</p>
                    <p className="text-[10px] text-gray-400">{total} ativas {overdue > 0 && <span className="text-red-500">· {overdue} atraso</span>}</p>
                  </div>
                  {urgent > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full font-medium">{urgent} urgente</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overdue list */}
        {stats.overdue > 0 && (
          <div className="bg-white border border-red-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-red-100 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-sm font-medium text-red-700">Tarefas em atraso</span>
            </div>
            <div className="divide-y divide-gray-50">
              {tasks.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now && !t.parentId)
                .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                .map(t => {
                  const p = projects.find(p => p.id === t.projectId)
                  const days = Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / 86400000)
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p?.color ?? '#888' }} />
                      <span className="flex-1 text-xs text-gray-800 truncate">{t.title}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{p?.name}</span>
                      <span className="text-[10px] text-red-500 flex-shrink-0 font-medium">{days}d atraso</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string | number; sub: string; accent: string }) {
  const accents: Record<string, string> = {
    green:  'border-green-100',
    brand:  'border-brand-100',
    red:    'border-red-100',
    orange: 'border-orange-100',
  }
  return (
    <div className={`bg-white border rounded-xl p-4 ${accents[accent] ?? 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
