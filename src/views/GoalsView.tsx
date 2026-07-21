import React, { useState } from 'react'
import { Target, Plus, Trash2, Pencil, X, Check, Flag, Calendar } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { Button } from '../components/ui'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { nanoid } from '../lib/nanoid'
import {
  GOAL_STATUS_META, goalProgress, goalTargetProgress,
  type Goal, type GoalTarget, type GoalStatus, type GoalTargetType,
} from '../types'

const GOAL_COLORS = ['#6366F1','#22C55E','#F59E0B','#EC4899','#06B6D4','#8B5CF6','#E24B4A','#0F6E56']
const STATUS_OPTS = (Object.keys(GOAL_STATUS_META) as GoalStatus[]).map(s => ({ value: s, label: GOAL_STATUS_META[s].label, color: GOAL_STATUS_META[s].color }))
const TARGET_TYPE_OPTS: { value: GoalTargetType; label: string }[] = [
  { value:'number',   label:'Número' },
  { value:'currency', label:'Dinheiro (R$)' },
  { value:'percent',  label:'Percentual (%)' },
  { value:'boolean',  label:'Concluído (sim/não)' },
]

function fmtTargetValue(t: GoalTarget, v: number): string {
  if (t.type === 'currency') return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 })
  if (t.type === 'percent')  return `${v}%`
  if (t.type === 'boolean')  return v >= t.target ? 'Sim' : 'Não'
  return String(v)
}

function ProgressRing({ pct, color, size = 68 }: { pct: number; color: string; size?: number }) {
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EEF0F3" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c*pct)/100} style={{ transition:'stroke-dashoffset .5s ease' }}/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-extrabold text-gray-800 tabnum">{pct}%</span>
      </div>
    </div>
  )
}

export function GoalsView() {
  const { goals: allGoals, activeWorkspaceId, addGoal, updateGoal, deleteGoal } = useAppStore()
  const goals = allGoals.filter(g => g.workspaceId === activeWorkspaceId)
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    if (confirmDelete === id) { deleteGoal(id); setConfirmDelete(null) }
    else { setConfirmDelete(id); setTimeout(() => setConfirmDelete(c => c===id ? null : c), 3000) }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 bg-white">
        <Target size={16} className="text-gray-400"/>
        <h1 className="text-[15px] font-extrabold text-gray-900 flex-1 tracking-tight">Metas <span className="text-gray-300 font-bold">{goals.length}</span></h1>
        <Button variant="primary" size="sm" icon={<Plus size={13}/>} onClick={() => setEditing('new')}>Nova meta</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-gray-50/40">
        {goals.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Target size={22} className="text-gray-300"/>
            </div>
            <p className="text-sm font-semibold text-gray-500">Nenhuma meta ainda</p>
            <p className="text-xs text-gray-400 mt-1 mb-3">Defina objetivos mensuráveis e acompanhe o progresso.</p>
            <button onClick={() => setEditing('new')} className="text-xs text-brand-600 hover:underline">Criar a primeira meta</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl">
            {goals.map(g => {
              const pct = goalProgress(g)
              const sm = GOAL_STATUS_META[g.status]
              const overdue = g.targetDate && g.status !== 'done' && new Date(g.targetDate) < new Date()
              return (
                <div key={g.id} className="group bg-white border border-gray-200/70 rounded-2xl p-4 hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.12)] transition-all">
                  <div className="flex items-start gap-3">
                    <ProgressRing pct={pct} color={g.color}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 truncate">{g.name}</h3>
                          {g.description && <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{g.description}</p>}
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditing(g)} className="p-1 rounded-lg text-gray-300 hover:text-brand-600 hover:bg-gray-50" title="Editar"><Pencil size={12}/></button>
                          <button onClick={() => handleDelete(g.id)} className={`p-1 rounded-lg transition-colors ${confirmDelete===g.id ? 'text-white bg-red-500' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`} title="Excluir"><Trash2 size={12}/></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: sm.color+'18', color: sm.color }}>
                          <Flag size={9}/>{sm.label}
                        </span>
                        {g.targetDate && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${overdue ? 'text-red-500 bg-red-50 border-red-100' : 'text-gray-400 bg-gray-50 border-gray-100'}`}>
                            <Calendar size={9}/>{new Date(g.targetDate).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'2-digit'})}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Alvos */}
                  {g.targets.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {g.targets.map(t => {
                        const tp = goalTargetProgress(t)
                        return (
                          <div key={t.id}>
                            <div className="flex items-center justify-between text-[11px] mb-0.5">
                              <span className="font-medium text-gray-600 truncate">{t.name}</span>
                              <span className="text-gray-400 tabnum flex-shrink-0 ml-2">{fmtTargetValue(t, t.current)} / {fmtTargetValue(t, t.target)}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width:`${tp}%`, background: g.color }}/>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editing && (
        <GoalEditor
          goal={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing === 'new') addGoal(data)
            else updateGoal(editing.id, data)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function GoalEditor({ goal, onClose, onSave }: {
  goal: Goal | null
  onClose: () => void
  onSave: (data: Omit<Goal,'id'|'workspaceId'|'createdAt'|'updatedAt'>) => void
}) {
  const [name, setName] = useState(goal?.name ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [color, setColor] = useState(goal?.color ?? GOAL_COLORS[0])
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? 'on_track')
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '')
  const [targets, setTargets] = useState<GoalTarget[]>(goal?.targets ?? [])

  const addTarget = () => setTargets(p => [...p, { id: nanoid(), name:`Alvo ${p.length+1}`, type:'number', start:0, current:0, target:100 }])
  const updTarget = (id: string, patch: Partial<GoalTarget>) => setTargets(p => p.map(t => t.id===id ? {...t,...patch} : t))
  const rmTarget = (id: string) => setTargets(p => p.filter(t => t.id!==id))

  const save = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), description: description.trim(), color, status, targetDate: targetDate || null, targets })
  }

  return (
    <Modal open onClose={onClose} title={goal ? 'Editar meta' : 'Nova meta'} width="max-w-lg">
      <div className="space-y-4">
        <div>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nome da meta *"
            className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-brand-400"/>
        </div>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição (opcional)" rows={2}
          className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-brand-400 resize-none"/>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Status</label>
            <Select value={status} options={STATUS_OPTS} ariaLabel="Status" onChange={v => setStatus(v as GoalStatus)}/>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Prazo</label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"/>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Cor</label>
          <div className="flex gap-2 flex-wrap">
            {GOAL_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 border-2 border-white ring-1 ring-gray-200"
                style={{ background:c, ...(color===c ? { boxShadow:`0 0 0 2px white, 0 0 0 3.5px ${c}` } : {}) }}>
                {color===c && <Check size={13} className="text-white" strokeWidth={3}/>}
              </button>
            ))}
          </div>
        </div>

        {/* Alvos mensuráveis */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Alvos mensuráveis</label>
            <button onClick={addTarget} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors">
              <Plus size={11}/> Adicionar alvo
            </button>
          </div>
          {targets.length === 0 && <p className="text-[11px] text-gray-400">Sem alvos — o progresso será baseado no status.</p>}
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {targets.map(t => (
              <div key={t.id} className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <input value={t.name} onChange={e => updTarget(t.id, { name: e.target.value })} placeholder="Nome do alvo"
                    className="flex-1 min-w-0 text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none"/>
                  <div className="w-32 flex-shrink-0">
                    <Select value={t.type} options={TARGET_TYPE_OPTS} ariaLabel="Tipo" onChange={v => updTarget(t.id, { type: v as GoalTargetType })}/>
                  </div>
                  <button onClick={() => rmTarget(t.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0"><X size={13}/></button>
                </div>
                {t.type === 'boolean' ? (
                  <label className="flex items-center gap-2 text-[11px] text-gray-600">
                    <input type="checkbox" checked={t.current >= t.target} onChange={e => updTarget(t.id, { current: e.target.checked ? t.target : t.start, target: 1, start: 0 })}/>
                    Concluído
                  </label>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {(['start','current','target'] as const).map(field => (
                      <div key={field}>
                        <label className="block text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">{field==='start'?'Início':field==='current'?'Atual':'Alvo'}</label>
                        <input type="number" value={t[field]} onChange={e => updTarget(t.id, { [field]: Number(e.target.value) } as Partial<GoalTarget>)}
                          className="w-full text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none tabnum"/>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="default" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button variant="primary" onClick={save} className="flex-1" disabled={!name.trim()}>{goal ? 'Salvar' : 'Criar meta'}</Button>
        </div>
      </div>
    </Modal>
  )
}
