import React, { useMemo, useState } from 'react'
import {
  BarChart2, TrendingUp, AlertTriangle, CheckCircle2, Clock, Printer, Users, Zap,
  Filter, Download, Target, Layers, Tag, Timer, Hourglass, PauseCircle, Flame,
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { gutTier, GOAL_STATUS_META, PRIORITY_LABEL, STATUS_LABEL } from '../types'
import type { DateFieldKey, DateFilterValue, Task } from '../types'
import { DatePeriodPicker } from '../components/ui/DatePeriodPicker'
import { Select, PRIORITY_OPTIONS } from '../components/ui/Select'
import { Section, KpiCard, MiniBar, EmptyState, DeltaBadge } from '../components/reports/ReportPrimitives'
import { ActivityChart } from '../components/reports/ActivityChart'
import { TaskListModal } from '../components/reports/TaskListModal'
import { MeetingReviewCard } from '../components/reports/MeetingReviewCard'
import { downloadCsv, csvFilename } from '../lib/exportCsv'
import {
  matchesDateFilter, taskDateValue, parseISO, periodDisplayLabel, DATE_FIELD_LABEL,
} from '../lib/dateFilter'
import {
  effectiveRange, previousRange, tasksInRange, computeKpis, delta, buildSeries,
  bySpace, byTag, byAssignee, topByGut, averageProgress, STALLED_DAYS,
} from '../lib/reportMetrics'
import { goalHealth } from '../lib/goalMetrics'

// Preferências do painel, lembradas entre visitas — o relatório costuma ser aberto
// sempre com o mesmo recorte.
const PREF_KEYS = {
  field: 'tf_reports_datefield', period: 'tf_reports_period',
  space: 'tf_reports_space', project: 'tf_reports_project',
  assignee: 'tf_reports_assignee', tag: 'tf_reports_tag',
  tab: 'tf_reports_tab',
} as const
function loadPref<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}
function savePref(key: string, value: unknown) {
  try { value === undefined || value === '' ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

const ALL = ''   // valor do "todos" nos filtros de escopo

/**
 * Abas do relatório. Resumo e KPIs ficam sempre visíveis (são a régua da tela); o resto
 * entra por aba, senão o painel vira uma parede de doze blocos numa rolagem só. Mesmo
 * padrão de abas do `TaskPanel`, inclusive na escolha lembrada em localStorage.
 * Na impressão todas as abas saem juntas (`hidden print:block`) — no papel o relatório
 * tem que estar completo.
 */
const TABS = [
  { id: 'fluxo',    label: 'Fluxo',        icon: TrendingUp },
  { id: 'progresso',label: 'Progresso',    icon: Target },
  { id: 'divisao',  label: 'Distribuição', icon: Users },
  { id: 'riscos',   label: 'Riscos',       icon: AlertTriangle },
] as const
type TabId = typeof TABS[number]['id']
const fmtDate = (iso: string | null | undefined) =>
  iso ? parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'

export function ReportsView() {
  const { tasks: allTasks, projects: allProjects, spaces: allSpaces, goals: allGoals, activeWorkspaceId } = useAppStore()

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [dateField, setDateField] = useState<DateFieldKey>(() => loadPref(PREF_KEYS.field, 'completedAt' as DateFieldKey))
  const [period,    setPeriod]    = useState<DateFilterValue | undefined>(() => loadPref<DateFilterValue | undefined>(PREF_KEYS.period, undefined))
  const [spaceId,   setSpaceId]   = useState<string>(() => loadPref(PREF_KEYS.space, ALL))
  const [projectId, setProjectId] = useState<string>(() => loadPref(PREF_KEYS.project, ALL))
  const [assignee,  setAssignee]  = useState<string>(() => loadPref(PREF_KEYS.assignee, ALL))
  const [tag,       setTag]       = useState<string>(() => loadPref(PREF_KEYS.tag, ALL))
  const [tab,       setTab]       = useState<TabId>(() => loadPref(PREF_KEYS.tab, 'fluxo' as TabId))

  const setPref = <T,>(key: string, set: (v: T) => void) => (v: T) => { set(v); savePref(key, v) }
  const changeField    = setPref<DateFieldKey>(PREF_KEYS.field, setDateField)
  const changePeriod   = setPref<DateFilterValue | undefined>(PREF_KEYS.period, setPeriod)
  const changeSpace    = setPref<string>(PREF_KEYS.space, setSpaceId)
  const changeProject  = setPref<string>(PREF_KEYS.project, setProjectId)
  const changeAssignee = setPref<string>(PREF_KEYS.assignee, setAssignee)
  const changeTag      = setPref<string>(PREF_KEYS.tag, setTag)
  const changeTab      = setPref<TabId>(PREF_KEYS.tab, setTab)

  const clearAll = () => {
    changePeriod(undefined); changeSpace(ALL); changeProject(ALL); changeAssignee(ALL); changeTag(ALL)
  }

  // `now` fixado por render: dois blocos do relatório não podem calcular "hoje" em
  // instantes diferentes.
  const now = useMemo(() => new Date(), [allTasks, activeWorkspaceId])

  const projects = useMemo(() => allProjects.filter(p => p.workspaceId === activeWorkspaceId), [allProjects, activeWorkspaceId])
  const spaces   = useMemo(() => allSpaces.filter(s => s.workspaceId === activeWorkspaceId), [allSpaces, activeWorkspaceId])
  const goals    = useMemo(() => allGoals.filter(g => g.workspaceId === activeWorkspaceId), [allGoals, activeWorkspaceId])

  // Escopo: workspace → espaço/projeto/responsável/tag. O recorte de datas entra depois.
  const scopedTasks = useMemo(() => {
    const projectSpace = new Map(projects.map(p => [p.id, p.spaceId]))
    return allTasks.filter(t => {
      if (t.workspaceId !== activeWorkspaceId) return false
      if (spaceId   && projectSpace.get(t.projectId) !== spaceId) return false
      if (projectId && t.projectId !== projectId) return false
      if (assignee  && t.assignee !== assignee) return false
      if (tag       && !t.tags.includes(tag)) return false
      return true
    })
  }, [allTasks, activeWorkspaceId, projects, spaceId, projectId, assignee, tag])

  const periodTasks = useMemo(
    () => period ? scopedTasks.filter(t => matchesDateFilter(t, dateField, period)) : scopedTasks,
    [scopedTasks, dateField, period],
  )

  // Métricas de estado atual ignoram o recorte quando ele é por data de conclusão: tarefa
  // aberta não tem essa data e o painel inteiro zeraria (ver DIRETRIZES, seção 13.3).
  const currentTasks = dateField === 'completedAt' ? scopedTasks : periodTasks

  // ── Intervalos e comparação ────────────────────────────────────────────────
  const range     = useMemo(() => effectiveRange(period, periodTasks, dateField, now), [period, periodTasks, dateField, now])
  const prevRange = useMemo(() => previousRange(range), [range])

  const kpis      = useMemo(() => computeKpis(currentTasks, now), [currentTasks, now])
  const doneNow   = useMemo(() => tasksInRange(scopedTasks, 'completedAt', range), [scopedTasks, range])
  const donePrev  = useMemo(() => tasksInRange(scopedTasks, 'completedAt', prevRange), [scopedTasks, prevRange])
  const createdNow  = useMemo(() => tasksInRange(scopedTasks, 'createdAt', range), [scopedTasks, range])
  const createdPrev = useMemo(() => tasksInRange(scopedTasks, 'createdAt', prevRange), [scopedTasks, prevRange])
  // "Em atraso" e "urgentes" não têm variação: seriam a foto de hoje contra a foto de
  // ontem, e o app não guarda histórico de status para reconstruir a de ontem. Melhor
  // não mostrar comparação do que exibir um número que parece medido e não é.

  const series = useMemo(() => buildSeries(periodTasks, range), [periodTasks, range])
  const stepLabel = series.step === 'day' ? 'por dia' : series.step === 'week' ? 'por semana' : 'por mês'

  // ── Recortes por dimensão ──────────────────────────────────────────────────
  const spaceRows    = useMemo(() => bySpace(currentTasks, projects, spaces, now), [currentTasks, projects, spaces, now])
  const tagRows      = useMemo(() => byTag(currentTasks, now).slice(0, 8), [currentTasks, now])
  const assigneeRows = useMemo(() => byAssignee(currentTasks.filter(t => t.status !== 'done'), now), [currentTasks, now])
  const gutTasks     = useMemo(() => topByGut(currentTasks), [currentTasks])

  const projectHealth = useMemo(() =>
    [...projects].filter(p => !p.archived).map(p => {
      const pt = currentTasks.filter(t => t.projectId === p.id && !t.parentId)
      return {
        project: p,
        total: pt.length,
        done: pt.filter(t => t.status === 'done').length,
        overdue: pt.filter(t => t.dueDate && t.status !== 'done' && parseISO(t.dueDate) < now).length,
        urgent: pt.filter(t => t.priority === 'urgent' && t.status !== 'done').length,
        progress: averageProgress(pt, currentTasks) ?? 0,
      }
    }).filter(r => r.total > 0).sort((a, b) => b.project.gut.score - a.project.gut.score)
  , [currentTasks, projects, now])

  const priorityDist = useMemo(() => {
    const active = currentTasks.filter(t => t.status !== 'done' && !t.parentId)
    const total  = active.length || 1
    // Cores vêm de PRIORITY_OPTIONS (fonte única do app) — nunca repetir a paleta aqui.
    return PRIORITY_OPTIONS.map(opt => {
      const count = active.filter(t => t.priority === opt.value).length
      return { value: opt.value, label: opt.label, color: opt.color ?? '#9B9EA8', count, pct: Math.round((count / total) * 100) }
    })
  }, [currentTasks])

  const overdueTasks = useMemo(
    () => currentTasks.filter(t => t.dueDate && t.status !== 'done' && parseISO(t.dueDate) < now && !t.parentId)
      .sort((a, b) => parseISO(a.dueDate!).getTime() - parseISO(b.dueDate!).getTime()),
    [currentTasks, now],
  )
  const urgentTasks = useMemo(
    () => currentTasks.filter(t => t.priority === 'urgent' && t.status !== 'done' && !t.parentId),
    [currentTasks],
  )
  // Abertas com prazo nos próximos 7 dias — entram no "Próximos passos" do resumo da reunião.
  const dueSoonTasks = useMemo(() => {
    const limite = new Date(now); limite.setDate(limite.getDate() + 7)
    return currentTasks
      .filter(t => t.dueDate && t.status !== 'done' && !t.parentId && parseISO(t.dueDate) >= now && parseISO(t.dueDate) <= limite)
      .sort((a, b) => parseISO(a.dueDate!).getTime() - parseISO(b.dueDate!).getTime())
  }, [currentTasks, now])

  // Metas em risco entram no resumo executivo.
  // Saúde derivada (progresso × prazo), a mesma da tela de Metas — o campo `status`
  // sozinho podia estar velho.
  const goalsHealth = useMemo(() => new Map(goals.map(g => [g.id, goalHealth(g, scopedTasks, now)])), [goals, scopedTasks, now])
  const goalsAtRisk = useMemo(() => goals.filter(g => ['at_risk','off_track'].includes(goalsHealth.get(g.id)!.status)), [goals, goalsHealth])

  // ── Drill-down ─────────────────────────────────────────────────────────────
  const [drill, setDrill] = useState<{ title: string; subtitle?: string; tasks: Task[] } | null>(null)

  // ── Exportação ─────────────────────────────────────────────────────────────
  const exportarTudo = () => {
    const rows = periodTasks.filter(t => !t.parentId).map(t => {
      const p = projects.find(pr => pr.id === t.projectId)
      const s = spaces.find(sp => sp.id === p?.spaceId)
      return [
        t.title, p?.name ?? '', s?.name ?? 'Sem espaço',
        STATUS_LABEL[t.status], PRIORITY_LABEL[t.priority], t.assignee, t.tags.join(', '),
        fmtDate(t.createdAt), fmtDate(t.dueDate), fmtDate(t.completedAt),
        t.gut?.score ?? '', averageProgress([t], currentTasks) ?? '',
      ]
    })
    downloadCsv(
      csvFilename('relatorio'),
      ['Tarefa', 'Projeto', 'Espaço', 'Status', 'Prioridade', 'Responsável', 'Tags', 'Criada em', 'Prazo', 'Concluída em', 'GUT', 'Progresso %'],
      rows,
    )
  }

  const scopeActive = !!(period || spaceId || projectId || assignee || tag)
  const rangeLabel  = `${range.start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${new Date(range.end.getTime() - 1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`

  const allTags      = useMemo(() => [...new Set(scopedTasks.flatMap(t => t.tags))].filter(Boolean).sort(), [scopedTasks])
  const allAssignees = useMemo(() => [...new Set(allTasks.filter(t => t.workspaceId === activeWorkspaceId).map(t => t.assignee))].filter(Boolean).sort(), [allTasks, activeWorkspaceId])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Cabeçalho ── */}
      <div className="px-6 py-3.5 border-b border-gray-200 bg-white space-y-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <BarChart2 size={16} className="text-gray-400" />
          <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900 flex-1">Relatórios</h1>
          <span className="text-[11px] text-gray-400 hidden md:inline tabnum">{rangeLabel}</span>
          <button onClick={exportarTudo}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0 print:hidden">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0 print:hidden">
            <Printer size={14} /> Imprimir
          </button>
        </div>

        {/* ── Filtros ── */}
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
          <span className="w-px h-4 bg-gray-200 mx-0.5" />
          <Select value={spaceId} onChange={changeSpace} ariaLabel="Espaço"
            options={[{ value: ALL, label: 'Todos os espaços' }, ...spaces.map(s => ({ value: s.id, label: s.name, color: s.color }))]} />
          <Select value={projectId} onChange={changeProject} ariaLabel="Projeto" searchable
            options={[{ value: ALL, label: 'Todos os projetos' }, ...projects.filter(p => !p.archived && (!spaceId || p.spaceId === spaceId)).map(p => ({ value: p.id, label: p.name, color: p.color }))]} />
          <Select value={assignee} onChange={changeAssignee} ariaLabel="Responsável" searchable
            options={[{ value: ALL, label: 'Todos os responsáveis' }, ...allAssignees.map(a => ({ value: a, label: a }))]} />
          {allTags.length > 0 && (
            <Select value={tag} onChange={changeTag} ariaLabel="Etiqueta" searchable
              options={[{ value: ALL, label: 'Todas as etiquetas' }, ...allTags.map(t => ({ value: t, label: t }))]} />
          )}
          {scopeActive && (
            <button onClick={clearAll} className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 transition-colors">
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 print:p-0 print:overflow-visible">

        {/* ── Resumo executivo ── */}
        <div className="hero-card px-5 py-4 print:break-inside-avoid">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-1.5">Resumo do período</p>
          <p className="text-[14px] text-gray-800 leading-relaxed">
            <strong className="font-extrabold">{doneNow.length}</strong> tarefas concluídas
            {donePrev.length > 0 && <> contra <strong className="font-semibold">{donePrev.length}</strong> no período anterior</>},
            {' '}<strong className="font-extrabold">{createdNow.length}</strong> criadas
            {createdNow.length > doneNow.length
              ? <span className="text-[#E24B4A] font-semibold"> — está entrando mais do que saindo</span>
              : createdNow.length < doneNow.length
                ? <span className="text-[#1D9E75] font-semibold"> — o backlog encolheu no período</span>
                : ' — entrada e saída empatadas'}.
            {kpis.overdue > 0 && <> Há <strong className="font-extrabold text-[#E24B4A]">{kpis.overdue}</strong> tarefas atrasadas</>}
            {kpis.stalled.length > 0 && <> e <strong className="font-extrabold">{kpis.stalled.length}</strong> paradas há mais de {STALLED_DAYS} dias</>}
            {goalsAtRisk.length > 0 && <>. <strong className="font-extrabold text-[#D89A18]">{goalsAtRisk.length}</strong> {goalsAtRisk.length === 1 ? 'meta precisa' : 'metas precisam'} de atenção</>}
            .
          </p>
          {scopeActive && (
            <p className="text-[11px] text-gray-400 mt-2">
              {periodTasks.length} de {scopedTasks.length} tarefas no recorte
              {period && dateField === 'completedAt' && ' · atraso, urgentes e carga refletem o momento atual'}
            </p>
          )}
        </div>

        {/* ── Resumo para a reunião (IA híbrida) ── */}
        <MeetingReviewCard
          periodLabel={rangeLabel}
          doneNow={doneNow} donePrevCount={donePrev.length} createdCount={createdNow.length}
          overdue={overdueTasks} urgentOpen={urgentTasks} dueSoon={dueSoonTasks}
          projects={projects}
        />

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<CheckCircle2 size={16} className="text-[#1D9E75]" />}
            label="Concluídas no período" value={doneNow.length}
            sub={`${kpis.done} concluídas no total`}
            delta={delta(doneNow.length, donePrev.length)}
            onClick={() => setDrill({ title: 'Concluídas no período', subtitle: rangeLabel, tasks: doneNow })}
          />
          <KpiCard
            icon={<TrendingUp size={16} className="text-brand-600" />}
            label="Criadas no período" value={createdNow.length}
            sub={`taxa de conclusão ${kpis.completionRate}%`}
            delta={delta(createdNow.length, createdPrev.length)} invertedDelta
            onClick={() => setDrill({ title: 'Criadas no período', subtitle: rangeLabel, tasks: createdNow })}
          />
          <KpiCard
            icon={<AlertTriangle size={16} className="text-[#E24B4A]" />}
            label="Em atraso" value={kpis.overdue} sub="prazo vencido, ainda abertas"
            onClick={() => setDrill({ title: 'Tarefas em atraso', tasks: overdueTasks })}
          />
          <KpiCard
            icon={<Zap size={16} className="text-[#D85A30]" />}
            label="Urgentes ativas" value={kpis.urgent} sub="prioridade máxima em aberto"
            onClick={() => setDrill({ title: 'Tarefas urgentes', tasks: urgentTasks })}
          />
        </div>

        {/* ── Abas ── */}
        <div className="flex items-center gap-1 border-b border-gray-200 -mt-1 print:hidden">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => changeTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors ${
                tab === id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── Fluxo e ritmo ── */}
        <div className={`space-y-5 ${tab === 'fluxo' ? '' : 'hidden print:block'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Section className="lg:col-span-2" icon={<TrendingUp size={14} className="text-gray-400" />}
            title="Fluxo de trabalho" hint={stepLabel}>
            {periodTasks.length === 0
              ? <EmptyState message="Nenhuma tarefa no recorte." hint="Ajuste o período ou os filtros acima." />
              : <ActivityChart buckets={series.buckets} />}
          </Section>

          <Section icon={<Timer size={14} className="text-gray-400" />} title="Ritmo de entrega">
            <div className="p-4 space-y-3.5">
              <Stat icon={<Hourglass size={14} className="text-brand-500" />}
                label="Tempo médio de entrega"
                value={kpis.leadTimeDays !== null ? `${kpis.leadTimeDays} dias` : '—'}
                hint="da criação até a conclusão" />
              <Stat icon={<Clock size={14} className="text-[#D89A18]" />}
                label="Idade média do backlog"
                value={kpis.backlogAgeDays !== null ? `${kpis.backlogAgeDays} dias` : '—'}
                hint="tarefas ainda abertas" />
              <button
                onClick={() => setDrill({ title: `Paradas há ${STALLED_DAYS}+ dias`, tasks: kpis.stalled })}
                className="w-full text-left rounded-lg hover:bg-gray-50 transition-colors -mx-1 px-1 py-0.5">
                <Stat icon={<PauseCircle size={14} className="text-[#E24B4A]" />}
                  label="Paradas" value={String(kpis.stalled.length)}
                  hint={`sem movimento há ${STALLED_DAYS}+ dias`} />
              </button>
            </div>
          </Section>
        </div>
        </div>

        {/* ── Progresso: metas, espaços e projetos ── */}
        <div className={`space-y-5 ${tab === 'progresso' ? '' : 'hidden print:block'}`}>
        {goals.length > 0 && (
          <Section icon={<Target size={14} className="text-gray-400" />} title="Metas do workspace"
            hint={`${goals.filter(g => goalsHealth.get(g.id)!.status === 'done').length} de ${goals.length} concluídas`}>
            <div className="divide-y divide-gray-50">
              {goals.map(g => {
                const saude = goalsHealth.get(g.id)!
                const pct   = saude.progress
                const meta  = GOAL_STATUS_META[saude.status]
                const late = g.targetDate && parseISO(g.targetDate) < now && saude.status !== 'done'
                return (
                  <div key={g.id} className="px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                      <span className="text-[12px] font-semibold text-gray-800 flex-1 truncate">{g.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${meta.color}1F`, color: meta.color }}>{meta.label}</span>
                      {g.targetDate && (
                        <span className={`text-[10px] flex-shrink-0 tabnum ${late ? 'text-[#E24B4A] font-semibold' : 'text-gray-400'}`}>
                          {fmtDate(g.targetDate)}
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-gray-600 w-9 text-right tabnum flex-shrink-0">{pct}%</span>
                    </div>
                    <MiniBar pct={pct} color={g.color} />
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Espaços e projetos ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section icon={<Layers size={14} className="text-gray-400" />} title="Por espaço">
            {spaceRows.length === 0
              ? <EmptyState message="Nenhum espaço com tarefas no recorte." />
              : <div className="divide-y divide-gray-50">
                  {spaceRows.map(r => <GroupLine key={r.key} row={r} />)}
                </div>}
          </Section>

          <Section icon={<BarChart2 size={14} className="text-gray-400" />} title="Saúde dos projetos" hint="ordenado por GUT">
            {projectHealth.length === 0
              ? <EmptyState message="Nenhum projeto com tarefas no recorte." />
              : <div className="divide-y divide-gray-50">
                  {projectHealth.map(({ project: p, total, done, overdue, urgent, progress }) => {
                    const tier = gutTier(p.gut.score)
                    return (
                      <div key={p.id} className="px-4 py-3">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                          <span className="text-[12px] font-semibold text-gray-800 flex-1 truncate">{p.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: tier.bg, color: tier.color }}>
                            GUT {p.gut.score}
                          </span>
                          <span className="text-[11px] text-gray-600 w-9 text-right tabnum font-semibold flex-shrink-0">{progress}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MiniBar pct={progress} color={p.color} />
                          <div className="flex gap-2 text-[10px] text-gray-400 flex-shrink-0 tabnum">
                            <span>{done}/{total}</span>
                            {overdue > 0 && <span className="text-[#E24B4A]">{overdue} atraso</span>}
                            {urgent > 0  && <span className="text-[#D85A30]">{urgent} urgente</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>}
          </Section>
        </div>

        </div>

        {/* ── Distribuição: prioridade, etiquetas e pessoas ── */}
        <div className={`space-y-5 ${tab === 'divisao' ? '' : 'hidden print:block'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Section icon={<Clock size={14} className="text-gray-400" />} title="Prioridade" hint="(em aberto)">
            <div className="px-4 py-4 space-y-3">
              {priorityDist.map(({ value, label, count, color, pct }) => (
                <button key={value} className="w-full text-left"
                  onClick={() => setDrill({
                    title: `Prioridade ${label}`,
                    tasks: currentTasks.filter(t => t.priority === value && t.status !== 'done' && !t.parentId),
                  })}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-600">{label}</span>
                    <span className="text-[11px] font-semibold text-gray-700 tabnum">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <MiniBar pct={pct} color={color} />
                </button>
              ))}
            </div>
          </Section>

          <Section icon={<Tag size={14} className="text-gray-400" />} title="Etiquetas" hint="top 8">
            {tagRows.length === 0
              ? <EmptyState message="Nenhuma etiqueta em uso." hint="Etiquetas ajudam a ver por categoria de trabalho." />
              : <div className="divide-y divide-gray-50">
                  {tagRows.map(r => (
                    <button key={r.key} onClick={() => setDrill({ title: `Etiqueta "${r.label}"`, tasks: currentTasks.filter(t => t.tags.includes(r.key) && !t.parentId) })}
                      className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                      <span className="text-[11px] text-gray-700 flex-1 truncate">{r.label}</span>
                      <span className="text-[10px] text-gray-400 tabnum">{r.done}/{r.total}</span>
                      <div className="w-16"><MiniBar pct={r.pct} color={r.color} /></div>
                    </button>
                  ))}
                </div>}
          </Section>

          <Section icon={<Users size={14} className="text-gray-400" />} title="Carga da equipe" hint="(em aberto)">
            {assigneeRows.length === 0
              ? <EmptyState message="Nenhuma tarefa atribuída." />
              : <div className="divide-y divide-gray-50">
                  {assigneeRows.map(r => (
                    <button key={r.key} onClick={() => setDrill({ title: r.label, tasks: currentTasks.filter(t => t.assignee === r.key && t.status !== 'done') })}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-200 to-brand-400 text-brand-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {r.label.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-800 truncate">{r.label}</p>
                        <p className="text-[10px] text-gray-400">
                          {r.total} em aberto
                          {r.overdue > 0 && <span className="text-[#E24B4A]"> · {r.overdue} atraso</span>}
                        </p>
                      </div>
                      {r.urgent > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#D85A301F] text-[#D85A30] rounded-full font-bold flex-shrink-0">{r.urgent}</span>
                      )}
                    </button>
                  ))}
                </div>}
          </Section>
        </div>

        </div>

        {/* ── Riscos: GUT, atrasadas e paradas ── */}
        <div className={`space-y-5 ${tab === 'riscos' ? '' : 'hidden print:block'}`}>
        {gutTasks.length > 0 && (
          <Section icon={<Flame size={14} className="text-gray-400" />} title="Prioridade GUT — tarefas"
            hint="maior pontuação em aberto"
            action={<span className="text-[10px] text-gray-400">clique para abrir</span>}>
            <div className="divide-y divide-gray-50">
              {gutTasks.map(t => {
                const tier = gutTier(t.gut!.score)
                const p = projects.find(pr => pr.id === t.projectId)
                return (
                  <button key={t.id} onClick={() => setDrill({ title: t.title, subtitle: p?.name, tasks: [t] })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 tabnum" style={{ background: tier.bg, color: tier.color }}>
                      {t.gut!.score}
                    </span>
                    <span className="flex-1 text-[12px] text-gray-800 truncate">{t.title}</span>
                    {p && <span className="text-[10px] text-gray-400 flex-shrink-0 truncate max-w-[130px]">{p.name}</span>}
                    <span className="text-[10px] text-gray-400 flex-shrink-0 tabnum">{fmtDate(t.dueDate)}</span>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Atrasadas ── */}
        {overdueTasks.length > 0 && (
          <Section icon={<AlertTriangle size={14} className="text-[#E24B4A]" />} title="Tarefas em atraso"
            hint={`${overdueTasks.length} no total`}>
            <div className="divide-y divide-gray-50">
              {overdueTasks.slice(0, 12).map(t => {
                const p = projects.find(pr => pr.id === t.projectId)
                const days = Math.floor((now.getTime() - parseISO(t.dueDate!).getTime()) / 86400000)
                return (
                  <button key={t.id} onClick={() => setDrill({ title: 'Tarefas em atraso', tasks: overdueTasks })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p?.color ?? '#888780' }} />
                    <span className="flex-1 text-[12px] text-gray-800 truncate">{t.title}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 truncate max-w-[130px]">{p?.name}</span>
                    <span className="text-[10px] text-[#E24B4A] flex-shrink-0 font-bold tabnum">{days}d</span>
                  </button>
                )
              })}
              {overdueTasks.length > 12 && (
                <button onClick={() => setDrill({ title: 'Tarefas em atraso', tasks: overdueTasks })}
                  className="w-full px-4 py-2.5 text-[11px] font-semibold text-brand-600 hover:bg-gray-50 transition-colors">
                  Ver todas as {overdueTasks.length}
                </button>
              )}
            </div>
          </Section>
        )}

        {gutTasks.length === 0 && overdueTasks.length === 0 && kpis.stalled.length === 0 && (
          <Section icon={<AlertTriangle size={14} className="text-gray-400" />} title="Riscos">
            <EmptyState message="Nada em risco no recorte." hint="Sem atrasos, tarefas paradas ou pontuação GUT em aberto." />
          </Section>
        )}
        </div>
      </div>

      <TaskListModal
        open={!!drill}
        title={drill?.title ?? ''}
        subtitle={drill?.subtitle}
        tasks={drill?.tasks ?? []}
        projects={projects}
        onClose={() => setDrill(null)}
      />
    </div>
  )
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-extrabold tracking-tight text-gray-900 tabnum leading-tight">{value}</p>
        <p className="text-[11px] text-gray-600 font-medium">{label}</p>
        <p className="text-[10px] text-gray-400">{hint}</p>
      </div>
    </div>
  )
}

function GroupLine({ row }: { row: { key: string; label: string; color: string; total: number; done: number; overdue: number; pct: number } }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.color }} />
      <span className="text-[12px] font-medium text-gray-800 flex-1 truncate">{row.label}</span>
      <span className="text-[10px] text-gray-400 tabnum flex-shrink-0">
        {row.done}/{row.total}
        {row.overdue > 0 && <span className="text-[#E24B4A]"> · {row.overdue} atraso</span>}
      </span>
      <div className="w-20 flex-shrink-0"><MiniBar pct={row.pct} color={row.color} /></div>
      <span className="text-[11px] font-semibold text-gray-600 w-9 text-right tabnum flex-shrink-0">{row.pct}%</span>
    </div>
  )
}
