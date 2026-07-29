import React, { useEffect, useState } from 'react'
import { X, Zap, ArrowRight, Info } from 'lucide-react'
import { Select, PRIORITY_OPTIONS, STATUS_OPTIONS } from '../ui/Select'
import { useAppStore } from '../../stores/useAppStore'
import type { Automation, AutomationAction, AutomationTrigger, ActionType, TriggerType, Priority } from '../../types'
import { ANY } from '../../types'
import { TRIGGER_LABEL, ACTION_LABEL, describeTrigger, describeAction } from '../../lib/automationEngine'

// Editor único de automação — criar e **editar**. Antes só dava para criar e excluir:
// ajustar uma regra significava apagá-la e refazer do zero.

const TRIGGERS_WITH_TO: TriggerType[] = ['status_changed', 'priority_changed', 'assignee_changed']

export interface EditorDraft {
  id?: string
  name: string
  projectId: string
  trigger: AutomationTrigger
  action: AutomationAction
}

export function AutomationEditor({ draft, onClose }: { draft: EditorDraft | null; onClose: () => void }) {
  const { projects: allProjects, activeWorkspaceId, addAutomation, updateAutomation, getAllTags, getAllAssignees } = useAppStore()
  const projects = allProjects.filter(p => p.workspaceId === activeWorkspaceId && !p.archived)

  const [form, setForm] = useState<EditorDraft | null>(draft)
  useEffect(() => setForm(draft), [draft])
  if (!form) return null

  const setTrigger = (patch: Partial<AutomationTrigger>) => setForm(f => f && ({ ...f, trigger: { ...f.trigger, ...patch } }))
  const setAction  = (patch: Partial<AutomationAction>)  => setForm(f => f && ({ ...f, action:  { ...f.action,  ...patch } }))

  const salvar = () => {
    if (!form.name.trim()) return
    if (form.id) updateAutomation(form.id, { name: form.name.trim(), projectId: form.projectId, trigger: form.trigger, action: form.action })
    else addAutomation({ name: form.name.trim(), projectId: form.projectId, trigger: form.trigger, action: form.action, enabled: true })
    onClose()
  }

  // Opções do "para" mudam conforme o gatilho — o campo é o mesmo, o vocabulário não.
  const toOptions =
    form.trigger.type === 'status_changed'   ? [{ value: ANY, label: 'Qualquer status' }, ...STATUS_OPTIONS]
  : form.trigger.type === 'priority_changed' ? [{ value: ANY, label: 'Qualquer prioridade' }, ...PRIORITY_OPTIONS]
  : form.trigger.type === 'assignee_changed' ? [{ value: ANY, label: 'Qualquer pessoa' }, ...getAllAssignees().map(a => ({ value: a, label: a }))]
  : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-overlay-in p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-w-full max-h-[88vh] flex flex-col overflow-hidden animate-scale-in"
           onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
          <Zap size={15} className="text-brand-500" />
          <h2 className="text-[14px] font-extrabold tracking-tight text-gray-900 flex-1">
            {form.id ? 'Editar automação' : 'Nova automação'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Field label="Nome">
            <input autoFocus value={form.name} onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))}
              placeholder="Ex: Urgente entra em progresso"
              className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
          </Field>

          <Field label="Onde vale">
            <Select value={form.projectId} onChange={v => setForm(f => f && ({ ...f, projectId: v }))} ariaLabel="Projeto" searchable
              options={[{ value: ANY, label: 'Todos os projetos' }, ...projects.map(p => ({ value: p.id, label: p.name, color: p.color }))]} />
          </Field>

          {/* ── Gatilho ── */}
          <div className="rounded-xl border border-gray-200/70 p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Quando</p>
            <Select value={form.trigger.type} ariaLabel="Gatilho"
              onChange={v => setTrigger({ type: v as TriggerType, from: ANY, to: ANY })}
              options={Object.entries(TRIGGER_LABEL).map(([k, l]) => ({ value: k, label: l }))} />

            {TRIGGERS_WITH_TO.includes(form.trigger.type) && (
              <Field label="Mudar para" hint="Sem isso, a regra dispara em qualquer mudança">
                <Select value={String(form.trigger.to ?? ANY)} onChange={v => setTrigger({ to: v })} options={toOptions} ariaLabel="Valor de destino" />
              </Field>
            )}

            {form.trigger.type === 'due_date_reached' && (
              <Field label="Antecedência">
                <Select value={String(form.trigger.daysBefore ?? 0)} onChange={v => setTrigger({ daysBefore: Number(v) })} ariaLabel="Antecedência"
                  options={[
                    { value: '0', label: 'No dia do prazo' },
                    { value: '1', label: '1 dia antes' },
                    { value: '2', label: '2 dias antes' },
                    { value: '3', label: '3 dias antes' },
                    { value: '7', label: '1 semana antes' },
                  ]} />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Só com a etiqueta">
                <Select value={form.trigger.tag ?? ''} onChange={v => setTrigger({ tag: v || undefined })} ariaLabel="Etiqueta" searchable
                  options={[{ value: '', label: 'Qualquer etiqueta' }, ...getAllTags().map(t => ({ value: t, label: t }))]} />
              </Field>
              <Field label="Só na prioridade">
                <Select value={form.trigger.priority ?? ''} onChange={v => setTrigger({ priority: (v || undefined) as Priority | undefined })} ariaLabel="Prioridade"
                  options={[{ value: '', label: 'Qualquer prioridade' }, ...PRIORITY_OPTIONS]} />
              </Field>
            </div>
          </div>

          {/* ── Ação ── */}
          <div className="rounded-xl border border-gray-200/70 p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Então</p>
            <Select value={form.action.type} ariaLabel="Ação"
              onChange={v => setAction({ type: v as ActionType, value: defaultValueFor(v as ActionType) })}
              options={Object.entries(ACTION_LABEL).map(([k, l]) => ({ value: k, label: l }))} />

            <ActionValue action={form.action} onChange={value => setAction({ value })}
              projects={projects.map(p => ({ value: p.id, label: p.name, color: p.color }))}
              tags={getAllTags()} assignees={getAllAssignees()} />
          </div>

          {/* Frase da regra — o usuário confere em português o que acabou de montar */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-brand-50/60 border border-brand-100">
            <Info size={13} className="text-brand-500 mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-gray-700 leading-relaxed">
              Quando <strong>{describeTrigger(form.trigger)}</strong>, {describeAction(form.action, projects)}.
            </p>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-[12.5px] font-semibold text-gray-500 hover:text-gray-700 transition-colors">
            Cancelar
          </button>
          <button onClick={salvar} disabled={!form.name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12.5px] font-bold rounded-lg transition-colors">
            {form.id ? 'Salvar' : 'Criar automação'} <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function defaultValueFor(type: ActionType): unknown {
  switch (type) {
    case 'change_status':   return 'in_progress'
    case 'change_priority': return 'urgent'
    case 'set_due_date':    return 7
    case 'notify':          return 'Atenção nesta tarefa'
    case 'add_comment':     return 'Atualizado automaticamente'
    default: return ''
  }
}

function ActionValue({ action, onChange, projects, tags, assignees }: {
  action: AutomationAction
  onChange: (v: unknown) => void
  projects: { value: string; label: string; color?: string }[]
  tags: string[]
  assignees: string[]
}) {
  const v = String(action.value ?? '')
  switch (action.type) {
    case 'change_status':
      return <Select value={v} onChange={onChange} options={STATUS_OPTIONS} ariaLabel="Status" />
    case 'change_priority':
      return <Select value={v} onChange={onChange} options={PRIORITY_OPTIONS} ariaLabel="Prioridade" />
    case 'move_project':
      return <Select value={v} onChange={onChange} options={projects} placeholder="Escolha o projeto" ariaLabel="Projeto de destino" searchable />
    case 'assign':
      return (
        <div className="space-y-2">
          {assignees.length > 0 && (
            <Select value={assignees.includes(v) ? v : ''} onChange={onChange} ariaLabel="Responsável" searchable
              options={[{ value: '', label: 'Digitar outro nome' }, ...assignees.map(a => ({ value: a, label: a }))]} />
          )}
          <input value={v} onChange={e => onChange(e.target.value)} placeholder="Nome do responsável"
            className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
        </div>
      )
    case 'add_tag':
      return (
        <div className="space-y-2">
          {tags.length > 0 && (
            <Select value={tags.includes(v) ? v : ''} onChange={onChange} ariaLabel="Etiqueta existente" searchable
              options={[{ value: '', label: 'Digitar nova etiqueta' }, ...tags.map(t => ({ value: t, label: t }))]} />
          )}
          <input value={v} onChange={e => onChange(e.target.value)} placeholder="Nome da etiqueta"
            className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
        </div>
      )
    case 'set_due_date':
      return (
        <Select value={String(action.value ?? 7)} onChange={n => onChange(Number(n))} ariaLabel="Prazo"
          options={[1, 2, 3, 5, 7, 14, 30].map(n => ({ value: String(n), label: `Daqui a ${n} dia${n > 1 ? 's' : ''}` }))} />
      )
    case 'ai_enrich':
      return <p className="text-[11.5px] text-gray-400 leading-relaxed">Usa a chave de IA das Configurações; sem chave, gera um resumo local simplificado.</p>
    default:
      return (
        <input value={v} onChange={e => onChange(e.target.value)}
          placeholder={action.type === 'notify' ? 'Texto da notificação' : 'Texto do comentário'}
          className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
      )
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}
