import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Ícone lucide exibido numa caixa em degradê no cabeçalho (padrão comercial dos modais). */
  icon?: React.ElementType
  /** Cor base da caixa do ícone (degradê gerado a partir dela). Padrão: índigo da marca. */
  accent?: string
  /** Classe extra da caixa do ícone (ex.: `ai-gradient-bg` nos modais de IA) — substitui o degradê da cor. */
  iconClassName?: string
  /** Linha de apoio abaixo do título. */
  subtitle?: string
  children: React.ReactNode
  /** Rodapé fixo (botões de ação) — fica fora da área rolável. */
  footer?: React.ReactNode
  width?: string
}

/**
 * Shell único de modal do app (fonte única — nunca recriar overlay/cabeçalho por tela).
 * Cabeçalho com caixa de ícone em degradê + subtítulo, corpo rolável e rodapé fixo
 * opcional, no mesmo padrão visual do NewViewModal (referência do redesign 30/07/2026).
 */
export function Modal({ open, onClose, title, icon: Icon, accent = '#6366F1', iconClassName, subtitle, children, footer, width = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-[3px] animate-overlay-in" onClick={onClose} />
      <div className={`relative w-full ${width} max-h-[90vh] flex flex-col bg-white rounded-2xl border border-gray-200/80 shadow-2xl overflow-hidden animate-scale-in`}>
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          {Icon && (
            <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center flex-shrink-0 shadow-sm ${iconClassName ?? ''}`}
              style={iconClassName ? undefined : { background: `linear-gradient(135deg, ${accent}, ${accent}D0)`, boxShadow: `0 1px 2px ${accent}4D` }}>
              <Icon size={16}/>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h2>
            {subtitle && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto overflow-x-hidden">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-gray-100 bg-white flex-shrink-0">{footer}</div>
        )}
      </div>
    </div>
  )
}
