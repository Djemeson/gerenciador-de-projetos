import React, { useState, useEffect } from 'react'
import { Info, Target } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui'
import { useAppStore } from '../../stores/useAppStore'
import { GUT_LABEL_G, GUT_LABEL_U, GUT_LABEL_T, gutTier } from '../../types'

export function GUTModal() {
  const { gutModal, closeGUT, projects, saveGUT } = useAppStore()
  const project = projects.find(p => p.id === gutModal.projectId)

  const [g, setG] = useState(1)
  const [u, setU] = useState(1)
  const [t, setT] = useState(1)

  useEffect(() => {
    if (project) { setG(project.gut.g); setU(project.gut.u); setT(project.gut.t) }
  }, [project])

  if (!gutModal.open || !project) return null

  const score = g * u * t
  const tier  = gutTier(score)

  const handleSave = () => {
    saveGUT(project.id, g, u, t)
    closeGUT()
  }

  return (
    <Modal open={gutModal.open} onClose={closeGUT} title={`Matriz GUT — ${project.name}`} width="max-w-md">
      <div className="space-y-4">
        {/* Score display (Hero Card) */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl border transition-colors duration-300"
          style={{ backgroundColor: tier.bg, borderColor: tier.color + '2A' }}>
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: tier.color + '1F' }}>
            <Target size={19} style={{ color: tier.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70" style={{ color: tier.color }}>Prioridade GUT</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-extrabold tracking-tight tabnum leading-none" style={{ color: tier.color }}>{score}</span>
              <span className="text-[10px] font-medium tabnum" style={{ color: tier.color + 'B0' }}>{g}×{u}×{t}</span>
            </div>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: tier.color, color: '#fff' }}>
            {tier.label}
          </span>
        </div>

        {/* Sliders em formato de cartões suaves */}
        <div className="space-y-2.5">
          <GUTSlider
            label="G — Gravidade"
            hint="Impacto se o problema não for resolvido"
            value={g} onChange={setG}
            descriptions={GUT_LABEL_G}
            color="#D85A30"
          />
          <GUTSlider
            label="U — Urgência"
            hint="Tempo disponível para resolver"
            value={u} onChange={setU}
            descriptions={GUT_LABEL_U}
            color="#BA7517"
          />
          <GUTSlider
            label="T — Tendência"
            hint="O que acontece se nada for feito"
            value={t} onChange={setT}
            descriptions={GUT_LABEL_T}
            color="#185FA5"
          />
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
          <Info size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10.5px] text-gray-500 leading-relaxed">
            Pontuação de 1 a 125 — quanto maior, mais prioritário. <span className="text-gray-400">≥80 crítico · 40–79 alto · 15–39 médio · &lt;15 baixo.</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="default" onClick={closeGUT} className="flex-1">Cancelar</Button>
          <Button variant="primary" onClick={handleSave} className="flex-1">Salvar</Button>
        </div>
      </div>
    </Modal>
  )
}

function GUTSlider({
  label, hint, value, onChange, descriptions, color,
}: {
  label: string; hint: string; value: number; onChange: (v: number) => void;
  descriptions: Record<number, string>; color: string
}) {
  const pct = ((value - 1) / 4) * 100
  return (
    <div className="p-3 bg-gray-50 hover:bg-gray-100/70 border border-gray-100 rounded-xl transition-colors duration-200">
      <div className="flex items-center justify-between mb-0.5">
        <div className="min-w-0">
          <span className="text-xs font-bold text-gray-800">{label}</span>
          <p className="text-[10px] text-gray-400 truncate">{hint}</p>
        </div>
        <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 tabnum"
          style={{ background: color + '14', color }}>
          {value} · {descriptions[value]}
        </span>
      </div>
      <div className="relative pt-2.5">
        <input
          type="range" min={1} max={5} step={1} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="gut-range w-full"
          style={{
            ['--thumb-color' as string]: color,
            background: `linear-gradient(to right, ${color} ${pct}%, var(--gray-200) ${pct}%)`,
          }}
        />
        <div className="flex justify-between mt-1 px-0.5 select-none">
          {[1,2,3,4,5].map(n => (
            <span key={n} className={`text-[9.5px] font-bold tabnum transition-colors ${n === value ? '' : 'text-gray-300'}`} style={n === value ? { color } : undefined}>
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
