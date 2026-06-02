import React, { useState, useEffect } from 'react'
import { Info } from 'lucide-react'
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
      <div className="space-y-5">
        {/* Score display */}
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: tier.bg }}>
          <div>
            <p className="text-xs font-medium" style={{ color: tier.color }}>Score GUT</p>
            <p className="text-3xl font-semibold mt-0.5" style={{ color: tier.color }}>{score}</p>
          </div>
          <div className="text-right">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: tier.color + '22', color: tier.color }}
            >
              {tier.label}
            </span>
            <p className="text-[10px] mt-1.5" style={{ color: tier.color + 'aa' }}>G × U × T = {g} × {u} × {t}</p>
          </div>
        </div>

        {/* Sliders */}
        <GUTSlider
          label="G — Gravidade"
          hint="Qual o impacto se o problema não for resolvido?"
          value={g} onChange={setG}
          descriptions={GUT_LABEL_G}
          color="#D85A30"
        />
        <GUTSlider
          label="U — Urgência"
          hint="Qual o tempo disponível para resolver?"
          value={u} onChange={setU}
          descriptions={GUT_LABEL_U}
          color="#BA7517"
        />
        <GUTSlider
          label="T — Tendência"
          hint="O que acontece se nada for feito?"
          value={t} onChange={setT}
          descriptions={GUT_LABEL_T}
          color="#185FA5"
        />

        {/* Info */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
          <Info size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Pontuação de 1 a 125. Quanto maior, mais prioritário deve ser o projeto.
            Valores acima de 80 = crítico, 40-79 = alto, 15-39 = médio, abaixo de 15 = baixo.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
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
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: color + '18', color }}>
          {value} — {descriptions[value]}
        </span>
      </div>
      <p className="text-[11px] text-gray-400 mb-2">{hint}</p>
      <div className="relative">
        <input
          type="range" min={1} max={5} step={1} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: color }}
        />
        <div className="flex justify-between mt-1">
          {[1,2,3,4,5].map(n => (
            <span key={n} className={`text-[10px] ${n === value ? 'font-semibold' : 'text-gray-300'}`} style={n === value ? { color } : undefined}>
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
