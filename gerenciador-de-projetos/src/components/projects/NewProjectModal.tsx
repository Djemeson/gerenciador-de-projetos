import React, { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui'
import { useAppStore } from '../../stores/useAppStore'
import { PROJECT_COLORS } from '../../types'

export function NewProjectModal() {
  const { newProjectModal, closeNewProject, addProject } = useAppStore()
  const [name,  setName]  = useState('')
  const [desc,  setDesc]  = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])

  const reset = () => { setName(''); setDesc(''); setColor(PROJECT_COLORS[0]) }
  const handleClose = () => { reset(); closeNewProject() }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addProject(name.trim(), color, desc.trim())
    handleClose()
  }

  return (
    <Modal open={newProjectModal} onClose={handleClose} title="Novo projeto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome do projeto *"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 transition-all"
          />
        </div>

        <div>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 transition-all resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] text-gray-500 mb-2">Cor do projeto</label>
          <div className="flex gap-2 flex-wrap">
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                style={{
                  background: c,
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        <p className="text-[11px] text-gray-400">
          Após criar o projeto, você pode configurar a pontuação GUT na lista de projetos.
        </p>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="default" onClick={handleClose} className="flex-1">Cancelar</Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={!name.trim()}>Criar projeto</Button>
        </div>
      </form>
    </Modal>
  )
}
