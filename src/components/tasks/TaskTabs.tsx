import { X, Check } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { TYPE_ICON } from '../../lib/taskTypeIcons'
import { STATUS_COLOR } from '../ui/Select'

/**
 * Abas de tarefa — abrir uma tarefa passa a **empilhar** em vez de substituir, para dar
 * para acompanhar várias ao mesmo tempo.
 *
 * Duas aparências do mesmo estado (`openTaskIds` na store), nunca duas listas:
 * - `variant="app"`: faixa acima do conteúdo, visível em qualquer tela. É o que traz a
 *   tarefa de volta depois de fechar o painel — sem ela, sair do painel perderia as abas.
 * - `variant="panel"`: a mesma faixa dentro do painel de detalhe, para trocar de tarefa
 *   sem fechar nada. Só aparece com 2+ abas: com uma só não há para onde trocar.
 */
interface Props { variant: 'app' | 'panel' }

export function TaskTabs({ variant }: Props) {
  const { tasks, openTaskIds, selectedTaskId, setSelectedTask, closeTaskTab, closeAllTaskTabs } = useAppStore()

  // Aba de tarefa que não existe mais (excluída em outro aparelho, por exemplo) é ignorada
  // na hora de desenhar — a store já limpa o que ela própria exclui.
  const abas = openTaskIds.map(id => tasks.find(t => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t)

  if (abas.length === 0) return null
  if (variant === 'panel' && abas.length < 2) return null

  const noApp = variant === 'app'

  return (
    <div className={noApp
      ? 'flex items-center gap-1 mb-1.5 flex-shrink-0 overflow-x-auto scrollbar-none'
      : 'flex items-center gap-1 px-3 py-1.5 border-b border-gray-100 bg-gray-50/60 flex-shrink-0 overflow-x-auto scrollbar-none'}>
      {abas.map(t => {
        const Icon    = TYPE_ICON[t.taskType ?? 'task']
        const ativa   = t.id === selectedTaskId
        const concl   = t.status === 'done'
        return (
          <div key={t.id}
            onClick={() => setSelectedTask(t.id)}
            title={t.title}
            className={`group/aba flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg border cursor-pointer transition-colors flex-shrink-0 max-w-[190px]
              ${ativa
                ? 'bg-white border-brand-200 ring-1 ring-brand-100 shadow-sm'
                : 'bg-white/70 border-gray-200 hover:border-gray-300 hover:bg-white'}`}>
            {concl
              ? <Check size={12} strokeWidth={3} className="text-success-500 flex-shrink-0"/>
              : <Icon size={12} strokeWidth={2} style={{ color: STATUS_COLOR[t.status] }} className="flex-shrink-0"/>}
            <span className={`text-[11.5px] truncate ${ativa ? 'font-semibold text-gray-800' : 'font-medium text-gray-600'} ${concl ? 'line-through text-gray-400' : ''}`}>
              {t.title}
            </span>
            <button onClick={e => { e.stopPropagation(); closeTaskTab(t.id) }}
              title="Fechar aba"
              className="w-4 h-4 flex items-center justify-center rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 flex-shrink-0 transition-colors">
              <X size={11}/>
            </button>
          </div>
        )
      })}
      {abas.length > 1 && (
        <button onClick={closeAllTaskTabs}
          title="Fechar todas as abas"
          className="text-[11px] font-medium text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 flex-shrink-0 transition-colors">
          Fechar todas
        </button>
      )}
    </div>
  )
}
