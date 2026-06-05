import React, { useState } from 'react'
import { X, Trash2, Plus, Check, ChevronLeft, GripVertical } from 'lucide-react'
import { Modal } from './ui/Modal'
import { useAppStore } from '../stores/useAppStore'
import type { ColumnType, DropdownOption } from '../types'
import { nanoid } from '../lib/nanoid'

const OPTION_COLORS = [
  '#E24B4A','#D85A30','#BA7517','#639922',
  '#1D9E75','#378ADD','#6B5EE8','#D4537E',
  '#888780','#0F6E56',
]

interface TypeCard { type: ColumnType; label: string; desc: string; icon: string; color: string; bg: string }

const COLUMN_TYPES: TypeCard[] = [
  { type:'text',     label:'Texto',          desc:'Notas, links, texto livre',         icon:'Aa', color:'#185FA5', bg:'#E6F1FB' },
  { type:'number',   label:'Número',         desc:'Inteiro ou decimal',                icon:'#',  color:'#0F6E56', bg:'#E1F5EE' },
  { type:'date',     label:'Data',           desc:'Calendário com seletor',            icon:'📅', color:'#854F0B', bg:'#FAEEDA' },
  { type:'dropdown', label:'Lista suspensa', desc:'Opções com cores personalizadas',   icon:'▾',  color:'#534AB7', bg:'#EEEDFE' },
  { type:'checkbox', label:'Caixa',          desc:'Sim / Não, marcado / desmarcado',   icon:'☑',  color:'#993C1D', bg:'#FAECE7' },
  { type:'money',    label:'Dinheiro',       desc:'Valor monetário (R$)',              icon:'R$', color:'#0F6E56', bg:'#E1F5EE' },
  { type:'url',      label:'Link',           desc:'URL clicável',                      icon:'🔗', color:'#185FA5', bg:'#E6F1FB' },
]

type Step = 'pick' | 'configure'

export function ColumnsModal() {
  const { columnsModal, closeColumnsModal, projects, addColumn, deleteColumn, updateColumn } = useAppStore()
  const project = projects.find(p => p.id === columnsModal)

  const [step,       setStep]       = useState<Step>('pick')
  const [selType,    setSelType]    = useState<TypeCard | null>(null)
  const [name,       setName]       = useState('')
  const [opts,       setOpts]       = useState<DropdownOption[]>([
    { id: nanoid(), label: 'Opção 1', color: OPTION_COLORS[0] },
    { id: nanoid(), label: 'Opção 2', color: OPTION_COLORS[5] },
  ])
  const [colorPicker, setColorPicker] = useState<string | null>(null)  // optId being edited
  const [editingCol,  setEditingCol]  = useState<string | null>(null)

  const reset = () => {
    setStep('pick'); setSelType(null); setName('')
    setOpts([{ id:nanoid(), label:'Opção 1', color:OPTION_COLORS[0] },{ id:nanoid(), label:'Opção 2', color:OPTION_COLORS[5] }])
    setColorPicker(null); setEditingCol(null)
  }

  if (!columnsModal || !project) return null

  const save = () => {
    if (!name.trim() || !selType) return
    addColumn(project.id, {
      name: name.trim(), type: selType.type, projectId: project.id,
      dropdownOptions: selType.type === 'dropdown' ? opts : [],
      width: selType.type === 'checkbox' ? 80 : selType.type === 'text' ? 140 : 100,
    })
    reset()
  }

  const addOpt = () => {
    setOpts(p => [...p, { id:nanoid(), label:`Opção ${p.length+1}`, color: OPTION_COLORS[p.length % OPTION_COLORS.length] }])
  }
  const updateOpt = (id: string, patch: Partial<DropdownOption>) =>
    setOpts(p => p.map(o => o.id===id ? {...o,...patch} : o))
  const removeOpt = (id: string) => setOpts(p => p.filter(o => o.id!==id))

  return (
    <Modal open={!!columnsModal} onClose={() => { reset(); closeColumnsModal() }} title="" width="max-w-lg">
      {step === 'pick' ? (
        /* ── Step 1: escolher tipo ─────────────────────────────────────── */
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Adicionar campo</h2>
          <p className="text-xs text-gray-400 mb-4">Escolha o tipo para a nova coluna</p>

          <div className="grid grid-cols-2 gap-2 mb-5">
            {COLUMN_TYPES.map(t => (
              <button key={t.type} onClick={() => { setSelType(t); setStep('configure') }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-transparent bg-gray-50 hover:border-brand-200 hover:bg-brand-50/30 text-left transition-all group cursor-pointer">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: t.bg, color: t.color }}>
                  {t.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 group-hover:text-brand-700">{t.label}</p>
                  <p className="text-[10px] text-gray-400 leading-snug mt-0.5 truncate">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {project.columns.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Campos existentes</p>
              <div className="space-y-1.5">
                {project.columns.map(col => {
                  const tc = COLUMN_TYPES.find(t => t.type === col.type)
                  return (
                    <div key={col.id} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-xl group border border-transparent hover:border-gray-200 transition-all">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: tc?.bg, color: tc?.color }}>
                        {tc?.icon ?? '?'}
                      </div>
                      {editingCol === col.id ? (
                        <input autoFocus defaultValue={col.name}
                          onBlur={e => { updateColumn(project.id, col.id, { name: e.target.value }); setEditingCol(null) }}
                          onKeyDown={e => { if (e.key==='Enter')(e.target as HTMLInputElement).blur(); if(e.key==='Escape')setEditingCol(null) }}
                          className="flex-1 text-xs px-2 py-0.5 border border-brand-300 rounded-lg outline-none"/>
                      ) : (
                        <div className="flex-1 min-w-0" onDoubleClick={() => setEditingCol(col.id)}>
                          <span className="text-xs text-gray-800 font-medium">{col.name}</span>
                          <span className="text-[10px] text-gray-400 ml-1.5">{tc?.label}</span>
                        </div>
                      )}
                      {col.type==='dropdown' && col.dropdownOptions?.length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {col.dropdownOptions.slice(0,5).map(o => (
                            <span key={o.id} className="w-3 h-3 rounded-full" style={{ background: o.color }} title={o.label}/>
                          ))}
                          {col.dropdownOptions.length > 5 && <span className="text-[9px] text-gray-400">+{col.dropdownOptions.length-5}</span>}
                        </div>
                      )}
                      <button onClick={() => deleteColumn(project.id, col.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Step 2: configurar ────────────────────────────────────────── */
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setStep('pick')} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <ChevronLeft size={15}/>
            </button>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: selType?.bg, color: selType?.color }}>
              {selType?.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{selType?.label}</p>
              <p className="text-[11px] text-gray-400">{selType?.desc}</p>
            </div>
          </div>

          {/* Nome */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome do campo *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key==='Enter' && save()}
              placeholder={
                selType?.type==='dropdown' ? 'Ex: Fase, Status, Categoria' :
                selType?.type==='number'   ? 'Ex: Estimativa, Pontos de esforço' :
                selType?.type==='money'    ? 'Ex: Orçamento, Custo' :
                selType?.type==='date'     ? 'Ex: Data de início, Revisão' :
                'Ex: Observações, Sprint'
              }
              className="w-full text-sm px-3 py-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-brand-400 transition-all"/>
          </div>

          {/* Dropdown options */}
          {selType?.type === 'dropdown' && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Opções da lista</label>
                <button onClick={addOpt} className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors">
                  <Plus size={11}/> Adicionar opção
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {opts.map((opt, idx) => (
                  <div key={opt.id} className="group">
                    <div className="flex items-center gap-2">
                      <GripVertical size={13} className="text-gray-200 flex-shrink-0"/>

                      {/* Color button */}
                      <button
                        onClick={() => setColorPicker(colorPicker===opt.id ? null : opt.id)}
                        className="w-6 h-6 rounded-full border-2 border-white shadow ring-1 ring-gray-200 hover:ring-gray-400 hover:scale-110 transition-all flex-shrink-0"
                        style={{ background: opt.color }}
                        title="Clique para trocar a cor"
                      />

                      {/* Preview badge */}
                      <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ background: opt.color + '25', color: opt.color }}>
                        {opt.label || `Opção ${idx+1}`}
                      </span>

                      {/* Name input */}
                      <input value={opt.label} onChange={e => updateOpt(opt.id, { label: e.target.value })}
                        className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none focus:border-brand-300 transition-all min-w-0"
                        placeholder={`Opção ${idx+1}`}/>

                      <button onClick={() => removeOpt(opt.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                        <X size={12}/>
                      </button>
                    </div>

                    {/* Color picker — expands inline */}
                    {colorPicker === opt.id && (
                      <div className="mt-2 ml-8 flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        {OPTION_COLORS.map(c => (
                          <button key={c} onClick={() => { updateOpt(opt.id, { color: c }); setColorPicker(null) }}
                            className={`w-7 h-7 rounded-full hover:scale-110 transition-all border-2 ${opt.color===c?'border-gray-700 scale-110':'border-white shadow-sm'}`}
                            style={{ background: c }}/>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={reset} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={save} disabled={!name.trim()}
              className="flex-1 py-2.5 text-sm bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors font-medium flex items-center justify-center gap-1.5">
              <Check size={14}/> Criar campo
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
