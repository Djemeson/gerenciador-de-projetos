import type { Project, Task } from '../types'

export const SEED_PROJECTS: Project[] = [
  { id:'p1', name:'Lançamento v2.0',    color:'#6B5EE8', description:'Nova versão com redesign e melhorias de performance.', gut:{g:5,u:5,t:4,score:100}, createdAt:'2026-05-01T00:00:00Z', updatedAt:'2026-05-01T00:00:00Z' },
  { id:'p2', name:'Suporte ao Cliente', color:'#1D9E75', description:'Gestão de tickets, SLA e melhorias no atendimento.',      gut:{g:3,u:4,t:3,score:36},  createdAt:'2026-05-10T00:00:00Z', updatedAt:'2026-05-10T00:00:00Z' },
  { id:'p3', name:'Marketing Q3',       color:'#D85A30', description:'Campanhas digitais para o terceiro trimestre.',           gut:{g:3,u:3,t:2,score:18},  createdAt:'2026-05-15T00:00:00Z', updatedAt:'2026-05-15T00:00:00Z' },
  { id:'p4', name:'Infraestrutura',     color:'#888780', description:'Migração de servidores e atualização de dependências.',   gut:{g:4,u:2,t:4,score:32},  createdAt:'2026-05-20T00:00:00Z', updatedAt:'2026-05-20T00:00:00Z' },
]

const base = { parentId: null, description: '', content: '', attachments: [], checklists: [] }

export const SEED_TASKS: Task[] = [
  { ...base, id:'t1',  projectId:'p1', title:'Revisar arquitetura do Firebase',           status:'in_progress', priority:'urgent', dueDate:'2026-06-02', assignee:'DJ',  tags:['Dev','Firebase'], createdAt:'2026-05-28T00:00:00Z', updatedAt:'2026-06-01T00:00:00Z' },
  { ...base, id:'t2',  projectId:'p1', title:'Criar componentes base do design system',   status:'in_progress', priority:'high',   dueDate:'2026-06-05', assignee:'MC',  tags:['Design'],         createdAt:'2026-05-29T00:00:00Z', updatedAt:'2026-05-29T00:00:00Z' },
  { ...base, id:'t3',  projectId:'p4', title:'Configurar CI/CD pipeline',                 status:'in_progress', priority:'medium', dueDate:'2026-06-07', assignee:'TR',  tags:['Infra'],          createdAt:'2026-05-30T00:00:00Z', updatedAt:'2026-05-30T00:00:00Z' },
  { ...base, id:'t4',  projectId:'p1', title:'Escrever testes de integração',              status:'todo',        priority:'high',   dueDate:'2026-06-10', assignee:'DJ',  tags:['Dev'],            createdAt:'2026-05-30T00:00:00Z', updatedAt:'2026-05-30T00:00:00Z' },
  { ...base, id:'t5',  projectId:'p1', title:'Documentar API de webhooks',                status:'todo',        priority:'medium', dueDate:'2026-06-12', assignee:'MC',  tags:['Docs'],           createdAt:'2026-05-31T00:00:00Z', updatedAt:'2026-05-31T00:00:00Z' },
  { ...base, id:'t6',  projectId:'p3', title:'Montar fluxo de onboarding',                status:'todo',        priority:'medium', dueDate:'2026-06-14', assignee:'RS',  tags:['UX'],             createdAt:'2026-05-31T00:00:00Z', updatedAt:'2026-05-31T00:00:00Z' },
  { ...base, id:'t7',  projectId:'p2', title:'Revisar contratos de fornecedores',          status:'todo',        priority:'low',    dueDate:'2026-06-18', assignee:'TR',  tags:['Legal'],          createdAt:'2026-06-01T00:00:00Z', updatedAt:'2026-06-01T00:00:00Z' },
  { ...base, id:'t8',  projectId:'p2', title:'Treinar equipe no novo sistema de tickets',  status:'todo',        priority:'medium', dueDate:'2026-06-20', assignee:'DJ',  tags:['Suporte'],        createdAt:'2026-06-01T00:00:00Z', updatedAt:'2026-06-01T00:00:00Z' },
  { ...base, id:'t9',  projectId:'p1', title:'Definir stack tecnológico',                  status:'done',        priority:'high',   dueDate:'2026-05-28', assignee:'DJ',  tags:['Dev'],            createdAt:'2026-05-25T00:00:00Z', updatedAt:'2026-05-28T00:00:00Z' },
  { ...base, id:'t10', projectId:'p1', title:'Criar repositório e estrutura inicial',      status:'done',        priority:'high',   dueDate:'2026-05-29', assignee:'DJ',  tags:['Dev'],            createdAt:'2026-05-25T00:00:00Z', updatedAt:'2026-05-29T00:00:00Z' },
  { ...base, id:'t11', projectId:'p3', title:'Briefing de campanha de lançamento',          status:'todo',        priority:'high',   dueDate:'2026-06-08', assignee:'RS',  tags:['Marketing'],      createdAt:'2026-06-01T00:00:00Z', updatedAt:'2026-06-01T00:00:00Z' },
  { ...base, id:'t12', projectId:'p4', title:'Atualizar dependências críticas do servidor', status:'todo',        priority:'urgent', dueDate:'2026-06-05', assignee:'TR',  tags:['Infra','Segurança'], createdAt:'2026-06-01T00:00:00Z', updatedAt:'2026-06-01T00:00:00Z' },
]
