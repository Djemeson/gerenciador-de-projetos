import React, { useState, useEffect, useRef } from 'react'
import { Info, Check } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui'
import { Select } from '../ui/Select'
import { IconColorPicker } from '../ui/IconColorPicker'
import { getIconComponent } from '../../lib/sidebarIcons'
import { useAppStore } from '../../stores/useAppStore'
import { PROJECT_COLORS } from '../../types'

export function NewProjectModal() {
  const { newProjectModal, newProjectCtx, closeNewProject, addProject, spaces: allSpaces, folders, activeWorkspaceId } = useAppStore()
  const spaces = allSpaces.filter(s => s.workspaceId === activeWorkspaceId)
  const [name,     setName]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [color,    setColor]    = useState(PROJECT_COLORS[0])
  const [icon,     setIcon]     = useState<string|undefined>(undefined)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [spaceId,  setSpaceId]  = useState<string>('')
  const [folderId, setFolderId] = useState<string>('')
  const iconBtnRef = useRef<HTMLButtonElement>(null)

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
        {/* Identidade: ícone + nome, em um cartão único */}
        <div className="flex gap-2.5 items-center p-2.5 bg-gray-50 border border-gray-100 rounded-xl relative">
          <button
            ref={iconBtnRef}
            type="button"
            onClick={() => setPickerOpen(v => !v)}
            title="Escolher ícone"
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg text-lg font-bold transition-transform hover:scale-105"
            style={{ background: color + '1F', color }}
          >
            {icon
              ? (() => { const Icon = getIconComponent(icon); return Icon ? <Icon size={19}/> : null })()
              : (name.trim().charAt(0).toUpperCase() || '+')}
          </button>
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="Nome do projeto *"
            className="flex-1 min-w-0 text-sm px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400 bg-white transition-all"
          />
          {pickerOpen && iconBtnRef.current && (
            <IconColorPicker
              mode="icon" theme="light" color={color} icon={icon} showColorRow={false}
              anchor={iconBtnRef.current}
              onPickColor={() => {}}
              onPickIcon={name => setIcon(name || undefined)}
              onClose={() => setPickerOpen(false)}
            />
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
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Espaço</label>
              <Select value={spaceId} onChange={v => { setSpaceId(v); setFolderId('') }} ariaLabel="Espaço"
                options={[{ value:'', label:'Nenhum' }, ...spaces.map(s => ({ value:s.id, label:s.name }))]}/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Pasta</label>
              <Select value={folderId} onChange={setFolderId} ariaLabel="Pasta"
                disabled={!spaceId || availableFolders.length===0}
                options={[{ value:'', label:'Nenhuma' }, ...availableFolders.map(f => ({ value:f.id, label:f.name }))]}/>
            </div>
          </div>
        )}

        {/* Color */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Cor do projeto</label>
          <div className="flex gap-2 flex-wrap">
            {PROJECT_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} title={c}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 border-2 border-white shadow-sm ring-1 ring-gray-200"
                style={{ background: c, ...(color===c ? { boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${c}` } : {}) }}>
                {color===c && <Check size={13} className="text-white" strokeWidth={3}/>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
          <Info size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10.5px] text-gray-500 leading-relaxed">Configure a pontuação GUT (prioridade) após criar o projeto.</p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="default" onClick={handleClose} className="flex-1">Cancelar</Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={!name.trim()}>Criar projeto</Button>
        </div>
      </form>
    </Modal>
  )
}
