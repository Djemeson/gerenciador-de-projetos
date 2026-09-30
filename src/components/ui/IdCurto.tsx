import { useEffect, useState } from 'react'
import { formatarId, type TipoId } from '../../lib/shortIds'

/**
 * O ID curto (T-142 / P-12) como etiqueta discreta; um clique copia. É o que se cola numa
 * conversa com o Claude para ele achar a tarefa ("continua a T-142"). Fonte única: tarefa
 * e projeto usam este mesmo componente (DIRETRIZES, seção 17).
 */
export function IdCurto({ tipo, seq, className = '' }: { tipo: TipoId; seq?: number; className?: string }) {
  const [copiado, setCopiado] = useState(false)
  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(false), 1400)
    return () => clearTimeout(t)
  }, [copiado])

  const id = formatarId(tipo, seq)
  if (!id) return null
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        navigator.clipboard?.writeText(id).then(() => setCopiado(true)).catch(() => {})
      }}
      title="Copiar ID"
      className={`tabnum font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-md border flex-shrink-0 transition-colors ${
        copiado ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      } ${className}`}
    >{copiado ? 'Copiado' : id}</button>
  )
}
