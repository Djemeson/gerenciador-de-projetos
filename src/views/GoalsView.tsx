import React, { useMemo, useState } from 'react'
import {
  Target, Plus, Trash2, Pencil, X, Check, Calendar, MoreHorizontal,
  TrendingUp, AlertTriangle, PauseCircle, CheckCircle2, ListChecks, Minus,
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { Button } from '../components/ui'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { DueDatePicker } from '../components/ui/DueDatePicker'
import { nanoid } from '../lib/nanoid'
import {
  GOAL_STATUS_META, PROJECT_COLORS,
  type Goal, type GoalTarget, type GoalStatus, type GoalTargetType, type Task,
} from '../types'
import {
  goalHealth, goalsSummary, sortGoals, targetCurrent, targetProgress,
  GOAL_IDLE_DAYS, type GoalSort,
} from '../lib/goalMetrics'

/**
 * Metas.
 *
 * Reformulado em 29/07/2026. O problema central não era visual: **o status era um campo
 * escolhido à mão que nunca se atualizava** — meta com prazo vencido e 20% feito seguia
 * exibindo "No caminho". Três decisões:
 *
 * 1. **Status derivado** de progresso × prazo (`lib/goalMetrics.ts`), com o motivo escrito
 *    no card. Só "concluída" continua sendo decisão do usuário.
 * 2. **Alvo alimentado por tarefas** (`type: 'tasks'`) — fecha o ciclo trabalho → meta, do
 *    mesmo jeito que a nota virou tarefa. Progresso que se atualiza sozinho.
 * 3. **Atualizar valor no card**, sem abrir o editor: era o gesto mais frequente e o mais
 *    caro (abrir modal, achar o alvo, salvar).
 */

const STATUS_ICON: Record<GoalStatus, React.ElementType> = {
  on_track:  TrendingUp,
  at_risk:   AlertTriangle,
  off_track: AlertTriangle,
  done:      CheckCircle2,
}

const SORT_OPTS: { value: GoalSort; label: string }[] = [
  { value: 'risk',     label: 'Risco primeiro' },
  { value: 'deadline', label: 'Prazo mais próximo' },
  { value: 'progress', label: 'Maior progresso' },
  { value: 'name',     label: 'Nome' },
]

const TARGET_TYPE_OPTS: { value: GoalTargetType; label: string }[] = [
  { value:'tasks',    label:'Tarefas concluídas' },
  { value:'number',   label:'Número' },
  { value:'currency', label:'Dinheiro (R$)' },
  { value:'percent',  label:'Percentual (%)' },
  { value:'boolean',  label:'Concluído (sim/não)' },
]

function fmtValor(t: GoalTarget, v: number): string {
  if (t.type === 'currency') return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 })
  if (t.type === 'percent')  return `${v}%`
  if (t.type === 'boolean')  return v >= t.target ? 'Sim' : 'Não'
  return String(v)
}

const fmtData = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'2-digit' })

function ProgressRing({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--gray-100)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c*pct)/100} style={{ transition:'stroke-dashoffset .5s ease' }}/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[13px] font-extrabold text-gray-800 tabnum">{pct}%</span>
      </div>
    </div>
  )
}

export function GoalsView() {
  const { goals: allGoals, tasks: allTasks, projects: allProjects, activeWorkspaceId,
          addGoal, updateGoal, deleteGoal, updateGoalTarget } = useAppStore()

  const goals    = useMemo(() => allGoals.filter(g => g.workspaceId === activeWorkspaceId), [allGoals, activeWorkspaceId])
  const tasks    = useMemo(() => allTasks.filter(t => t.workspaceId === activeWorkspaceId), [allTasks, activeWorkspaceId])
  const projects = useMemo(() => allProjects.filter(p => p.workspaceId === activeWorkspaceId && !p.archived), [allProjects, activeWorkspaceId])

  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [sort, setSort]       = useState<GoalSort>('risk')
  const [menuId, setMenuId]   = useState<string | null>(null)

  const now      = useMemo(() => new Date(), [allGoals, allTasks])
  const resumo   = useMemo(() => goalsSummary(goals, tasks, now), [goals, tasks, now])
  const ordenadas= useMemo(() => sortGoals(goals, tasks, sort, now), [goals, tasks, sort, now])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Cabeçalho ── */}
      <div className="px-6 py-3.5 border-b border-gray-200 bg-white flex items-center gap-3 flex-shrink-0">
        <Target size={16} className="text-gray-400"/>
        <h1 className="text-[20px] font-extrabold text-gray-900 tracking-tight flex-1">Metas</h1>
        {goals.length > 1 && (
          <Select value={sort} onChange={v => setSort(v as GoalSort)} options={SORT_OPTS} ariaLabel="Ordenar metas"/>
        )}
        <Button variant="primary" size="sm" icon={<Plus size={14}/>} onClick={() => setEditing('new')}>Nova meta</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {goals.length === 0 ? (
          <VazioMetas onCriar={() => setEditing('new')}/>
        ) : (
          <>
            {/* ── Resumo ── o painel não dizia como o conjunto estava indo */}
            <div className="bg-gradient-to-br from-[#F7F8FF] to-white border border-brand-100 rounded-xl px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-1.5">Como estão as metas</p>
              <p className="text-[14px] text-gray-800 leading-relaxed">
                <strong className="font-extrabold">{resumo.avgProgress}%</strong> de progresso médio em{' '}
                {resumo.total} {resumo.total === 1 ? 'meta' : 'metas'}
                {resumo.done > 0 && <> · <strong className="font-semibold">{resumo.done}</strong> concluída{resumo.done > 1 ? 's' : ''}</>}
                {(resumo.atRisk + resumo.offTrack) > 0
                  ? <> · <strong className="font-extrabold text-danger-600">{resumo.atRisk + resumo.offTrack}</strong> {(resumo.atRisk + resumo.offTrack) === 1 ? 'precisa' : 'precisam'} de atenção</>
                  : <> · <span className="text-success-600 font-semibold">nenhuma em risco</span></>}
                {resumo.idle > 0 && <> · <strong className="font-extrabold">{resumo.idle}</strong> sem atualização há mais de {GOAL_IDLE_DAYS} dias</>}
                .
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {ordenadas.map(g => (
                <CardMeta
                  key={g.id} goal={g} tasks={tasks} projects={projects} now={now}
                  menuAberto={menuId === g.id}
                  onMenu={() => setMenuId(menuId === g.id ? null : g.id)}
                  onFecharMenu={() => setMenuId(null)}
                  onEditar={() => { setMenuId(null); setEditing(g) }}
                  onExcluir={() => { setMenuId(null); deleteGoal(g.id) }}
                  onConcluir={() => { setMenuId(null); updateGoal(g.id, { status: g.status === 'done' ? 'on_track' : 'done' }) }}
                  onAlvo={(targetId, patch) => updateGoalTarget(g.id, targetId, patch)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {editing && (
        <GoalEditor
          goal={editing === 'new' ? null : editing}
          projects={projects}
          tags={[...new Set(tasks.flatMap(t => t.tags))].filter(Boolean).sort()}
          onClose={() => setEditing(null)}
          onSave={data => {
            if (editing === 'new') addGoal(data)
            else updateGoal(editing.id, data)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function CardMeta({ goal: g, tasks, projects, now, menuAberto, onMenu, onFecharMenu, onEditar, onExcluir, onConcluir, onAlvo }: {
  goal: Goal
  tasks: Task[]
  projects: { id: string; name: string; color: string }[]
  now: Date
  menuAberto: boolean
  onMenu: () => void; onFecharMenu: () => void
  onEditar: () => void; onExcluir: () => void; onConcluir: () => void
  onAlvo: (targetId: string, patch: Partial<GoalTarget>) => void
}) {
  const saude = goalHealth(g, tasks, now)
  const meta  = GOAL_STATUS_META[saude.status]
  const Icon  = STATUS_ICON[saude.status]
  const parada = saude.status !== 'done' && saude.idleDays >= GOAL_IDLE_DAYS

  return (
    <div className="bg-white border border-gray-200/70 rounded-2xl p-4">
      <div className="flex items-start gap-3.5">
        <ProgressRing pct={saude.progress} color={g.color}/>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="text-[13px] font-bold text-gray-900 flex-1 min-w-0 truncate">{g.name}</h3>
            <div className="relative flex-shrink-0">
              <button onClick={onMenu} title="Mais ações"
                className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <MoreHorizontal size={14}/>
              </button>
              {menuAberto && (
                <>
                  <div className="fixed inset-0 z-40" onClick={onFecharMenu}/>
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 animate-scale-in">
                    <ItemMenu icon={Pencil} label="Editar meta" onClick={onEditar}/>
                    <ItemMenu icon={g.status === 'done' ? Minus : CheckCircle2}
                      label={g.status === 'done' ? 'Reabrir meta' : 'Marcar como concluída'} onClick={onConcluir}/>
                    <ItemMenu icon={Trash2} label="Excluir meta" danger onClick={onExcluir}/>
                  </div>
                </>
              )}
            </div>
          </div>

          {g.description && <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">{g.description}</p>}

          {/* Status derivado + o porquê. Antes era só uma pílula escolhida à mão. */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: meta.color+'1F', color: meta.color }}>
              <Icon size={12}/>{meta.label}
            </span>
            {g.targetDate && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                saude.daysLeft !== null && saude.daysLeft < 0
                  ? 'text-danger-700 bg-danger-50 border-danger-100'
                  : 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                <Calendar size={12}/>{fmtData(g.targetDate)}
                {saude.daysLeft !== null && saude.daysLeft >= 0 && <span className="tabnum">· {saude.daysLeft}d</span>}
              </span>
            )}
            {parada && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning-50 text-warning-700 border border-warning-100">
                <PauseCircle size={12}/> parada
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">{saude.reason}</p>
        </div>
      </div>

      {/* ── Alvos, editáveis no lugar ── */}
      {Array.isArray(g.targets) && g.targets.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2.5">
          {g.targets.map(t => (
            <LinhaAlvo key={t.id} target={t} tasks={tasks} projects={projects} color={g.color}
              onChange={patch => onAlvo(t.id, patch)}/>
          ))}
        </div>
      )}
    </div>
  )
}

function LinhaAlvo({ target: t, tasks, projects, color, onChange }: {
  target: GoalTarget
  tasks: Task[]
  projects: { id: string; name: string; color: string }[]
  color: string
  onChange: (patch: Partial<GoalTarget>) => void
}) {
  const atual = targetCurrent(t, tasks)
  const pct   = targetProgress(t, tasks)
  const auto  = t.type === 'tasks'
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState(String(atual))

  const salvar = () => { const n = Number(rascunho); if (!Number.isNaN(n)) onChange({ current: n }); setEditando(false) }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
        <span className="font-medium text-gray-700 truncate flex items-center gap-1.5 min-w-0">
          {auto && (
            <span title="Contado das tarefas concluídas" className="flex-shrink-0 flex">
              <ListChecks size={12} className="text-brand-500"/>
            </span>
          )}
          <span className="truncate">{t.name}</span>
        </span>

        {/* Booleano alterna no clique; número edita no lugar; `tasks` é automático. */}
        {t.type === 'boolean' ? (
          <button onClick={() => onChange({ current: atual >= t.target ? 0 : (t.target || 1), target: t.target || 1 })}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 ${
              atual >= t.target ? 'bg-success-50 text-success-700 border-success-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {atual >= t.target ? 'Concluído' : 'Marcar'}
          </button>
        ) : editando ? (
          <span className="flex items-center gap-1 flex-shrink-0">
            <input autoFocus type="number" value={rascunho} onChange={e => setRascunho(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false) }}
              onBlur={salvar}
              className="w-16 text-[11px] px-1.5 py-0.5 border border-brand-300 rounded outline-none tabnum text-right"/>
            <span className="text-gray-500 tabnum">/ {fmtValor(t, t.target)}</span>
          </span>
        ) : (
          <button
            onClick={() => { if (!auto) { setRascunho(String(atual)); setEditando(true) } }}
            title={auto ? `Contado das tarefas concluídas${t.projectId ? ` de ${projects.find(p => p.id === t.projectId)?.name ?? 'projeto'}` : ''}` : 'Clique para atualizar'}
            className={`text-gray-600 tabnum flex-shrink-0 px-1 rounded ${auto ? 'cursor-default' : 'hover:bg-gray-100 hover:text-gray-900'}`}>
            <span className="font-semibold">{fmtValor(t, atual)}</span>
            <span className="text-gray-500"> / {fmtValor(t, t.target)}</span>
          </button>
        )}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background: color }}/>
      </div>
    </div>
  )
}

function ItemMenu({ icon: Icon, label, onClick, danger }: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors ${danger ? 'text-danger-600 hover:bg-danger-50' : 'text-gray-700 hover:bg-gray-50'}`}>
      <Icon size={14} className={danger ? '' : 'text-gray-400'}/> {label}
    </button>
  )
}

function VazioMetas({ onCriar }: { onCriar: () => void }) {
  return (
    <div className="bg-white border border-gray-200/70 rounded-xl px-6 py-12 text-center max-w-2xl mx-auto">
      <div className="w-11 h-11 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-3">
        <Target size={18} className="text-brand-500"/>
      </div>
      <p className="text-[13px] font-bold text-gray-800">Nenhuma meta ainda</p>
      <p className="text-[11px] text-gray-500 mt-1 max-w-[420px] mx-auto leading-relaxed">
        Meta é o resultado que você quer, não a lista do que fazer. Defina o alvo em número
        — chamados, clientes, receita — ou ligue a um projeto para o progresso ser contado
        das tarefas concluídas, sem você atualizar nada.
      </p>
      <button onClick={onCriar}
        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-bold rounded-lg transition-colors">
        <Plus size={14}/> Criar a primeira meta
      </button>
    </div>
  )
}

// ── Editor ───────────────────────────────────────────────────────────────────

function GoalEditor({ goal, projects, tags, onClose, onSave }: {
  goal: Goal | null
  projects: { id: string; name: string; color: string }[]
  tags: string[]
  onClose: () => void
  onSave: (data: Omit<Goal,'id'|'workspaceId'|'createdAt'|'updatedAt'>) => void
}) {
  const [name, setName] = useState(goal?.name ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [color, setColor] = useState(goal?.color ?? PROJECT_COLORS[0])
  const [targetDate, setTargetDate] = useState<string | null>(goal?.targetDate ?? null)
  const [targets, setTargets] = useState<GoalTarget[]>(Array.isArray(goal?.targets) ? goal!.targets : [])

  const addTarget = () => setTargets(p => [...p, {
    id: nanoid(), name: '', type: 'tasks', start: 0, current: 0, target: 10,
    projectId: null, tag: null, updatedAt: new Date().toISOString(),
  }])
  const updTarget = (id: string, patch: Partial<GoalTarget>) => setTargets(p => p.map(t => t.id===id ? {...t,...patch} : t))
  const rmTarget  = (id: string) => setTargets(p => p.filter(t => t.id!==id))

  const save = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(), description: description.trim(), color,
      // O status não é mais escolhido aqui: ele é derivado de progresso × prazo. O editor
      // preserva "concluída" quando o usuário já tinha marcado.
      status: goal?.status === 'done' ? 'done' : 'on_track',
      targetDate: targetDate || null,
      targets: targets.map(t => ({ ...t, name: t.name.trim() || nomePadrao(t, projects) })),
    })
  }

  return (
    <Modal open onClose={onClose} title={goal ? 'Editar meta' : 'Nova meta'} width="max-w-lg">
      <div className="space-y-4">
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="O que você quer alcançar?"
          className="w-full text-[13px] px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-brand-400"/>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhe (opcional)" rows={2}
          className="w-full text-[12px] px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-brand-400 resize-none"/>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Prazo</label>
            {/* DueDatePicker no lugar do input date nativo (seção 4.3 das diretrizes) */}
            <div className="border border-gray-200 rounded-lg px-2.5 py-1.5">
              <DueDatePicker value={targetDate} onChange={setTargetDate} variant="row"/>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Cor</label>
            <div className="flex gap-1.5 flex-wrap">
              {/* PROJECT_COLORS: a paleta de entidades do app. A lista antiga tinha cores
                  próprias (#22C55E, #F59E0B, #06B6D4) fora do sistema. */}
              {PROJECT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} title={c}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ background:c, ...(color===c ? { boxShadow:`0 0 0 2px white, 0 0 0 3.5px ${c}` } : {}) }}>
                  {color===c && <Check size={12} className="text-white" strokeWidth={3}/>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Como medir</label>
            <button onClick={addTarget} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors">
              <Plus size={12}/> Adicionar medida
            </button>
          </div>
          {targets.length === 0 && (
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Sem medida, a meta só tem "concluída ou não". Uma medida — tarefas, número,
              dinheiro — é o que faz o progresso existir.
            </p>
          )}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {targets.map(t => (
              <div key={t.id} className="p-2.5 bg-gray-50 border border-gray-200/70 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <input value={t.name} onChange={e => updTarget(t.id, { name: e.target.value })}
                    placeholder={nomePadrao(t, projects)}
                    className="flex-1 min-w-0 text-[12px] px-2 py-1 border border-gray-200 rounded-lg outline-none bg-white"/>
                  <div className="w-36 flex-shrink-0">
                    <Select value={t.type} options={TARGET_TYPE_OPTS} ariaLabel="Tipo de medida"
                      onChange={v => updTarget(t.id, { type: v as GoalTargetType })}/>
                  </div>
                  <button onClick={() => rmTarget(t.id)} title="Remover medida"
                    className="text-gray-400 hover:text-danger-600 flex-shrink-0"><X size={14}/></button>
                </div>

                {t.type === 'tasks' ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={t.projectId ?? ''} ariaLabel="Projeto" searchable
                        onChange={v => updTarget(t.id, { projectId: v || null })}
                        options={[{ value:'', label:'Todos os projetos' }, ...projects.map(p => ({ value:p.id, label:p.name, color:p.color }))]}/>
                      <Select value={t.tag ?? ''} ariaLabel="Etiqueta" searchable
                        onChange={v => updTarget(t.id, { tag: v || null })}
                        options={[{ value:'', label:'Qualquer etiqueta' }, ...tags.map(x => ({ value:x, label:x }))]}/>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Alvo</label>
                      <input type="number" value={t.target} onChange={e => updTarget(t.id, { target: Number(e.target.value) })}
                        className="w-20 text-[12px] px-2 py-1 border border-gray-200 rounded-lg outline-none tabnum bg-white"/>
                      <span className="text-[10.5px] text-gray-500">tarefas concluídas</span>
                    </div>
                  </div>
                ) : t.type === 'boolean' ? (
                  <p className="text-[10.5px] text-gray-500">Marcada como feita ou não feita, direto no card.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {(['start','current','target'] as const).map(campo => (
                      <div key={campo}>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">
                          {campo==='start' ? 'Início' : campo==='current' ? 'Atual' : 'Alvo'}
                        </label>
                        <input type="number" value={t[campo]} onChange={e => updTarget(t.id, { [campo]: Number(e.target.value) } as Partial<GoalTarget>)}
                          className="w-full text-[12px] px-2 py-1 border border-gray-200 rounded-lg outline-none tabnum bg-white"/>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10.5px] text-gray-500 leading-relaxed">
          O andamento (no caminho, em risco, atrasada) é calculado a partir do progresso e
          do prazo — não precisa manter à mão.
        </p>

        <div className="flex gap-2 pt-1">
          <Button variant="default" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button variant="primary" onClick={save} className="flex-1" disabled={!name.trim()}>{goal ? 'Salvar' : 'Criar meta'}</Button>
        </div>
      </div>
    </Modal>
  )
}

/** Nome sugerido da medida — "Alvo 1"/"Alvo 2" obrigava a renomear tudo para entender. */
function nomePadrao(t: GoalTarget, projects: { id: string; name: string }[]): string {
  if (t.type === 'tasks') {
    const p = t.projectId ? projects.find(x => x.id === t.projectId)?.name : null
    return p ? `Tarefas de ${p}` : 'Tarefas concluídas'
  }
  return { number:'Quantidade', currency:'Valor', percent:'Percentual', boolean:'Feito', tasks:'Tarefas' }[t.type]
}
