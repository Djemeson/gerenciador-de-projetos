import type { Task, Project, TaskStatus, Priority, TaskType } from '../types'
import { PROJECT_COLORS } from '../types'

// ── Ferramentas que a IA do "Pergunte à IA" pode executar de verdade sobre os
// dados do workspace — não é mais "gerar um JSON de tarefa e torcer para dar
// parse certo": é um esquema de function-calling real (formato OpenAI), com
// um executor que resolve nomes de projeto/tarefa por busca aproximada e
// chama as mesmas ações do store usadas pelo resto do app. ──────────────────

export interface ToolCtx {
  tasks: Task[]
  projects: Project[]
  activeWorkspaceId: string
  addTask: (task: Omit<Task, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>) => Task
  quickAddTask: (title: string, projectId: string, status: TaskStatus, parentId?: string) => Task
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  addChecklist: (taskId: string, title: string, customId?: string) => void
  addChecklistItem: (taskId: string, checklistId: string, text: string, customId?: string) => void
  addProject: (name: string, color: string, desc: string) => Project
}

export interface ToolResult {
  forModel: string     // enviado de volta ao modelo como resultado da função
  summary: string      // linha curta exibida no chat como card de ação
  kind: 'success' | 'info' | 'warning' | 'error'
  pendingConfirm?: { kind: 'delete_task'; taskId: string; title: string }
}

// ── Definições (esquema OpenAI function-calling) ────────────────────────────
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_projects',
      description: 'Lista os projetos ativos do workspace com pontuação GUT e contagem de tarefas. Use para descobrir nomes/ids de projeto antes de criar ou buscar tarefas.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'Busca tarefas do workspace com filtros. Use para responder perguntas sobre tarefas existentes (atrasadas, urgentes, de um projeto, etc.) antes de responder ao usuário.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Nome (ou parte do nome) do projeto para filtrar' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'all'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          assignee: { type: 'string' },
          overdueOnly: { type: 'boolean', description: 'Só tarefas com prazo vencido e não concluídas' },
          limit: { type: 'number', description: 'Máximo de resultados (padrão 25)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Cria uma nova tarefa em um projeto existente.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          projectName: { type: 'string', description: 'Nome do projeto onde criar a tarefa. Se omitido, usa o primeiro projeto ativo.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          dueDate: { type: 'string', description: 'Data no formato AAAA-MM-DD' },
          assignee: { type: 'string' },
          taskType: { type: 'string', enum: ['task', 'milestone', 'bug', 'goal', 'objective', 'request'] },
          description: { type: 'string' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Atualiza campos de uma tarefa existente (status, prioridade, prazo, responsável, título).',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string', description: 'Título (ou parte dele) da tarefa a atualizar' },
          projectName: { type: 'string', description: 'Nome do projeto, para desambiguar se houver tarefas com título parecido em projetos diferentes' },
          newTitle: { type: 'string' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          dueDate: { type: 'string', description: 'AAAA-MM-DD, ou "null" para remover o prazo' },
          assignee: { type: 'string' },
        },
        required: ['taskTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Marca uma tarefa como concluída.',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string' },
          projectName: { type: 'string' },
        },
        required: ['taskTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_subtask',
      description: 'Cria uma subtarefa dentro de uma tarefa existente.',
      parameters: {
        type: 'object',
        properties: {
          parentTaskTitle: { type: 'string' },
          projectName: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['parentTaskTitle', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_checklist_item',
      description: 'Adiciona um item de checklist a uma tarefa (cria o checklist se a tarefa ainda não tiver um).',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string' },
          projectName: { type: 'string' },
          item: { type: 'string' },
        },
        required: ['taskTitle', 'item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_project',
      description: 'Cria um novo projeto vazio.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Exclui uma tarefa. Ação destrutiva — sempre pede confirmação do usuário antes de executar de fato.',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string' },
          projectName: { type: 'string' },
        },
        required: ['taskTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_summary',
      description: 'Retorna um resumo agregado (total, concluídas, atrasadas, urgentes, % de conclusão) do workspace inteiro ou de um projeto específico.',
      parameters: {
        type: 'object',
        properties: { projectName: { type: 'string' } },
        required: [],
      },
    },
  },
] as const

export type ToolName = typeof AI_TOOLS[number]['function']['name']

// ── Resolução aproximada de projeto/tarefa por nome ─────────────────────────
function norm(s: string): string { return s.toLowerCase().trim() }

function findProject(projects: Project[], name?: string): Project | undefined {
  if (!name) return undefined
  const n = norm(name)
  return projects.find(p => norm(p.name) === n) ?? projects.find(p => norm(p.name).includes(n) || n.includes(norm(p.name)))
}

function findTasks(tasks: Task[], title: string, projectId?: string): Task[] {
  const n = norm(title)
  const pool = projectId ? tasks.filter(t => t.projectId === projectId) : tasks
  const exact = pool.filter(t => norm(t.title) === n)
  if (exact.length) return exact
  return pool.filter(t => norm(t.title).includes(n))
}

function fmtTask(t: Task, projects: Project[]): string {
  const p = projects.find(pr => pr.id === t.projectId)
  return `"${t.title}" [${t.status}${t.priority !== 'medium' ? `, ${t.priority}` : ''}${t.dueDate ? `, prazo ${t.dueDate}` : ''}] — projeto: ${p?.name ?? '—'}`
}

/** Executa uma ferramenta chamada pelo modelo. Nunca lança — sempre devolve um
 *  ToolResult (mesmo em erro), para o loop de function-calling seguir normalmente. */
export function executeTool(name: ToolName, rawArgs: string, ctx: ToolCtx): ToolResult {
  let args: any = {}
  try { args = JSON.parse(rawArgs || '{}') } catch { /* args inválidos — segue com {} */ }

  // '__all__' = escopo global (todos os workspaces) — usado quando o usuário remove o
  // chip do workspace atual no painel de IA. Senão, filtra pelo workspace ativo.
  const allScope = ctx.activeWorkspaceId === '__all__'
  const workspaceProjects = ctx.projects.filter(p => (allScope || p.workspaceId === ctx.activeWorkspaceId) && !p.archived)
  const workspaceTasks = ctx.tasks.filter(t => allScope || t.workspaceId === ctx.activeWorkspaceId)

  switch (name) {
    case 'list_projects': {
      if (workspaceProjects.length === 0) return { kind: 'info', forModel: 'Nenhum projeto ativo.', summary: 'Nenhum projeto ativo' }
      const lines = workspaceProjects.map(p => {
        const pt = workspaceTasks.filter(t => t.projectId === p.id && !t.parentId)
        const done = pt.filter(t => t.status === 'done').length
        return `- ${p.name} (GUT ${p.gut.score}, ${done}/${pt.length} concluídas)`
      })
      return { kind: 'info', forModel: lines.join('\n'), summary: `${workspaceProjects.length} projetos consultados` }
    }

    case 'list_tasks': {
      const proj = findProject(workspaceProjects, args.projectName)
      let pool = proj ? workspaceTasks.filter(t => t.projectId === proj.id) : workspaceTasks
      if (args.status && args.status !== 'all') pool = pool.filter(t => t.status === args.status)
      if (args.priority) pool = pool.filter(t => t.priority === args.priority)
      if (args.assignee) pool = pool.filter(t => norm(t.assignee).includes(norm(args.assignee)))
      if (args.overdueOnly) pool = pool.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date())
      pool = pool.filter(t => !t.parentId)
      const limit = typeof args.limit === 'number' ? args.limit : 25
      const shown = pool.slice(0, limit)
      if (shown.length === 0) return { kind: 'info', forModel: 'Nenhuma tarefa encontrada com esses filtros.', summary: 'Nenhuma tarefa encontrada' }
      return {
        kind: 'info',
        forModel: shown.map(t => fmtTask(t, workspaceProjects)).join('\n') + (pool.length > shown.length ? `\n(+${pool.length - shown.length} outras)` : ''),
        summary: `${pool.length} tarefa(s) consultada(s)`,
      }
    }

    case 'create_task': {
      if (!args.title) return { kind: 'error', forModel: 'Faltou o título da tarefa.', summary: 'Falha ao criar tarefa' }
      const proj = findProject(workspaceProjects, args.projectName) ?? workspaceProjects[0]
      if (!proj) return { kind: 'error', forModel: 'Não há nenhum projeto no workspace para criar a tarefa.', summary: 'Nenhum projeto disponível' }
      const validTypes: TaskType[] = ['task', 'milestone', 'bug', 'goal', 'objective', 'request']
      const created = ctx.addTask({
        projectId: proj.id, parentId: null, title: String(args.title).trim(),
        description: '', blocks: args.description ? [{ id: cryptoRandom(), type: 'text', text: escapeHtml(args.description) }] : [],
        status: 'todo',
        priority: (['low', 'medium', 'high', 'urgent'] as Priority[]).includes(args.priority) ? args.priority : 'medium',
        taskType: validTypes.includes(args.taskType) ? args.taskType : 'task',
        dueDate: args.dueDate && args.dueDate !== 'null' ? args.dueDate : null,
        assignee: args.assignee ?? '', tags: [], checklists: [], customFields: {}, comments: [],
      })
      return { kind: 'success', forModel: `Tarefa "${created.title}" criada no projeto ${proj.name}.`, summary: `Tarefa criada: ${created.title}` }
    }

    case 'update_task':
    case 'complete_task': {
      if (!args.taskTitle) return { kind: 'error', forModel: 'Faltou o título da tarefa.', summary: 'Falha ao atualizar tarefa' }
      const proj = findProject(workspaceProjects, args.projectName)
      const matches = findTasks(workspaceTasks, args.taskTitle, proj?.id)
      if (matches.length === 0) return { kind: 'error', forModel: `Nenhuma tarefa encontrada com o título "${args.taskTitle}".`, summary: 'Tarefa não encontrada' }
      if (matches.length > 1) {
        return {
          kind: 'warning',
          forModel: `Mais de uma tarefa corresponde a "${args.taskTitle}": ${matches.map(t => fmtTask(t, workspaceProjects)).join('; ')}. Peça ao usuário para especificar o projeto.`,
          summary: 'Título ambíguo — mais de uma tarefa encontrada',
        }
      }
      const task = matches[0]
      const patch: Partial<Task> = {}
      if (name === 'complete_task') {
        patch.status = 'done'
      } else {
        if (args.newTitle) patch.title = args.newTitle
        if (args.status) patch.status = args.status
        if (args.priority) patch.priority = args.priority
        if (args.assignee !== undefined) patch.assignee = args.assignee
        if (args.dueDate !== undefined) patch.dueDate = args.dueDate === 'null' ? null : args.dueDate
      }
      ctx.updateTask(task.id, patch)
      return { kind: 'success', forModel: `Tarefa "${task.title}" atualizada.`, summary: `Tarefa atualizada: ${task.title}` }
    }

    case 'create_subtask': {
      if (!args.parentTaskTitle || !args.title) return { kind: 'error', forModel: 'Faltou o título da tarefa-mãe ou da subtarefa.', summary: 'Falha ao criar subtarefa' }
      const proj = findProject(workspaceProjects, args.projectName)
      const matches = findTasks(workspaceTasks, args.parentTaskTitle, proj?.id)
      if (matches.length !== 1) return { kind: 'error', forModel: matches.length === 0 ? 'Tarefa-mãe não encontrada.' : 'Mais de uma tarefa corresponde ao título — peça para especificar o projeto.', summary: 'Tarefa-mãe não localizada' }
      const parent = matches[0]
      const sub = ctx.quickAddTask(String(args.title).trim(), parent.projectId, 'todo', parent.id)
      return { kind: 'success', forModel: `Subtarefa "${sub.title}" criada em "${parent.title}".`, summary: `Subtarefa criada: ${sub.title}` }
    }

    case 'add_checklist_item': {
      if (!args.taskTitle || !args.item) return { kind: 'error', forModel: 'Faltou o título da tarefa ou o item.', summary: 'Falha ao adicionar item' }
      const proj = findProject(workspaceProjects, args.projectName)
      const matches = findTasks(workspaceTasks, args.taskTitle, proj?.id)
      if (matches.length !== 1) return { kind: 'error', forModel: matches.length === 0 ? 'Tarefa não encontrada.' : 'Mais de uma tarefa corresponde ao título — peça para especificar o projeto.', summary: 'Tarefa não localizada' }
      const task = matches[0]
      let clId = task.checklists[0]?.id
      if (!clId) { clId = cryptoRandom(); ctx.addChecklist(task.id, 'Checklist', clId) }
      ctx.addChecklistItem(task.id, clId, String(args.item).trim(), cryptoRandom())
      return { kind: 'success', forModel: `Item "${args.item}" adicionado ao checklist de "${task.title}".`, summary: `Item de checklist adicionado a: ${task.title}` }
    }

    case 'create_project': {
      if (!args.name) return { kind: 'error', forModel: 'Faltou o nome do projeto.', summary: 'Falha ao criar projeto' }
      const created = ctx.addProject(String(args.name).trim(), PROJECT_COLORS[0], args.description ?? '')
      return { kind: 'success', forModel: `Projeto "${created.name}" criado.`, summary: `Projeto criado: ${created.name}` }
    }

    case 'delete_task': {
      if (!args.taskTitle) return { kind: 'error', forModel: 'Faltou o título da tarefa.', summary: 'Falha ao excluir tarefa' }
      const proj = findProject(workspaceProjects, args.projectName)
      const matches = findTasks(workspaceTasks, args.taskTitle, proj?.id)
      if (matches.length !== 1) {
        return { kind: 'error', forModel: matches.length === 0 ? 'Tarefa não encontrada.' : 'Mais de uma tarefa corresponde ao título — peça para especificar o projeto.', summary: 'Tarefa não localizada' }
      }
      const task = matches[0]
      return {
        kind: 'warning',
        forModel: `Exclusão de "${task.title}" está pendente de confirmação do usuário na interface — não informe que já foi excluída.`,
        summary: `Confirmação pendente para excluir: ${task.title}`,
        pendingConfirm: { kind: 'delete_task', taskId: task.id, title: task.title },
      }
    }

    case 'get_summary': {
      const proj = findProject(workspaceProjects, args.projectName)
      const pool = (proj ? workspaceTasks.filter(t => t.projectId === proj.id) : workspaceTasks).filter(t => !t.parentId)
      const done = pool.filter(t => t.status === 'done').length
      const overdue = pool.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date()).length
      const urgent = pool.filter(t => t.priority === 'urgent' && t.status !== 'done').length
      const pct = pool.length ? Math.round((done / pool.length) * 100) : 0
      return {
        kind: 'info',
        forModel: `${proj ? `Projeto ${proj.name}` : 'Workspace inteiro'}: ${pool.length} tarefas, ${done} concluídas (${pct}%), ${overdue} atrasadas, ${urgent} urgentes.`,
        summary: 'Resumo consultado',
      }
    }

    default:
      return { kind: 'error', forModel: `Ferramenta desconhecida: ${name}`, summary: 'Ferramenta desconhecida' }
  }
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
