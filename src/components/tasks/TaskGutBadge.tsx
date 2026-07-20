import React, { useRef, useState } from 'react'
import { Zap } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { FloatingPanel } from '../ui/FloatingPanel'
import { calcGUT, gutTier } from '../../types'
import type { Task } from '../../types'

// Matriz GUT por tarefa — popover compacto de acesso rápido na lista, distinto do
// GUTModal (que é o modal cheio usado para o GUT de projeto). Mesmos limiares/cores
// de `gutTier` (fonte única), só a interação (segmentos em vez de slider) é diferente
// por ser um popover pequeno ancorado na célula da coluna "GUT".
type Dim = 'g' | 'u' | 't'

const DIM_LABEL: Record<Dim, string> = { g: 'Gravidade', u: 'Urgência', t: 'Tendência' }
const DIM_COLOR: Record<Dim, string> = { g: '#D97706', u: '#E24B4A', t: '#378ADD' }
const DIM_QUESTION: Record<Dim, string> = {
  g: 'O quão grave é o impacto se essa tarefa não for feita?',
  u: 'Quanto tempo se pode esperar para resolver isso?',
  t: 'Se nada for feito, a situação tende a piorar com que rapidez?',
}
const DIM_TIPS: Record<Dim, string[]> = {
  g: ['Impacto mínimo, quase imperceptível', 'Impacto pequeno, afeta pouca coisa', 'Impacto moderado, merece atenção', 'Impacto sério, atrapalha o time', 'Impacto crítico, compromete tudo'],
  u: ['Pode esperar semanas sem problema', 'Pode esperar alguns dias', 'Deve ser feito essa semana', 'Precisa ser feito o quanto antes', 'Não pode esperar, é para agora'],
  t: ['Sem chance de piorar com o tempo', 'Piora bem devagar, quase nada', 'Vai piorar em ritmo normal', 'Piora rápido se ninguém agir', 'Vira uma crise se não for feito já'],
}

export function TaskGutBadge({ task }: { task: Task }) {
  const { updateTask } = useAppStore()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<{ g: number; u: number; t: number }>(() => task.gut ?? { g: 3, u: 3, t: 3 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const score = draft.g * draft.u * draft.t
  const tier  = gutTier(score)

  const openPop = () => { setDraft(task.gut ?? { g: 3, u: 3, t: 3 }); setOpen(true) }
  const setDim  = (dim: Dim, n: number) => setDraft(d => ({ ...d, [dim]: n }))
  const save    = () => { updateTask(task.id, { gut: calcGUT(draft.g, draft.u, draft.t) }); setOpen(false) }

  const savedTier = task.gut ? gutTier(task.gut.score) : null

  return (
    <>
      {task.gut && savedTier ? (
        <button ref={btnRef} onClick={e => { e.stopPropagation(); openPop() }}
          title={`Matriz GUT · ${savedTier.label}`}
          className="min-w-[36px] h-6 px-2 rounded-lg text-xs font-bold tabnum transition-transform hover:scale-105"
          style={{ background: savedTier.bg, color: savedTier.color }}>
          {task.gut.score}
        </button>
      ) : (
        <button ref={btnRef} onClick={e => { e.stopPropagation(); openPop() }}
          className="text-[11px] text-gray-300 font-semibold border border-dashed border-gray-200 rounded-lg px-2 py-1 hover:border-brand-300 hover:text-brand-500 transition-colors whitespace-nowrap">
          + GUT
        </button>
      )}

      {open && btnRef.current && (
        <FloatingPanel anchor={btnRef.current} onClose={() => setOpen(false)} align="left">
          <div onClick={e => e.stopPropagation()} className="w-[260px] border border-gray-200 rounded-2xl shadow-2xl bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg,#F59E0B,#E24B4A 55%,#378ADD)' }}>
                <Zap size={13} className="text-white" strokeWidth={2.4}/>
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 leading-tight">Matriz GUT</p>
                <p className="text-[10.5px] text-gray-400 leading-tight">Gravidade × Urgência × Tendência</p>
              </div>
            </div>

            {(['g', 'u', 't'] as Dim[]).map(dim => (
              <div key={dim} className="mb-4 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-extrabold flex-shrink-0 shadow-xs"
                      style={{ background: DIM_COLOR[dim] }}>{dim.toUpperCase()}</span>
                    {DIM_LABEL[dim]}
                  </span>
                  <span className="text-xs font-extrabold text-slate-500 tabnum bg-white border border-slate-100 rounded-md px-1.5 py-0.5 shadow-2xs">{draft[dim]}/5</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-tight mb-2">{DIM_QUESTION[dim]}</p>
                <div className="flex gap-1 px-0.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <span key={n} onClick={() => setDim(dim, n)} title={DIM_TIPS[dim][n - 1]}
                      className="flex-1 h-2.5 rounded-md cursor-pointer transition-all duration-200 hover:scale-y-120 hover:brightness-105 shadow-2xs"
                      style={{ background: n <= draft[dim] ? DIM_COLOR[dim] : '#E2E8F0' }}/>
                  ))}
                </div>
                {/* Descrição em tempo real da opção selecionada (UX de alta fidelidade) */}
                <p className="text-[9.5px] text-gray-500 font-semibold mt-1.5 pl-0.5 transition-all">
                  {DIM_TIPS[dim][draft[dim] - 1]}
                </p>
              </div>
            ))}

            <p className="text-[10px] text-gray-300 italic text-center my-2">Prioridade = G × U × T</p>

            <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 mb-3">
              <span className="text-[11px] text-gray-400 font-medium">Resultado</span>
              <span className="flex items-center gap-2">
                <span className="text-lg font-bold tabnum" style={{ color: tier.color }}>{score}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: tier.bg, color: tier.color }}>{tier.label}</span>
              </span>
            </div>

            <button onClick={save}
              className="w-full h-8 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors">
              Salvar
            </button>
          </div>
        </FloatingPanel>
      )}
    </>
  )
}
