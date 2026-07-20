import React, { useState } from 'react'
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { Select, PRIORITY_OPTIONS, STATUS_OPTIONS } from '../components/ui/Select'
import type { TriggerType, ActionType, TaskStatus, Priority } from '../types'
import { STATUS_LABEL, PRIORITY_LABEL } from '../types'

const TRIGGER_LABELS: Record<TriggerType, string> = {
  status_changed:   'Status alterado',
  priority_changed: 'Prioridade alterada',
  task_created:     'Tarefa criada',
  due_date_reached: 'Prazo chegou',
  assignee_changed: 'Responsável alterado',
}

const ACTION_LABELS: Record<ActionType, string> = {
  change_status:   'Mudar status para',
  change_priority: 'Mudar prioridade para',
  assign:          'Atribuir a',
  notify:          'Notificar',
  ai_enrich:       'IA: enriquecer tarefa',
}

export function AutomationsView() {
  const { automations: allAutomations, projects: allProjects, addAutomation, toggleAutomation, deleteAutomation, activeWorkspaceId } = useAppStore()

  const automations = allAutomations.filter(a => a.workspaceId === activeWorkspaceId)
  const projects     = allProjects.filter(p => p.workspaceId === activeWorkspaceId)

  const [form, setForm] = useState({
    name:      '',
    projectId: '*',
    trigger:   'task_created' as TriggerType,
    action:    'change_status' as ActionType,
    value:     'in_progress',
    enabled:   true,
  })

  const PRESETS = [
    { name: 'Auto: iniciar ao criar', trigger:'task_created' as TriggerType, action:'change_status' as ActionType, value:'todo' },
    { name: 'Auto: urgente → atribuir ao DJ', trigger:'priority_changed' as TriggerType, action:'assign' as ActionType, value:'DJ' },
    { name: 'Auto: concluído → notificar', trigger:'status_changed' as TriggerType, action:'notify' as ActionType, value:'Tarefa concluída!' },
  ]

  const save = () => {
    if (!form.name.trim()) return
    addAutomation({
      name:      form.name,
      projectId: form.projectId,
      trigger:   { type: form.trigger },
      action:    { type: form.action, value: form.value },
      enabled:   true,
    })
    setForm(f => ({ ...f, name: '' }))
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white">
        <Zap size={15} className="text-gray-400"/>
        <h1 className="text-sm font-semibold text-gray-900 flex-1">Automações</h1>
        <span className="text-xs text-gray-400">{automations.filter(a=>a.enabled).length} ativas</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Presets */}
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-3">Sugestões rápidas</p>
          <div className="grid grid-cols-1 gap-2">
            {PRESETS.map(p => (
              <button key={p.name} onClick={() => setForm(f => ({ ...f, name: p.name, trigger: p.trigger, action: p.action, value: p.value }))}
                className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/30 transition-colors text-left group">
                <Sparkles size={14} className="text-brand-400 flex-shrink-0"/>
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">Quando {TRIGGER_LABELS[p.trigger].toLowerCase()} → {ACTION_LABELS[p.action].toLowerCase()} {p.value}</p>
                </div>
                <span className="ml-auto text-xs text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">Usar</span>
              </button>
            ))}
          </div>
        </div>

        {/* Create form */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-700 mb-4">Nova automação</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="text-[11px] text-gray-500 block mb-1">Nome</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                placeholder="Ex: Auto-atribuir tarefas urgentes"
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"/>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Projeto</label>
              <Select value={form.projectId} onChange={v=>setForm(f=>({...f,projectId:v}))} ariaLabel="Projeto"
                options={[{ value:'*', label:'Todos os projetos' }, ...projects.filter(p=>!p.archived).map(p=>({ value:p.id, label:p.name, color:p.color }))]}/>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Quando (gatilho)</label>
              <Select value={form.trigger} onChange={v=>setForm(f=>({...f,trigger:v as TriggerType}))} ariaLabel="Gatilho"
                options={Object.entries(TRIGGER_LABELS).map(([k,v])=>({ value:k, label:v }))}/>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Ação</label>
              <Select value={form.action} onChange={v=>setForm(f=>({...f,action:v as ActionType}))} ariaLabel="Ação"
                options={Object.entries(ACTION_LABELS).map(([k,v])=>({ value:k, label:v }))}/>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Valor</label>
              {form.action==='change_status' ? (
                <Select value={form.value} onChange={v=>setForm(f=>({...f,value:v}))} options={STATUS_OPTIONS} ariaLabel="Status"/>
              ) : form.action==='change_priority' ? (
                <Select value={form.value} onChange={v=>setForm(f=>({...f,value:v}))} options={PRIORITY_OPTIONS} ariaLabel="Prioridade"/>
              ) : (
                <input value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))}
                  placeholder={form.action==='assign'?'Nome do responsável':'Mensagem...'}
                  className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none"/>
              )}
            </div>
          </div>
          <button onClick={save} disabled={!form.name.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors">
            <Plus size={12}/> Criar automação
          </button>
        </div>

        {/* List */}
        {automations.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-3">Automações ({automations.length})</p>
            <div className="space-y-2">
              {automations.map(a => (
                <div key={a.id} className={`flex items-center gap-3 px-4 py-3 bg-white border rounded-xl transition-all ${a.enabled?'border-gray-200':'border-gray-100 opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                    <p className="text-xs text-gray-400">
                      {TRIGGER_LABELS[a.trigger.type]} → {ACTION_LABELS[a.action.type]} {String(a.action.value??'')}
                    </p>
                  </div>
                  <button onClick={() => toggleAutomation(a.id)} className={`transition-colors ${a.enabled?'text-brand-600':'text-gray-300'}`}>
                    {a.enabled?<ToggleRight size={20}/>:<ToggleLeft size={20}/>}
                  </button>
                  <button onClick={() => deleteAutomation(a.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
