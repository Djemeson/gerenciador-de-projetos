import React, { useState } from 'react'
import { Slash, Pipette, Plus, X, Pencil, Check } from 'lucide-react'
import {
  ICON_CATEGORIES, SWATCH_COLORS, getIconComponent, normalizeSearch,
  loadSavedColors, saveSavedColors, loadRecentIcons, addRecentIcon,
} from '../../lib/sidebarIcons'
import { iconLabel } from '../../lib/iconLabelsPt'
import { FloatingPanel } from './FloatingPanel'

interface IconColorPickerProps {
  /** 'icon': grade de ícones + cores (projetos). 'color': só cores (espaços/pastas). */
  mode: 'icon' | 'color'
  theme?: 'dark' | 'light'
  color?: string
  icon?: string
  onPickColor: (color: string | undefined) => void
  onPickIcon?: (name: string) => void
  onClose: () => void
  /** Elemento que disparou o popover — define a posição (portal, não é cortado por overflow). */
  anchor: HTMLElement
  /** Esconde a linha de cores (usado quando a cor já é escolhida em outro lugar, ex.: NewProjectModal). */
  showColorRow?: boolean
}

/**
 * Popover de ícone (lucide) + cor, estilo ClickUp. Substitui o antigo EmojiPicker.
 * `mode="color"` esconde a grade e serve só para escolher a cor (espaço/pasta).
 */
export function IconColorPicker({ mode, theme = 'dark', color, icon, onPickColor, onPickIcon, onClose, anchor, showColorRow = true }: IconColorPickerProps) {
  const [search, setSearch] = useState('')
  const [customColor, setCustomColor] = useState(color ?? '#6366F1')
  const [savedColors, setSavedColors] = useState<string[]>(() => loadSavedColors())
  const [editingSaved, setEditingSaved] = useState(false)
  const [askColorOnIconChange, setAskColorOnIconChange] = useState(false)
  const [recentIcons, setRecentIcons] = useState<string[]>(() => loadRecentIcons())

  const isCustomActive = !!color && !SWATCH_COLORS.includes(color) && !savedColors.includes(color)

  const pickColor = (c: string | undefined) => onPickColor(c)
  const pickIcon = (name: string) => {
    addRecentIcon(name)
    setRecentIcons(loadRecentIcons())
    onPickIcon?.(name)
  }

  const saveCurrentColor = () => {
    if (savedColors.includes(customColor)) return
    const next = [...savedColors, customColor]
    setSavedColors(next); saveSavedColors(next)
  }
  const removeSavedColor = (c: string) => {
    const next = savedColors.filter(sc => sc !== c)
    setSavedColors(next); saveSavedColors(next)
  }

  const dark = theme === 'dark'
  const panelCls = dark
    ? 'bg-[#1B1C21] border-[#2E2F36] text-[#DADBE0]'
    : 'bg-white border-gray-200 text-[#3B3E45]'
  const inputCls = dark
    ? 'bg-[#111114] border-[#2E2F36] text-white placeholder:text-[#5A5C66] focus:border-brand-500'
    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-brand-500'
  const mutedCls = dark ? 'text-[#6B6D75]' : 'text-gray-400'
  const hoverBtnCls = dark ? 'hover:bg-white/8' : 'hover:bg-black/5'

  const q = normalizeSearch(search.trim())

  return (
    <FloatingPanel anchor={anchor} onClose={onClose} align="left">
    <div className={`${mode === 'icon' ? 'w-[420px]' : 'w-[260px]'} border rounded-xl shadow-2xl p-3 ${panelCls}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-bold">{mode === 'icon' ? 'Ícone' : 'Cor'}</span>
        <button
          type="button"
          onClick={() => { onPickColor(undefined); if (mode === 'icon' && onPickIcon) onPickIcon('') }}
          className={`text-[12px] ${mutedCls} ${dark ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
        >Resetar</button>
      </div>

      {mode === 'icon' && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar ícone..."
          className={`w-full text-[12.5px] px-2.5 py-1.5 border rounded-lg outline-none mb-2 ${inputCls}`}
        />
      )}

      {/* Cores */}
      {showColorRow && (
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SWATCH_COLORS.map(c => (
          <button
            key={c} type="button" title={c}
            onClick={() => pickColor(c)}
            className="w-[18px] h-[18px] rounded-full transition-transform hover:scale-110"
            style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${dark ? '#1B1C21' : '#fff'}, 0 0 0 3.5px #6366F1` : 'none' }}
          />
        ))}
        <button
          type="button" title="Sem cor"
          onClick={() => pickColor(undefined)}
          className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${dark ? 'bg-[#2E2F36] text-[#8A8D98]' : 'bg-gray-200 text-gray-400'}`}
        ><Slash size={9}/></button>
        <label
          className="w-[18px] h-[18px] rounded-full relative flex items-center justify-center cursor-pointer text-white overflow-hidden"
          style={{
            background: isCustomActive ? customColor : 'conic-gradient(from 180deg,#EF4444,#F59E0B,#22C55E,#06B6D4,#6366F1,#EC4899,#EF4444)',
            boxShadow: isCustomActive ? `0 0 0 2px ${dark ? '#1B1C21' : '#fff'}, 0 0 0 3.5px #fff` : 'none',
          }}
          title="Cor personalizada"
        >
          {!isCustomActive && <Pipette size={9}/>}
          <input
            type="color" value={customColor}
            onChange={e => { setCustomColor(e.target.value); pickColor(e.target.value) }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer border-none p-0"
          />
        </label>
        {isCustomActive && (
          <button
            type="button" title="Salvar cor personalizada" onClick={saveCurrentColor}
            className={`w-[18px] h-[18px] rounded-full border border-dashed flex items-center justify-center ${dark ? 'border-[#4A4C55] text-[#8A8D98] hover:border-brand-500 hover:text-brand-400' : 'border-gray-300 text-gray-400 hover:border-brand-500 hover:text-brand-500'} transition-colors`}
          ><Plus size={9}/></button>
        )}
      </div>
      )}

      {showColorRow && savedColors.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`text-[10.5px] font-bold uppercase tracking-wider ${mutedCls}`}>Cores salvas</span>
            <button
              type="button"
              onClick={() => setEditingSaved(v => !v)}
              className={`ml-auto w-[17px] h-[17px] rounded flex items-center justify-center transition-colors ${editingSaved ? 'text-red-500 bg-red-500/10' : `${mutedCls} ${hoverBtnCls}`}`}
            >{editingSaved ? <Check size={11}/> : <Pencil size={11}/>}</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {savedColors.map(c => (
              <div key={c} className="relative">
                <button
                  type="button"
                  onClick={() => !editingSaved && pickColor(c)}
                  className="w-[18px] h-[18px] rounded-full block"
                  style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${dark ? '#1B1C21' : '#fff'}, 0 0 0 3.5px #6366F1` : 'none', filter: editingSaved ? 'brightness(.8)' : undefined }}
                />
                {editingSaved && (
                  <button
                    type="button" onClick={() => removeSavedColor(c)}
                    className={`absolute -top-1.5 -right-1.5 w-[13px] h-[13px] rounded-full flex items-center justify-center ${dark ? 'bg-[#3B3E45]' : 'bg-gray-300'} text-white`}
                  ><X size={8}/></button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {mode === 'icon' && (
        <div className="grid grid-cols-10 gap-1.5 max-h-[220px] overflow-y-auto sidebar-scroll pr-1">
          {q.length > 0 ? (() => {
            // Busca: mesmo ícone pode existir em mais de uma categoria (browsing temático) —
            // dedupe pra não repetir o mesmo ícone várias vezes no resultado da busca.
            const seen = new Set<string>()
            const results: string[] = []
            ICON_CATEGORIES.forEach(cat => {
              const catMatches = normalizeSearch(cat.label).includes(q)
              cat.icons.forEach(n => {
                if (seen.has(n)) return
                if (catMatches || normalizeSearch(n).includes(q) || normalizeSearch(iconLabel(n)).includes(q)) { seen.add(n); results.push(n) }
              })
            })
            if (results.length === 0) {
              return <div className={`col-span-10 text-center text-xs py-4 ${mutedCls}`}>Nenhum ícone encontrado</div>
            }
            return results.map(name => {
              const Icon = getIconComponent(name)
              if (!Icon) return null
              const selected = icon === name
              return (
                <button
                  key={name} type="button" title={iconLabel(name)}
                  onClick={() => pickIcon(name)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selected ? (dark ? 'bg-brand-500/25' : 'bg-brand-50') : hoverBtnCls}`}
                  style={{ color: color || '#6366F1' }}
                ><Icon size={16}/></button>
              )
            })
          })() : (
            <>
              {recentIcons.length > 0 && (
                <React.Fragment key="recent">
                  <div className={`col-span-10 text-[10.5px] font-bold uppercase tracking-wider pt-1.5 first:pt-0 ${mutedCls}`}>Recentemente usados</div>
                  {recentIcons.map(name => {
                    const Icon = getIconComponent(name)
                    if (!Icon) return null
                    const selected = icon === name
                    return (
                      <button
                        key={'recent-'+name} type="button" title={iconLabel(name)}
                        onClick={() => pickIcon(name)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selected ? (dark ? 'bg-brand-500/25' : 'bg-brand-50') : hoverBtnCls}`}
                        style={{ color: color || '#6366F1' }}
                      ><Icon size={16}/></button>
                    )
                  })}
                </React.Fragment>
              )}
              {ICON_CATEGORIES.map(cat => (
                <React.Fragment key={cat.label}>
                  <div className={`col-span-10 text-[10.5px] font-bold uppercase tracking-wider pt-1.5 first:pt-0 ${mutedCls}`}>{cat.label}</div>
                  {cat.icons.map(name => {
                    const Icon = getIconComponent(name)
                    if (!Icon) return null
                    const selected = icon === name
                    return (
                      <button
                        key={name} type="button" title={iconLabel(name)}
                        onClick={() => pickIcon(name)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selected ? (dark ? 'bg-brand-500/25' : 'bg-brand-50') : hoverBtnCls}`}
                        style={{ color: color || '#6366F1' }}
                      ><Icon size={16}/></button>
                    )
                  })}
                </React.Fragment>
              ))}
            </>
          )}
        </div>
      )}

      {mode === 'icon' && (
        <div className={`flex items-center justify-between gap-2 mt-2 pt-2 border-t text-xs ${dark ? 'border-[#2E2F36] text-[#9195A0]' : 'border-gray-100 text-gray-600'}`}>
          <span>Perguntar cor ao trocar ícone</span>
          <button
            type="button"
            onClick={() => setAskColorOnIconChange(v => !v)}
            className={`w-[26px] h-[15px] rounded-full relative flex-shrink-0 transition-colors ${askColorOnIconChange ? 'bg-brand-600' : (dark ? 'bg-[#2E2F36]' : 'bg-gray-200')}`}
          >
            <span className={`absolute top-[2px] w-[11px] h-[11px] rounded-full transition-all ${askColorOnIconChange ? 'left-[13px] bg-white' : `left-[2px] ${dark ? 'bg-[#8A8D98]' : 'bg-white'}`}`}/>
          </button>
        </div>
      )}
    </div>
    </FloatingPanel>
  )
}
