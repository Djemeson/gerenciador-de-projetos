import React, { useMemo, useState } from 'react'
import { BarChart2, TrendingUp, AlertTriangle, CheckCircle2, Clock, Printer, Users, Zap, X, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { gutTier } from '../types'
import type { DateFieldKey, DateFilterValue } from '../types'
import { DatePeriodPicker } from '../components/ui/DatePeriodPicker'
import {
  matchesDateFilter, resolvePeriodRange, taskDateValue, parseISO,
  periodDisplayLabel, DATE_FIELD_LABEL,
} from '../lib/dateFilter'

const isoDate = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10) }
const weekStartFrom = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - x.getDay()); return x }

function startOfWeek() {
  const d = new Date(); d.setHours(0,0,0,0)
  d.setDate(d.getDate() - d.getDay()); return d
}
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
const addDays    = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

// Preferência do recorte de datas, lembrada entre visitas (mesmo espírito das preferências
// por escopo do TaskPanel — o relatório costuma ser aberto sempre com o mesmo recorte).
const FIELD_KEY  = 'tf_reports_datefield'
const PERIOD_KEY = 'tf_reports_period'
function loadPref<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}
function savePref(key: string, value: unknown) {
  try { value === undefined ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// Rótulo do gráfico conforme o campo de data escolhido — o eixo mostra as tarefas do
// recorte posicionadas por esse campo, então o título precisa acompanhar.
const ACTIVITY_TITLE: Record<DateFieldKey, string> = {
  completedAt: 'Concluídas',
  dueDate:     'Vencimentos',
  createdAt:   'Criadas',
}

export function ReportsView() {
  const { tasks: allTasks, projects: allProjects, activeWorkspaceId } = useAppStore()

  const [dateField, setDateField] = useState<DateFieldKey>(() => loadPref<DateFieldKey>(FIELD_KEY, 'completedAt'))
  const [period,    setPeriod]    = useState<DateFilterValue | undefined>(() => loadPref<DateFilterValue | undefined>(PERIOD_KEY, undefined))

  const changeField  = (f: DateFieldKey) => { setDateField(f); savePref(FIELD_KEY, f) }
  const changePeriod = (v: DateFilterValue | undefined) => { setPeriod(v); savePref(PERIOD_KEY, v) }

  const workspaceTasks = useMemo(() => allTasks.filter(t => t.workspaceId === activeWorkspaceId), [allTasks, activeWorkspaceId])
  // Todo o relatório trabalha em cima deste recorte: sem período escolhido, é o workspace
  // inteiro (comportamento de sempre); com período, só as tarefas que caem nele.
  const tasks    = useMemo(
    () => period ? workspaceTasks.filter(t => matchesDateFilter(t, dateField, period)) : workspaceTasks,
    [workspaceTasks, dateField, period],
  )
  // Base das seções de "estado atual" (em atraso, urgentes, carga da equipe, distribuição
  // por prioridade, saúde dos projetos). Um recorte por **data de conclusão** não pode
  // valer para elas: tarefa não concluída não tem essa data, então cairia fora do recorte
  // e o painel inteiro zeraria — "o que fizemos em julho" não significa que hoje não há
  // nada atrasado. Já vencimento e criação existem em qualquer tarefa, e aí o recorte vale
  // para o relatório todo.
  const currentTasks = dateField === 'completedAt' ? workspaceTasks : tasks

  const projects = useMemo(() => allProjects.filter(p => p.workspaceId === activeWorkspaceId), [allProjects, activeWorkspaceId])

  const now      = new Date()
  const weekStart= startOfWeek()

  // Modal "Concluídas na semana" (com data editável)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [weekRef, setWeekRef] = useState<Date>(() => startOfWeek())
  const weekRefEnd = useMemo(() => { const x = new Date(weekRef); x.setDate(x.getDate() + 7); return x }, [weekRef])
  const doneInWeek = useMemo(() =>
    tasks.filter(t => t.status==='done' && !t.parentId && new Date(t.updatedAt) >= weekRef && new Date(t.updatedAt) < weekRefEnd)
      .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  , [tasks, weekRef, weekRefEnd])
  const shiftWeek = (n: number) => setWeekRef(d => { const x = new Date(d); x.setDate(x.getDate() + n*7); return x })

  const stats = useMemo(() => {
    const active      = currentTasks.filter(t => t.status !== 'done' && !t.parentId)
    const done        = currentTasks.filter(t => t.status === 'done')
    const doneThisWeek= done.filter(t => new Date(t.updatedAt) >= weekStart)
    const overdue     = active.filter(t => t.dueDate && new Date(t.dueDate) < now)
    const urgent      = active.filter(t => t.priority === 'urgent')
    const total       = currentTasks.filter(t => !t.parentId).length
    const completionRate = total > 0 ? Math.round((done.length / total) * 100) : 0

    return { active: active.length, done: done.length, doneThisWeek: doneThisWeek.length, overdue: overdue.length, urgent: urgent.length, total, completionRate }
  }, [currentTasks])

  const projectHealth = useMemo(() =>
    [...projects].filter(p => !p.archived).sort((a, b) => b.gut.score - a.gut.score).map(p => {
      const pt      = currentTasks.filter(t => t.projectId === p.id && !t.parentId)
      const donePt  = pt.filter(t => t.status === 'done').length
      const overdPt = pt.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now).length
      const urgPt   = pt.filter(t => t.priority === 'urgent' && t.status !== 'done').length
      const pct     = pt.length > 0 ? Math.round((donePt / pt.length) * 100) : 0
      return { project: p, total: pt.length, done: donePt, overdue: overdPt, urgent: urgPt, pct }
    })
  , [currentTasks, projects])

  const priorityDist = useMemo(() => {
    const active = currentTasks.filter(t => t.status !== 'done' && !t.parentId)
    const total  = active.length || 1
    return (['urgent','high','medium','low'] as const).map(p => ({
      label: { urgent:'Urgente', high:'Alta', medium:'Média', low:'Baixa' }[p],
      count: active.filter(t => t.priority === p).length,
      color: { urgent:'#D85A30', high:'#BA7517', medium:'#378ADD', low:'#888780' }[p],
      pct: Math.round((active.filter(t => t.priority === p).length / total) * 100),
    }))
  }, [currentTasks])

  const workload = useMemo(() => {
    const active = currentTasks.filter(t => t.status !== 'done')
    const people = [...new Set(active.map(t => t.assignee))].filter(Boolean)
    return people.map(person => ({
      person,
      total:   active.filter(t => t.assignee === person).length,
      urgent:  active.filter(t => t.assignee === person && t.priority === 'urgent').length,
      overdue: active.filter(t => t.assignee === person && t.dueDate && new Date(t.dueDate) < now).length,
    })).sort((a, b) => b.total - a.total)
  }, [currentTasks])

  // Intervalo efetivo do relatório. Períodos abertos ("antes de", "depois de") não têm um
  // dos lados, então caem para a menor/maior data das próprias tarefas do recorte — sem
  // isso o gráfico não teria onde começar (ou terminar).
  const range = useMemo(() => {
    const today0 = startOfDay(now)
    const r = period ? resolvePeriodRange(period) : { start: null, end: null }
    const dates = tasks.map(t => taskDateValue(t, dateField)).filter(Boolean).map(d => parseISO(d as string).getTime())
    const min = dates.length ? new Date(Math.min(...dates)) : null
    const max = dates.length ? new Date(Math.max(...dates)) : null
    if (!period) return { start: addDays(today0, -6), end: addDays(today0, 1) }   // padrão: últimos 7 dias
    return {
      start: startOfDay(r.start ?? min ?? addDays(today0, -6)),
      end:   r.end ?? addDays(startOfDay(max ?? today0), 1),
    }
  }, [period, dateField, tasks])

  // Barras do gráfico, com granularidade que acompanha o tamanho do recorte — um ano em
  // barras diárias seriam 365 colunas de 1px.
  const activity = useMemo(() => {
    const totalDays = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86400000))
    const step: 'day' | 'week' | 'month' = totalDays <= 14 ? 'day' : totalDays <= 92 ? 'week' : 'month'

    const buckets: { label: string; start: Date; end: Date; count: number }[] = []
    let cursor = step === 'month' ? new Date(range.start.getFullYear(), range.start.getMonth(), 1) : startOfDay(range.start)
    while (cursor < range.end && buckets.length < 24) {
      const next = step === 'day'   ? addDays(cursor, 1)
                 : step === 'week'  ? addDays(cursor, 7)
                 : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      buckets.push({
        label: step === 'day'   ? (totalDays <= 7 ? cursor.toLocaleDateString('pt-BR', { weekday: 'short' })
                                                  : cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))
             : step === 'week'  ? cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
             :                    cursor.toLocaleDateString('pt-BR', { month: 'short' }),
        start: cursor, end: next, count: 0,
      })
      cursor = next
    }

    tasks.forEach(t => {
      const raw = taskDateValue(t, dateField)
      if (!raw) return
      const time = parseISO(raw).getTime()
      const b = buckets.find(b => time >= b.start.getTime() && time < b.end.getTime())
      if (b) b.count++
    })

    return { buckets, step }
  }, [tasks, dateField, range])

  const maxActivity = Math.max(...activity.buckets.map(b => b.count), 1)
  const activitySubtitle = activity.step === 'day' ? 'por dia' : activity.step === 'week' ? 'por semana' : 'por mês'

  // Concluídas dentro do recorte — substitui o número da semana quando há período ativo.
  const doneInPeriod = useMemo(
    () => tasks.filter(t => t.status === 'done' && !t.parentId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [tasks],
  )

  // Lista do modal: segue o recorte quando há um; senão, a semana escolhida ali dentro.
  const completedList = period ? doneInPeriod : doneInWeek

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 bg-white space-y-2.5">
        <div className="flex items-center gap-3">
          <BarChart2 size={15} className="text-gray-400" />
          <h1 className="text-sm font-semibold text-gray-900 flex-1">Relatórios</h1>
          <span className="text-xs text-gray-400 hidden sm:inline">
            {period
              ? `${DATE_FIELD_LABEL[dateField]} · ${periodDisplayLabel(period)}`
              : `Semana de ${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} a ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`}
          </span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <Printer size={13} /> Imprimir
          </button>
        </div>

        {/* Recorte de datas — mesmo seletor usado nos Filtros e no "+ Visualização" */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <Filter size={12} className="text-gray-400 flex-shrink-0" />
          <DatePeriodPicker
            field={dateField}
            fieldOptions={['completedAt', 'dueDate', 'createdAt']}
            onFieldChange={changeField}
            value={period}
            onChange={changePeriod}
            onRemove={period ? () => changePeriod(undefined) : undefined}
          />
          <span className="text-[11px] text-gray-400">
            {!period
              ? `Sem recorte — todas as ${workspaceTasks.length} tarefas`
              : dateField === 'completedAt'
                ? `${tasks.length} de ${workspaceTasks.length} tarefas no recorte · atraso, urgentes e carga seguem o momento atual`
                : `${tasks.length} de ${workspaceTasks.length} tarefas no recorte`}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 print:p-4">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<CheckCircle2 size={16} className="text-green-600" />}
            label={period ? 'Concluídas no período' : 'Concluídas esta semana'}
            value={period ? doneInPeriod.length : stats.doneThisWeek}
            sub={`${stats.done} total · ver detalhes`}
            accent="green"
            onClick={() => { setWeekRef(startOfWeek()); setCompletedOpen(true) }}
          />
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

          {/* Atividade no período (granularidade acompanha o recorte) */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <TrendingUp size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">{ACTIVITY_TITLE[dateField]}</span>
              <span className="text-[10px] text-gray-400">{activitySubtitle}</span>
            </div>
            <div className="px-4 py-4 flex items-end gap-1.5 h-44 overflow-x-auto">
              {activity.buckets.map((b, i) => (
                <div key={i} className="flex-1 min-w-[16px] flex flex-col items-center gap-1"
                     title={`${b.label}: ${b.count}`}>
                  <span className="text-[10px] text-gray-500">{b.count > 0 ? b.count : ''}</span>
                  <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(4, (b.count / maxActivity) * 100)}px`, background: b.count > 0 ? '#6366F1' : '#E5E7EB' }} />
                  <span className="text-[10px] text-gray-400 truncate max-w-full">{b.label}</span>
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
              {currentTasks.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now && !t.parentId)
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

      {/* Modal: Concluídas na semana (data editável) */}
      {completedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setCompletedOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-[540px] max-w-[92vw] max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <CheckCircle2 size={15} className="text-green-600" />
              <span className="text-sm font-semibold text-gray-900 flex-1">{period ? 'Concluídas no período' : 'Concluídas na semana'}</span>
              <button onClick={() => setCompletedOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><X size={14} /></button>
            </div>

            {/* Com recorte de datas ativo o modal segue o recorte; sem ele, mantém a
                navegação por semana (seção 13.3 das diretrizes). */}
            {period ? (
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{DATE_FIELD_LABEL[dateField]}</span>
                <span className="text-gray-400">·</span>
                <span>{periodDisplayLabel(period)}</span>
                <span className="ml-auto text-gray-400">{doneInPeriod.length}</span>
              </div>
            ) : (
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
              <button onClick={() => shiftWeek(-1)} className="flex items-center gap-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"><ChevronLeft size={13} /> Anterior</button>
              <input type="date" value={isoDate(weekRef)} onChange={e => e.target.value && setWeekRef(weekStartFrom(new Date(e.target.value + 'T00:00:00')))}
                className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none text-gray-700" />
              <button onClick={() => shiftWeek(1)} className="flex items-center gap-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Próxima <ChevronRight size={13} /></button>
              <span className="text-xs text-gray-400 ml-auto">
                {weekRef.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} – {new Date(weekRefEnd.getTime()-1).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} · {doneInWeek.length}
              </span>
            </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {completedList.length === 0 ? (
                <p className="px-5 py-8 text-xs text-gray-400 text-center">
                  {period ? 'Nenhuma tarefa concluída neste recorte.' : 'Nenhuma tarefa concluída nesta semana.'}
                </p>
              ) : completedList.map(t => {
                const p = projects.find(pr => pr.id === t.projectId)
                return (
                  <div key={t.id} className="flex items-center gap-2 px-5 py-2.5">
                    <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                    <span className="flex-1 text-xs text-gray-700 truncate">{t.title}</span>
                    {p && <span className="text-[10px] text-gray-400 flex-shrink-0">{p.name}</span>}
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(t.updatedAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, sub, accent, onClick }: { icon: React.ReactNode; label: string; value: string | number; sub: string; accent: string; onClick?: () => void }) {
  const accents: Record<string, string> = {
    green:  'border-green-100',
    brand:  'border-brand-100',
    red:    'border-red-100',
    orange: 'border-orange-100',
  }
  return (
    <div onClick={onClick}
      className={`bg-white border rounded-xl p-4 ${accents[accent] ?? 'border-gray-200'} ${onClick ? 'cursor-pointer hover:shadow-sm hover:border-green-300 transition-all' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
