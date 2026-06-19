import React, { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui'
import { EmojiPicker } from '../ui/EmojiPicker'
import { useAppStore } from '../../stores/useAppStore'
import { PROJECT_COLORS } from '../../types'

export function NewProjectModal() {
  const { newProjectModal, newProjectCtx, closeNewProject, addProject, spaces, folders } = useAppStore()
  const [name,     setName]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [color,    setColor]    = useState(PROJECT_COLORS[0])
  const [icon,     setIcon]     = useState<string|undefined>(undefined)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [spaceId,  setSpaceId]  = useState<string>('')
  const [folderId, setFolderId] = useState<string>('')

  // Pré-preenche espaço/pasta quando o modal é aberto a partir de um espaço/pasta
  useEffect(() => {
    if (newProjectModal) {
      setSpaceId(newProjectCtx.spaceId ?? '')
      setFolderId(newProjectCtx.folderId ?? '')
    }
  }, [newProjectModal, newProjectCtx.spaceId, newProjectCtx.folderId])

  const availableFolders = folders.filter(f => f.spaceId === spaceId)

  const reset = () => { setName(''); setDesc(''); setColor(PROJECT_COLORS[0]); setIcon(undefined); setPickerOpen(false); setSpaceId(''); setFolderId('') }
  const handleClose = () => { reset(); closeNewProject() }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addProject(name.trim(), color, desc.trim(), spaceId || undefined, folderId || undefined, icon)
    handleClose()
  }

  return (
    <Modal open={newProjectModal} onClose={handleClose} title="Novo projeto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2 items-stretch relative">
          <button
            type="button"
            onClick={() => setPickerOpen(v => !v)}
            title="Escolher ícone"
            className="w-10 flex-shrink-0 flex items-center justify-center border border-gray-200 rounded-lg text-lg hover:bg-gray-50 transition-colors"
            style={icon ? undefined : { background: color, color: '#fff' }}
          >
            {icon ?? (name.trim().charAt(0).toUpperCase() || '+')}
          </button>
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="Nome do projeto *"
            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 transition-all"
          />
          {pickerOpen && (
            <div className="absolute left-0 top-12">
              <EmojiPicker onPick={setIcon} onClose={() => setPickerOpen(false)} />
            </div>
          )}
        </div>

        <textarea
          value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Descrição (opcional)" rows={2}
          className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 transition-all resize-none"
        />

        {/* Space + Folder selectors */}
        {spaces.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Espaço</label>
              <select value={spaceId} onChange={e => { setSpaceId(e.target.value); setFolderId('') }}
                className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none bg-white text-gray-700">
                <option value="">Nenhum</option>
                {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Pasta</label>
              <select value={folderId} onChange={e => setFolderId(e.target.value)}
                disabled={!spaceId || availableFolders.length===0}
                className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none bg-white text-gray-700 disabled:opacity-40">
                <option value="">Nenhuma</option>
                {availableFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Color */}
        <div>
          <label className="block text-[11px] text-gray-500 mb-2">Cor do projeto</label>
          <div className="flex gap-2 flex-wrap">
            {PROJECT_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                style={{ background: c, outline: color===c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}/>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-gray-400">Configure a pontuação GUT após criar o projeto.</p>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="default" onClick={handleClose} className="flex-1">Cancelar</Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={!name.trim()}>Criar projeto</Button>
        </div>
      </form>
    </Modal>
  )
}
