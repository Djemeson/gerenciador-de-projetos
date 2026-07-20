import React, { useState } from 'react'
import { X, Trash2, Plus, Check, ChevronLeft, GripVertical, Search, Sparkles, SlidersHorizontal, Layers } from 'lucide-react'
import { Modal } from './ui/Modal'
import { useAppStore } from '../stores/useAppStore'
import type { ColumnType, DropdownOption } from '../types'
import { INBOX_PROJECT_ID } from '../types'
import { FIELD_TYPE_ICON } from '../lib/fieldTypeIcons'
import { nanoid } from '../lib/nanoid'
import {
  EXTRA_SYSTEM, BASE_SYSTEM_TOGGLEABLE,
  loadHidden, loadExtra, toggleColumnHidden, toggleExtraColumn,
} from '../lib/taskColumns'

const OPTION_COLORS = [
  '#E24B4A','#D85A30','#BA7517','#639922',
  '#1D9E75','#378ADD','#6366F1','#D4537E',
  '#888780','#0F6E56',
]

interface TypeCard { type: ColumnType; label: string; desc: string; color: string; ai?: boolean }

// Uma cor ÚNICA por tipo (nenhuma repetida) — mesma paleta viva usada nos
// ícones de espaços/pastas/projetos (ver SWATCH_COLORS em lib/sidebarIcons.ts),
// para ficar visualmente no mesmo padrão "premium" do resto do app. O fundo do
// selo nunca é escolhido à mão: é sempre a própria cor com baixa opacidade
// (fórmula única, ver `tint()` abaixo) — o mesmo truque já usado nos badges de
// prioridade/GUT do app.
function tint(hex: string): string { return hex + '17' }

// Agrupado em categorias (em vez de uma grade única) para dar estrutura e
// facilitar achar o tipo certo — "design reestruturado" em vez de lista plana.
const COLUMN_CATEGORIES: { label: string; types: TypeCard[] }[] = [
  {
    label: 'Texto & Números',
    types: [
      { type:'text',     label:'Texto',          desc:'Notas, links, texto livre',        color:'#378ADD' },
      { type:'longtext', label:'Área de texto',  desc:'Texto longo (notas, observações)', color:'#14B8A6' },
      { type:'number',   label:'Número',         desc:'Inteiro ou decimal',               color:'#06B6D4' },
      { type:'money',    label:'Dinheiro',       desc:'Valor monetário (R$)',              color:'#22C55E' },
    ],
  },
  {
    label: 'Seleção & Datas',
    types: [
      { type:'dropdown', label:'Lista suspensa', desc:'Opções com cores personalizadas',  color:'#6366F1' },
      { type:'labels',   label:'Rótulos',        desc:'Seleção múltipla com cores',        color:'#EC4899' },
      { type:'checkbox', label:'Caixa',          desc:'Sim / Não, marcado / desmarcado',  color:'#10B981' },
      { type:'date',     label:'Data',           desc:'Calendário com seletor',            color:'#F59E0B' },
      { type:'rating',   label:'Avaliação',      desc:'Nota de 1 a 5 estrelas',             color:'#EAB308' },
    ],
  },
  {
    label: 'Contato & Links',
    types: [
      { type:'people',   label:'Pessoas',  desc:'Responsáveis ou envolvidos',   color:'#8B5CF6' },
      { type:'email',    label:'E-mail',   desc:'Endereço de e-mail clicável',  color:'#F97316' },
      { type:'phone',    label:'Telefone', desc:'Número de telefone clicável',  color:'#84CC16' },
      { type:'url',      label:'Link',     desc:'URL clicável',                 color:'#A855F7' },
      { type:'website',  label:'Site',     desc:'Endereço de site clicável',    color:'#F43F5E' },
    ],
  },
]
const COLUMN_TYPES: TypeCard[] = COLUMN_CATEGORIES.flatMap(c => c.types)

// Campos gerados por IA — separados numa seção própria, com destaque visual
// gradiente (estilo Gemini). Adicionar um novo aqui + em `isAIColumnType`/
// `AI_COLUMN_TYPES` (types/index.ts) para herdar o mesmo tratamento visual.
const AI_COLUMN_TYPES: TypeCard[] = [
  { type:'ai_summary', label:'Resumo de conclusão', desc:'Gera automaticamente um resumo do que foi feito (subtarefas, checklists) ao concluir a tarefa — pronto para reunião de resultados.', color:'#6B4FBB', ai:true },
]

type Step = 'pick' | 'configure'
type Tab  = 'create' | 'existing'

export function ColumnsModal() {
  const { columnsModal, columnsModalScope, closeColumnsModal, projects, inboxColumns, addColumn, deleteColumn, updateColumn, bumpColumnsVersion } = useAppStore()
  const isInbox  = columnsModal === INBOX_PROJECT_ID
  const project  = projects.find(p => p.id === columnsModal)
  const targetId = columnsModal ?? ''
  const scope    = columnsModalScope ?? targetId
  const cols     = isInbox ? inboxColumns : (project?.columns ?? [])

  const [tab,        setTab]        = useState<Tab>('create')
  const [step,       setStep]       = useState<Step>('pick')
  const [selType,    setSelType]    = useState<TypeCard | null>(null)
  const [name,       setName]       = useState('')
  const [opts,       setOpts]       = useState<DropdownOption[]>([
    { id: nanoid(), label: 'Opção 1', color: OPTION_COLORS[0] },
    { id: nanoid(), label: 'Opção 2', color: OPTION_COLORS[5] },
  ])
  const [colorPicker, setColorPicker] = useState<string | null>(null)  // optId sendo editado
  const [editingCol,  setEditingCol]  = useState<string | null>(null)
  const [search,      setSearch]      = useState('')
  const [refreshTick, setRefreshTick] = useState(0)   // força reler localStorage após toggles

  const reset = () => {
    setTab('create'); setStep('pick'); setSelType(null); setName(''); setSearch('')
    setOpts([{ id:nanoid(), label:'Opção 1', color:OPTION_COLORS[0] },{ id:nanoid(), label:'Opção 2', color:OPTION_COLORS[5] }])
    setColorPicker(null); setEditingCol(null)
  }

  if (!columnsModal || (!project && !isInbox)) return null

  const save = () => {
    if (!name.trim() || !selType) return
    addColumn(targetId, {
      name: name.trim(), type: selType.type, projectId: targetId,
      dropdownOptions: (selType.type === 'dropdown' || selType.type === 'labels') ? opts : [],
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

  // ── Estado de visibilidade (aba "Adicionar um existente") ─────────────────
  const hidden = loadHidden(scope)
  const extra  = loadExtra(scope)
  const toggleHiddenAndRefresh = (key: string) => { toggleColumnHidden(scope, key); bumpColumnsVersion(); setRefreshTick(t=>t+1) }
  const toggleExtraAndRefresh  = (key: string) => { toggleExtraColumn(scope, key); bumpColumnsVersion(); setRefreshTick(t=>t+1) }
  void refreshTick // (garante recomputo do JSX abaixo a cada toggle — leitura é sempre direta do localStorage)

  const filterBySearch = (label: string) => !search.trim() || label.toLowerCase().includes(search.toLowerCase())

  const typeCardOf = (t: ColumnType) => COLUMN_TYPES.find(c => c.type === t) ?? AI_COLUMN_TYPES.find(c => c.type === t)

  return (
    <Modal open={!!columnsModal} onClose={() => { reset(); closeColumnsModal() }} title="" width="max-w-lg">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
          <SlidersHorizontal size={16}/>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-900">Campos personalizados</h2>
          <p className="text-[11px] text-gray-400">Crie novos campos ou reative campos já existentes nesta lista.</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 mb-4">
        <button onClick={() => setTab('create')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors ${tab==='create' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Plus size={12}/> Criar novo
        </button>
        <button onClick={() => setTab('existing')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors ${tab==='existing' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Layers size={12}/> Adicionar existente
        </button>
      </div>

      <div className="max-h-[65vh] overflow-y-auto pr-1">
        {tab === 'create' ? (
          step === 'pick' ? (
            /* ── Passo 1: escolher tipo ────────────────────────────────── */
            <div className="space-y-5">
              {/* Campos com IA — seção própria, com destaque gradiente estilo Gemini */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={11} className="ai-gradient-text flex-shrink-0"/>
                  <p className="text-[10px] font-bold ai-gradient-text uppercase tracking-wider">Campos com IA</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {AI_COLUMN_TYPES.map(t => {
                    const Icon = FIELD_TYPE_ICON[t.type]
                    return (
                      <button key={t.type} onClick={() => { setSelType(t); setStep('configure') }}
                        className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent bg-white hover:shadow-sm text-left transition-all group cursor-pointer"
                        style={{ boxShadow: '0 0 0 1.5px rgba(155,114,203,0.35)' }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ai-gradient-bg text-white shadow-xs">
                          <Icon size={18} strokeWidth={2}/>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-gray-800 flex items-center gap-1.5">
                            {t.label}
                            <span className="text-[9px] font-bold uppercase tracking-wide ai-gradient-bg text-white px-1.5 py-[1px] rounded-full">IA</span>
                          </p>
                          <p className="text-[10.5px] text-gray-400 leading-snug mt-0.5">{t.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tipos por categoria */}
              {COLUMN_CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{cat.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.types.map(t => {
                      const Icon = FIELD_TYPE_ICON[t.type]
                      return (
                        <button key={t.type} onClick={() => { setSelType(t); setStep('configure') }}
                          className="flex items-start gap-2.5 p-2.5 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:border-brand-300 hover:shadow-sm text-left transition-all group cursor-pointer">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs"
                            style={{ background: tint(t.color), color: t.color }}>
                            <Icon size={16} strokeWidth={2}/>
                          </div>
                          <div className="min-w-0 pt-0.5">
                            <p className="text-[12.5px] font-semibold text-gray-800 group-hover:text-brand-700 leading-tight">{t.label}</p>
                            <p className="text-[10px] text-gray-400 leading-snug mt-0.5 line-clamp-2">{t.desc}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Passo 2: configurar ──────────────────────────────────── */
            <div>
              <div className="flex items-center gap-3 mb-4 p-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                <button onClick={() => setStep('pick')} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-gray-600 transition-colors flex-shrink-0">
                  <ChevronLeft size={15}/>
                </button>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs ${selType?.ai ? 'ai-gradient-bg text-white' : ''}`}
                  style={selType?.ai ? undefined : { background: selType ? tint(selType.color) : undefined, color: selType?.color }}>
                  {selType && (() => { const Icon = FIELD_TYPE_ICON[selType.type]; return <Icon size={18} strokeWidth={2}/> })()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    {selType?.label}
                    {selType?.ai && <span className="text-[9px] font-bold uppercase tracking-wide ai-gradient-bg text-white px-1.5 py-[1px] rounded-full">IA</span>}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">{selType?.desc}</p>
                </div>
              </div>

              {/* Nome */}
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nome do campo *</label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && save()}
                  placeholder={
                    selType?.type==='dropdown' ? 'Ex: Fase, Status, Categoria' :
                    selType?.type==='labels'   ? 'Ex: Sistemas envolvidos' :
                    selType?.type==='number'   ? 'Ex: Estimativa, Pontos de esforço' :
                    selType?.type==='money'    ? 'Ex: Orçamento, Custo' :
                    selType?.type==='date'     ? 'Ex: Data de início, Revisão' :
                    selType?.type==='people'   ? 'Ex: Aprovador, Stakeholders' :
                    'Ex: Observações, Sprint'
                  }
                  className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400 transition-all"/>
              </div>

              {/* Opções (dropdown / rótulos) */}
              {(selType?.type === 'dropdown' || selType?.type === 'labels') && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opções da lista</label>
                    <button onClick={addOpt} className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-semibold px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors">
                      <Plus size={11}/> Adicionar opção
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {opts.map((opt, idx) => (
                      <div key={opt.id} className="group">
                        <div className="flex items-center gap-2">
                          <GripVertical size={13} className="text-gray-200 flex-shrink-0"/>
                          <button
                            onClick={() => setColorPicker(colorPicker===opt.id ? null : opt.id)}
                            className="w-6 h-6 rounded-full border-2 border-white shadow ring-1 ring-gray-200 hover:ring-gray-400 hover:scale-110 transition-all flex-shrink-0"
                            style={{ background: opt.color }}
                            title="Clique para trocar a cor"
                          />
                          <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                            style={{ background: opt.color + '25', color: opt.color }}>
                            {opt.label || `Opção ${idx+1}`}
                          </span>
                          <input value={opt.label} onChange={e => updateOpt(opt.id, { label: e.target.value })}
                            className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none focus:border-brand-300 transition-all min-w-0"
                            placeholder={`Opção ${idx+1}`}/>
                          <button onClick={() => removeOpt(opt.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                            <X size={12}/>
                          </button>
                        </div>
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
                <button onClick={reset} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors font-medium">
                  Cancelar
                </button>
                <button onClick={save} disabled={!name.trim()}
                  className="flex-1 py-2.5 text-sm bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors font-semibold flex items-center justify-center gap-1.5 shadow-sm">
                  <Check size={14}/> Criar campo
                </button>
              </div>
            </div>
          )
        ) : (
          /* ── Aba "Adicionar um existente" ──────────────────────────────── */
          <div className="space-y-4">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar campos de tarefa"
                className="w-full pl-8 pr-2 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400"/>
            </div>

            {/* Mostrados */}
            {(filterBySearch('Nome da tarefa') || BASE_SYSTEM_TOGGLEABLE.some(s => filterBySearch(s.label)) || cols.some(c => filterBySearch(c.name))) && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Mostrados</p>
                <div className="space-y-1 bg-gray-50/60 border border-gray-100 rounded-xl p-1.5">
                  {filterBySearch('Nome da tarefa') && (
                    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
                      <span className="text-xs text-gray-500 flex-1">Nome da tarefa</span>
                      <span className="w-8 h-4 rounded-full bg-brand-200 relative flex-shrink-0 opacity-60" title="Sempre visível">
                        <span className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-white"/>
                      </span>
                    </div>
                  )}
                  {BASE_SYSTEM_TOGGLEABLE.filter(s => filterBySearch(s.label)).map(s => {
                    const on = !hidden.includes(s.key)
                    return (
                      <div key={s.key} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white transition-colors">
                        <span className="text-xs text-gray-700 flex-1">{s.label}</span>
                        <button onClick={() => toggleHiddenAndRefresh(s.key)}
                          className={`w-8 h-4 rounded-full relative flex-shrink-0 transition-colors ${on ? 'bg-brand-500' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'right-0.5' : 'left-0.5'}`}/>
                        </button>
                      </div>
                    )
                  })}
                  {cols.filter(c => filterBySearch(c.name)).map(c => {
                    const on = !hidden.includes(c.id)
                    const tc = typeCardOf(c.type)
                    return (
                      <div key={c.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white transition-colors group">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${tc?.ai ? 'ai-gradient-bg text-white' : ''}`}
                          style={tc?.ai ? undefined : { background: tc ? tint(tc.color) : undefined, color: tc?.color }}>
                          {(() => { const Icon = FIELD_TYPE_ICON[c.type]; return Icon ? <Icon size={13} strokeWidth={2}/> : null })()}
                        </div>
                        {editingCol === c.id ? (
                          <input autoFocus defaultValue={c.name}
                            onBlur={e => { const v = e.target.value.trim(); if (v) updateColumn(targetId, c.id, { name: v }); setEditingCol(null) }}
                            onKeyDown={e => { if (e.key==='Enter') (e.target as HTMLInputElement).blur(); if (e.key==='Escape') setEditingCol(null) }}
                            className="flex-1 min-w-0 text-xs px-2 py-0.5 border border-brand-300 rounded-lg outline-none"/>
                        ) : (
                          <span onDoubleClick={() => setEditingCol(c.id)} title="Duplo-clique para renomear"
                            className="text-xs text-gray-700 flex-1 truncate cursor-text">{c.name} <span className="text-gray-400">({tc?.label})</span></span>
                        )}
                        <button onClick={() => deleteColumn(targetId, c.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0" title="Excluir campo">
                          <Trash2 size={12}/>
                        </button>
                        <button onClick={() => toggleHiddenAndRefresh(c.id)}
                          className={`w-8 h-4 rounded-full relative flex-shrink-0 transition-colors ${on ? 'bg-brand-500' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'right-0.5' : 'left-0.5'}`}/>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Propriedades */}
            {EXTRA_SYSTEM.some(s => filterBySearch(s.label)) && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Propriedades</p>
                <div className="space-y-1 bg-gray-50/60 border border-gray-100 rounded-xl p-1.5">
                  {EXTRA_SYSTEM.filter(s => filterBySearch(s.label)).map(s => {
                    const on = extra.includes(s.key)
                    return (
                      <div key={s.key} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white transition-colors">
                        <span className="text-xs text-gray-700 flex-1">{s.label}</span>
                        <button onClick={() => toggleExtraAndRefresh(s.key)}
                          className={`w-8 h-4 rounded-full relative flex-shrink-0 transition-colors ${on ? 'bg-brand-500' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'right-0.5' : 'left-0.5'}`}/>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
