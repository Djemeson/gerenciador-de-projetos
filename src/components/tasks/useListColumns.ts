import { useMemo, useState } from 'react'
import type { ColumnDef, ListColumn, Task } from '../../types'
import { useAppStore } from '../../stores/useAppStore'
import {
  buildColumns, loadSort, saveSort, loadOrder, saveOrder, loadLabels, saveLabels,
  loadWidths, saveWidths, sortTasks, type ColumnSort,
} from '../../lib/taskColumns'

/** Agrupamento → chave da coluna que ele torna redundante. `status` não tem coluna. */
const COLUNA_DO_AGRUPAMENTO: Record<string, string | undefined> = {
  priority: 'priority',
  dueDate:  'dueDate',
  assignee: 'assignee',
  project:  'project',
}

/**
 * Colunas de uma lista de tarefas: visibilidade, ordem, rótulo, largura e ordenação —
 * tudo salvo por escopo (`lib/taskColumns.ts`).
 *
 * Existe porque **quem lista tarefas não pode reimplementar isso**. A caixa de entrada
 * cravava as colunas no JSX e por isso ignorava calado tudo que o usuário configurava no
 * modal de colunas: ligar "Status", esconder "Tags", renomear, arrastar, redimensionar.
 * Agora ela e a `TaskList` leem daqui, então configurar numa tela vale na outra.
 *
 * `groupBy` some com a coluna do campo agrupado: se o cabeçalho do grupo já diz "Alta",
 * repetir isso em cada linha é ruído e rouba largura de quem ainda informa algo.
 */
export function useListColumns(scope: string, columns: ColumnDef[], showProject: boolean, groupBy?: string) {
  const columnsVersion = useAppStore(s => s.columnsVersion)
  const [sort,    setSort]    = useState<ColumnSort | null>(() => loadSort(scope))
  const [version, setVersion] = useState(0)

  const orderedColumns = useMemo(() => {
    const todas = buildColumns(scope, columns, showProject)
    const redundante = groupBy ? COLUNA_DO_AGRUPAMENTO[groupBy] : undefined
    return redundante ? todas.filter(c => c.key !== redundante) : todas
  }, [scope, columns, showProject, groupBy, version, columnsVersion])

  // Clicar no cabeçalho percorre crescente → decrescente → sem ordenação.
  const onSort = (key: string) => {
    setSort(prev => {
      const next: ColumnSort | null =
        !prev || prev.key !== key ? { key, dir: 'asc' }
        : prev.dir === 'asc'      ? { key, dir: 'desc' }
        : null
      saveSort(scope, next)
      return next
    })
  }

  const onReorder = (fromKey: string, toKey: string) => {
    const keys = orderedColumns.map(c => c.key)
    const from = keys.indexOf(fromKey), to = keys.indexOf(toKey)
    if (from < 0 || to < 0) return
    keys.splice(to, 0, keys.splice(from, 1)[0])
    saveOrder(scope, keys); setVersion(v => v + 1)
  }

  const onRename = (key: string, label: string) => {
    const labels = loadLabels(scope); labels[key] = label
    saveLabels(scope, labels); setVersion(v => v + 1)
  }

  const onResize = (key: string, width: number) => {
    const widths = loadWidths(scope); widths[key] = width
    saveWidths(scope, widths); setVersion(v => v + 1)
  }

  return {
    orderedColumns,
    sort,
    /** Aplica a ordenação escolhida no cabeçalho; devolve a lista intacta quando não há. */
    ordenar: (lista: Task[]): Task[] => sortTasks(lista, sort),
    /** Passa direto para o `ColumnHeaders` — evita repetir a fiação em cada tela. */
    headerProps: { orderedColumns, sort, onSort, onReorder, onRename, onResize } as const,
  }
}
