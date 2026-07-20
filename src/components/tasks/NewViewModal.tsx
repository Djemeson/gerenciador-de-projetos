import React, { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { DatePeriodPicker } from '../ui/DatePeriodPicker'
import { VIEW_ICON, VIEW_ICON_KEYS } from '../../lib/viewIcons'
import { Select, STATUS_OPTIONS } from '../ui/Select'
import type { DateFieldKey, DateFilterValue } from '../../types'
const BASE_TYPES: { key: 'list'|'board'|'table'|'calendar'; label: string }[] = [
  { key:'list', label:'Lista' }, { key:'board', label:'Board' },
  { key:'table', label:'Tabela' }, { key:'calendar', label:'Calendário' },
]

/**
 * Modal "Nova visualização" — genérico por escopo (funciona em Projeto, Espaço, Pasta,
 * Minhas tarefas e Todas as tarefas). O escopo ativo vem de `newViewModal` (scopeKey) no store.
 */
export function NewViewModal() {
  const { newViewModal, closeNewViewModal, addCustomView } = useAppStore()

  const [name,         setName]         = useState('')
  const [icon,         setIcon]         = useState<string>('list')
  const [baseType,     setBaseType]     = useState<'list'|'board'|'table'|'calendar'>('list')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dateField,    setDateField]    = useState<DateFieldKey>('completedAt')
  const [datePeriod,   setDatePeriod]   = useState<DateFilterValue | undefined>(undefined)

  if (!newViewModal) return null
  const scopeKey = newViewModal

  const reset = () => {
    setName(''); setIcon('list'); setBaseType('list')
    setFilterStatus('all'); setDateField('completedAt'); setDatePeriod(undefined)
  }
  const close = () => { reset(); closeNewViewModal() }

  // Atalho para o caso de uso mais comum: tarefas concluídas num período (relatório semanal).
  const applyPreset = () => {
    setName(n => n.trim() ? n : 'Concluídas no período')
    setIcon('check'); setBaseType('list'); setFilterStatus('done'); setDateField('completedAt')
  }

  const save = () => {
    if (!name.trim()) return
    addCustomView(scopeKey, {
      name: name.trim(), icon, baseType,
      filterStatus: filterStatus !== 'all' ? (filterStatus as any) : undefined,
      dateField: datePeriod ? dateField : undefined,
      datePeriod,
    })
    close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-[3px] animate-overlay-in" onClick={close}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/80 p-6 w-[440px] max-w-[92vw] max-h-[88vh] overflow-y-auto animate-scale-in" onClick={e=>e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-sm font-semibold text-gray-900">Nova visualização</h2>
          <button onClick={applyPreset}
            className="flex-shrink-0 flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-medium px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
            <CheckCircle2 size={11}/> Concluídas no período
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mb-4">Crie uma visão filtrada — ex.: tarefas concluídas na semana para a reunião de resultados.</p>

        {/* Nome */}
        <input autoFocus value={name} onChange={e=>setName(e.target.value)}
          onKeyDown={e=>e.key==='Enter' && save()}
          placeholder="Nome da visualização (ex: Concluídas no período)"
          className="w-full text-sm px-3 py-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-brand-400 transition-all mb-3"/>

        {/* Ícone */}
        <div className="mb-4">
          <label className="block text-[11px] font-medium text-gray-500 mb-2">Ícone</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {VIEW_ICON_KEYS.map(k => {
              const Icon = VIEW_ICON[k]
              const active = icon === k
              return (
                <button key={k} onClick={()=>setIcon(k)} title={k}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${active ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
                  <Icon size={16} strokeWidth={2}/>
                </button>
              )
            })}
          </div>
        </div>

        {/* Base type */}
        <div className="mb-4">
          <label className="block text-[11px] font-medium text-gray-500 mb-2">Tipo base</label>
          <div className="grid grid-cols-4 gap-1.5">
            {BASE_TYPES.map(b=>(
              <button key={b.key} onClick={()=>setBaseType(b.key)}
                className={`py-2 text-xs rounded-lg border-2 transition-all ${baseType===b.key?'border-brand-400 bg-brand-50 text-brand-700 font-medium':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="mb-4">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Filtrar por status</label>
          <Select value={filterStatus} onChange={setFilterStatus} ariaLabel="Filtrar por status"
            options={[{ value:'all', label:'Todos' }, ...STATUS_OPTIONS]}/>
        </div>

        {/* Date filter */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-medium text-gray-500">Filtrar por período</label>
            {datePeriod && (
              <button onClick={()=>setDatePeriod(undefined)} className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">Limpar</button>
            )}
          </div>
          <DatePeriodPicker
            field={dateField}
            fieldOptions={['dueDate','completedAt','createdAt']}
            onFieldChange={setDateField}
            value={datePeriod}
            onChange={setDatePeriod}
          />
        </div>

        <p className="text-[11px] text-gray-400 mb-4 mt-3">Ex: "Entrega semanal" → status: Concluído + período: Esta semana</p>

        <div className="flex gap-2">
          <button onClick={close} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={!name.trim()}
            className="flex-1 py-2.5 text-sm bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors font-medium">
            Criar visualização
          </button>
        </div>
      </div>
    </div>
  )
}
