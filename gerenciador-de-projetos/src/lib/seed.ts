import type { Project, Task } from '../types'

export const SEED_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Lançamento v2.0',
    color: '#6B5EE8',
    description: 'Nova versão do produto com redesign completo e melhorias de performance.',
    gut: { g: 5, u: 5, t: 4, score: 100 },
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  },
  {
    id: 'p2',
    name: 'Suporte ao Cliente',
    color: '#1D9E75',
    description: 'Gestão de tickets, SLA e melhorias no atendimento.',
    gut: { g: 3, u: 4, t: 3, score: 36 },
    createdAt: '2026-05-10T00:00:00Z',
    updatedAt: '2026-05-10T00:00:00Z',
  },
  {
    id: 'p3',
    name: 'Marketing Q3',
    color: '#D85A30',
    description: 'Campanhas digitais e materiais para o terceiro trimestre.',
    gut: { g: 3, u: 3, t: 2, score: 18 },
    createdAt: '2026-05-15T00:00:00Z',
    updatedAt: '2026-05-15T00:00:00Z',
  },
  {
    id: 'p4',
    name: 'Infraestrutura',
    color: '#888780',
    description: 'Migração de servidores e atualização de dependências críticas.',
    gut: { g: 4, u: 2, t: 4, score: 32 },
    createdAt: '2026-05-20T00:00:00Z',
    updatedAt: '2026-05-20T00:00:00Z',
  },
]

export const SEED_TASKS: Task[] = [
  {
    id: 't1', projectId: 'p1', title: 'Revisar arquitetura do Firebase', description: 'Avaliar a estrutura de coleções do Firestore para garantir performance ótima e menor custo de leituras.',
    status: 'in_progress', priority: 'urgent', dueDate: '2026-06-02', assignee: 'DJ', tags: ['Dev', 'Firebase'],
    subtasks: [
      { id: 'st1', title: 'Mapear entidades e relacionamentos', done: true },
      { id: 'st2', title: 'Definir regras de segurança', done: true },
      { id: 'st3', title: 'Testar performance com 10k docs', done: false },
      { id: 'st4', title: 'Revisar índices compostos', done: false },
    ],
    createdAt: '2026-05-28T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 't2', projectId: 'p1', title: 'Criar componentes base do design system', description: 'Botões, inputs, badges e cards reutilizáveis.',
    status: 'in_progress', priority: 'high', dueDate: '2026-06-05', assignee: 'MC', tags: ['Design'],
    subtasks: [], createdAt: '2026-05-29T00:00:00Z', updatedAt: '2026-05-29T00:00:00Z',
  },
  {
    id: 't3', projectId: 'p4', title: 'Configurar CI/CD pipeline no GitHub Actions', description: '',
    status: 'in_progress', priority: 'medium', dueDate: '2026-06-07', assignee: 'TR', tags: ['Infra'],
    subtasks: [], createdAt: '2026-05-30T00:00:00Z', updatedAt: '2026-05-30T00:00:00Z',
  },
  {
    id: 't4', projectId: 'p1', title: 'Escrever testes de integração para autenticação', description: '',
    status: 'todo', priority: 'high', dueDate: '2026-06-10', assignee: 'DJ', tags: ['Dev'],
    subtasks: [], createdAt: '2026-05-30T00:00:00Z', updatedAt: '2026-05-30T00:00:00Z',
  },
  {
    id: 't5', projectId: 'p1', title: 'Documentar API de webhooks', description: '',
    status: 'todo', priority: 'medium', dueDate: '2026-06-12', assignee: 'MC', tags: ['Docs'],
    subtasks: [], createdAt: '2026-05-31T00:00:00Z', updatedAt: '2026-05-31T00:00:00Z',
  },
  {
    id: 't6', projectId: 'p3', title: 'Montar fluxo de onboarding de novos usuários', description: '',
    status: 'todo', priority: 'medium', dueDate: '2026-06-14', assignee: 'RS', tags: ['UX'],
    subtasks: [], createdAt: '2026-05-31T00:00:00Z', updatedAt: '2026-05-31T00:00:00Z',
  },
  {
    id: 't7', projectId: 'p2', title: 'Revisar contratos de fornecedores para Q3', description: '',
    status: 'todo', priority: 'low', dueDate: '2026-06-18', assignee: 'TR', tags: ['Legal'],
    subtasks: [], createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 't8', projectId: 'p2', title: 'Treinar equipe no novo sistema de tickets', description: '',
    status: 'todo', priority: 'medium', dueDate: '2026-06-20', assignee: 'DJ', tags: ['Suporte'],
    subtasks: [], createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 't9', projectId: 'p1', title: 'Definir stack tecnológico do projeto', description: '',
    status: 'done', priority: 'high', dueDate: '2026-05-28', assignee: 'DJ', tags: ['Dev'],
    subtasks: [], createdAt: '2026-05-25T00:00:00Z', updatedAt: '2026-05-28T00:00:00Z',
  },
  {
    id: 't10', projectId: 'p1', title: 'Criar repositório e estrutura inicial', description: '',
    status: 'done', priority: 'high', dueDate: '2026-05-29', assignee: 'DJ', tags: ['Dev'],
    subtasks: [], createdAt: '2026-05-25T00:00:00Z', updatedAt: '2026-05-29T00:00:00Z',
  },
  {
    id: 't11', projectId: 'p3', title: 'Briefing de campanha de lançamento', description: '',
    status: 'todo', priority: 'high', dueDate: '2026-06-08', assignee: 'RS', tags: ['Marketing'],
    subtasks: [], createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 't12', projectId: 'p4', title: 'Atualizar dependências críticas do servidor', description: '',
    status: 'todo', priority: 'urgent', dueDate: '2026-06-05', assignee: 'TR', tags: ['Infra', 'Segurança'],
    subtasks: [], createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
  },
]
