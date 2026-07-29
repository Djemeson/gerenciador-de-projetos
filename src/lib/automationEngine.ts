// Regras das automações: quem dispara, quando dispara e como isso vira uma frase legível.
// Fica fora do store porque é a parte que precisa ser conferida com calma — e porque a
// tela precisa das mesmas funções para descrever a regra antes de salvá-la.
import type {
  Automation, AutomationTrigger, AutomationAction, Task, TriggerType, ActionType,
  Priority, TaskStatus, Project,
} from '../types'
import { ANY, STATUS_LABEL, PRIORITY_LABEL } from '../types'

export const TRIGGER_LABEL: Record<TriggerType, string> = {
  task_created:     'Tarefa criada',
  status_changed:   'Status alterado',
  priority_changed: 'Prioridade alterada',
  assignee_changed: 'Responsável alterado',
  due_date_reached: 'Prazo chegando',
}

export const ACTION_LABEL: Record<ActionType, string> = {
  change_status:   'Mudar status',
  change_priority: 'Mudar prioridade',
  assign:          'Atribuir a',
  add_tag:         'Aplicar etiqueta',
  set_due_date:    'Definir prazo',
  move_project:    'Mover para projeto',
  add_comment:     'Comentar na tarefa',
  notify:          'Enviar notificação',
  ai_enrich:       'Gerar resumo com IA',
}

/** Ações que alteram a tarefa — usadas para detectar risco de disparo em cadeia. */
export const MUTATING_ACTIONS: ActionType[] = ['change_status', 'change_priority', 'assign', 'add_tag', 'set_due_date', 'move_project']

// ── Correspondência ──────────────────────────────────────────────────────────

interface MatchContext { task: Task; prev?: Partial<Task> }

/** Compara um valor contra a condição; `ANY`, vazio ou ausente aceitam qualquer coisa. */
function condMatches(cond: string | undefined, value: string | undefined): boolean {
  if (!cond || cond === ANY) return true
  return (value ?? '') === cond
}

/** Valor observado pelo gatilho, por tipo — o que "mudou de X para Y". */
function observedValues(type: TriggerType, { task, prev }: MatchContext): { from?: string; to?: string } {
  switch (type) {
    case 'status_changed':   return { from: prev?.status,   to: task.status }
    case 'priority_changed': return { from: prev?.priority, to: task.priority }
    case 'assignee_changed': return { from: prev?.assignee, to: task.assignee }
    default: return {}
  }
}

/** A automação vale para esta tarefa? (escopo de projeto + condições do gatilho) */
export function matchesTrigger(automation: Automation, type: TriggerType, ctx: MatchContext): boolean {
  const { trigger, projectId } = automation
  if (trigger.type !== type) return false
  if (projectId !== ANY && projectId !== ctx.task.projectId) return false
  if (trigger.tag && !ctx.task.tags.includes(trigger.tag)) return false
  if (trigger.priority && ctx.task.priority !== trigger.priority) return false

  const { from, to } = observedValues(type, ctx)
  return condMatches(trigger.from, from) && condMatches(trigger.to, to)
}

// ── Descrição legível ───────────────────────────────────────────────────────

function valueLabel(kind: 'status' | 'priority' | 'text', value: unknown): string {
  const v = String(value ?? '')
  if (!v || v === ANY) return 'qualquer'
  if (kind === 'status')   return STATUS_LABEL[v as TaskStatus] ?? v
  if (kind === 'priority') return PRIORITY_LABEL[v as Priority] ?? v
  return v
}

export function describeTrigger(trigger: AutomationTrigger): string {
  const extras: string[] = []
  if (trigger.tag)      extras.push(`com etiqueta "${trigger.tag}"`)
  if (trigger.priority) extras.push(`prioridade ${PRIORITY_LABEL[trigger.priority]}`)
  const suffix = extras.length ? ` (${extras.join(', ')})` : ''

  const kind = trigger.type === 'status_changed' ? 'status' : trigger.type === 'priority_changed' ? 'priority' : 'text'
  const to   = valueLabel(kind as any, trigger.to)
  const from = valueLabel(kind as any, trigger.from)

  switch (trigger.type) {
    case 'task_created':     return `uma tarefa for criada${suffix}`
    case 'due_date_reached': return trigger.daysBefore && trigger.daysBefore > 0
      ? `faltarem ${trigger.daysBefore} dia(s) para o prazo${suffix}`
      : `o prazo chegar${suffix}`
    case 'status_changed':
      return to === 'qualquer'
        ? `o status mudar${suffix}`
        : from === 'qualquer' ? `o status virar ${to}${suffix}` : `o status for de ${from} para ${to}${suffix}`
    case 'priority_changed':
      return to === 'qualquer' ? `a prioridade mudar${suffix}` : `a prioridade virar ${to}${suffix}`
    case 'assignee_changed':
      return to === 'qualquer' ? `o responsável mudar${suffix}` : `o responsável virar ${to}${suffix}`
  }
}

export function describeAction(action: AutomationAction, projects: Project[] = []): string {
  const v = action.value
  switch (action.type) {
    case 'change_status':   return `mudar o status para ${valueLabel('status', v)}`
    case 'change_priority': return `mudar a prioridade para ${valueLabel('priority', v)}`
    case 'assign':          return `atribuir a ${String(v || '—')}`
    case 'add_tag':         return `aplicar a etiqueta "${String(v || '')}"`
    case 'set_due_date':    return `definir o prazo para daqui a ${Number(v || 0)} dia(s)`
    case 'move_project':    return `mover para ${projects.find(p => p.id === v)?.name ?? 'outro projeto'}`
    case 'add_comment':     return `comentar "${String(v || '')}"`
    case 'notify':          return `notificar "${String(v || '')}"`
    case 'ai_enrich':       return 'gerar o resumo de conclusão com IA'
  }
}

/** Frase completa da regra, usada no card e na pré-visualização do editor. */
export function describeAutomation(a: Automation, projects: Project[] = []): string {
  return `Quando ${describeTrigger(a.trigger)}, ${describeAction(a.action, projects)}.`
}

// ── Receitas prontas ────────────────────────────────────────────────────────

export interface Recipe {
  id: string
  name: string
  purpose: string          // por que ela existe, em linguagem de quem usa
  trigger: AutomationTrigger
  action: AutomationAction
}

/**
 * Receitas com caso de uso real (a lista antiga tinha exemplos que não funcionavam, como
 * "iniciar ao criar" mudando o status para o mesmo valor que a tarefa já nasce).
 */
export const RECIPES: Recipe[] = [
  {
    id: 'urgente-topo',
    name: 'Urgente entra em progresso',
    purpose: 'Tarefa marcada como urgente já sai da fila e vira trabalho em andamento.',
    trigger: { type: 'priority_changed', to: 'urgent' },
    action:  { type: 'change_status', value: 'in_progress' },
  },
  {
    id: 'prazo-perto',
    name: 'Aviso 2 dias antes do prazo',
    purpose: 'Lembrete na caixa de notificações antes de a tarefa atrasar.',
    trigger: { type: 'due_date_reached', daysBefore: 2 },
    action:  { type: 'notify', value: 'Prazo chegando' },
  },
  {
    id: 'concluida-resumo',
    name: 'Resumo ao concluir',
    purpose: 'Ao concluir, a IA escreve o resumo do que foi feito a partir das subtarefas.',
    trigger: { type: 'status_changed', to: 'done' },
    action:  { type: 'ai_enrich' },
  },
  {
    id: 'nova-triagem',
    name: 'Marcar novas para triagem',
    purpose: 'Toda tarefa nova nasce etiquetada, para você revisar em lote depois.',
    trigger: { type: 'task_created' },
    action:  { type: 'add_tag', value: 'triagem' },
  },
  {
    id: 'em-progresso-prazo',
    name: 'Prazo automático ao iniciar',
    purpose: 'Ao entrar em progresso sem prazo definido, ganha uma semana.',
    trigger: { type: 'status_changed', to: 'in_progress' },
    action:  { type: 'set_due_date', value: 7 },
  },
  {
    id: 'atribuida-avisa',
    name: 'Avisar quando alguém assume',
    purpose: 'Notificação quando o responsável de uma tarefa muda.',
    trigger: { type: 'assignee_changed' },
    action:  { type: 'notify', value: 'Responsável alterado' },
  },
]
