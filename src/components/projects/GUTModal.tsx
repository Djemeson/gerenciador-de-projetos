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
    <Modal open={gutModal.open} onClose={closeGUT} title={`Matriz GUT — ${project.name}`} width="max-w-sm">
      <div className="space-y-3">
        {/* Score display (Hero Card) */}
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors duration-300"
          style={{ backgroundColor: tier.bg, borderColor: tier.color + '2A' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: tier.color + '1F' }}>
            <Target size={16} style={{ color: tier.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider opacity-70" style={{ color: tier.color }}>Prioridade GUT</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold tracking-tight tabnum leading-none" style={{ color: tier.color }}>{score}</span>
              <span className="text-[10px] font-medium tabnum" style={{ color: tier.color + 'B0' }}>{g}×{u}×{t}</span>
            </div>
          </div>
          <span className="text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
            style={{ background: tier.color, color: '#fff' }}>
            {tier.label}
          </span>
        </div>

        {/* Sliders em formato de cartões suaves */}
        <div className="space-y-1.5">
          <GUTSlider
            label="G — Gravidade"
            hint="Impacto se não resolver"
            value={g} onChange={setG}
            descriptions={GUT_LABEL_G}
            color="#D85A30"
          />
          <GUTSlider
            label="U — Urgência"
            hint="Tempo disponível"
            value={u} onChange={setU}
            descriptions={GUT_LABEL_U}
            color="#BA7517"
          />
          <GUTSlider
            label="T — Tendência"
            hint="Se nada for feito"
            value={t} onChange={setT}
            descriptions={GUT_LABEL_T}
            color="#185FA5"
          />
        </div>

        {/* Info */}
        <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100">
          <Info size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-gray-500 leading-relaxed">
            1 a 125 — quanto maior, mais prioritário. <span className="text-gray-400">≥80 crítico · 40–79 alto · 15–39 médio · &lt;15 baixo.</span>
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
    <div className="px-2.5 py-2 bg-gray-50 hover:bg-gray-100/70 border border-gray-100 rounded-lg transition-colors duration-200">
      <div className="flex items-center justify-between mb-0.5 gap-2">
        <div className="min-w-0 flex items-baseline gap-1.5">
          <span className="text-[11.5px] font-bold text-gray-800 flex-shrink-0">{label}</span>
          <p className="text-[9.5px] text-gray-400 truncate">{hint}</p>
        </div>
        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex-shrink-0 tabnum"
          style={{ background: color + '14', color }}>
          {value} · {descriptions[value]}
        </span>
      </div>
      <div className="relative pt-1.5">
        <input
          type="range" min={1} max={5} step={1} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="gut-range w-full"
          style={{
            ['--thumb-color' as string]: color,
            background: `linear-gradient(to right, ${color} ${pct}%, var(--gray-200) ${pct}%)`,
          }}
        />
      </div>
    </div>
  )
}
