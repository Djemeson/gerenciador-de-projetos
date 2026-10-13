import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Flag, MapPin, Navigation, Diamond, Check, ChevronRight, Plus, ArrowRight, CornerDownRight, Sparkles,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { montarJornada, type MarcoDaJornada } from '../../lib/jornada'
import { TYPE_ICON } from '../../lib/taskTypeIcons'
import { estaAtrasada, formatarPrazo } from '../../lib/dueDate'
import { STATUS_COLOR } from '../../types'
import type { Task } from '../../types'
import { IdCurto } from '../ui/IdCurto'
import { AssigneeAvatar } from '../ui/AssigneeAvatar'
import { DueDatePicker } from '../ui/DueDatePicker'

/**
 * Visão "Marcos" (jornada do projeto) — DIRETRIZES, seção 4.12.
 *
 * As outras visões mostram **o que existe**; esta mostra **o caminho**: os marcos viram
 * estações de uma trilha (de onde veio → onde está → para onde vai), e cada marco abre as
 * próprias tarefas embaixo. A regra de ordem e de "marco atual" mora em `lib/jornada.ts`.
 *
 * Organizar é por arraste: soltar uma tarefa sobre um marco a coloca dentro dele (vira
 * subtarefa); soltar em "Fora dos marcos" a devolve ao nível principal.
 */

const COR_FEITO = STATUS_COLOR.done
const ARRASTE = 'taskId'   // mesmo canal do Board, para não haver dois formatos

const fmtCurta = (iso: string) => formatarPrazo(iso.slice(0, 10))
const fmtLonga = (iso: string) => formatarPrazo(iso.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })

export function JornadaView({ tasks, accent, projectId }: { tasks: Task[]; accent: string; projectId?: string }) {
  const { updateTask, quickAddTask, setSelectedTask } = useAppStore()
  const jornada = useMemo(() => montarJornada(tasks), [tasks])
  const { marcos, atualIdx, semMarco } = jornada

  const porId = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks])
  const filhasDe = useMemo(() => {
    const m = new Map<string, number>()
    tasks.forEach(t => { if (t.parentId) m.set(t.parentId, (m.get(t.parentId) ?? 0) + 1) })
    return m
  }, [tasks])

  // Concluídos começam recolhidos: o passado é contexto, não trabalho. O usuário abre o que quiser.
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const estaAberto = (m: MarcoDaJornada) => abertos[m.marco.id] ?? m.fase !== 'feito'
  const alternar = (m: MarcoDaJornada) => setAbertos(a => ({ ...a, [m.marco.id]: !estaAberto(m) }))

  const irPara = (id: string) => {
    const m = marcos.find(x => x.marco.id === id)
    if (m && !estaAberto(m)) setAbertos(a => ({ ...a, [id]: true }))
    requestAnimationFrame(() => document.getElementById('marco-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  /** Põe a tarefa dentro do marco (ou tira, com `null`). Reabre o marco se ele já estava fechado
   *  e recebeu trabalho pendente — senão a trilha diria "concluído" com tarefa aberta dentro. */
  const mover = (id: string, alvo: string | null) => {
    const t = porId.get(id)
    if (!t || t.id === alvo || t.parentId === alvo) return
    if (alvo && t.taskType === 'milestone') return            // marco dentro de marco não
    for (let p = alvo ? porId.get(alvo) : undefined; p; p = p.parentId ? porId.get(p.parentId) : undefined)
      if (p.id === id) return                                   // não pode entrar no próprio descendente
    updateTask(id, { parentId: alvo })
    const marco = alvo ? porId.get(alvo) : undefined
    if (marco?.status === 'done' && t.status !== 'done') updateTask(marco.id, { status: 'in_progress' })
  }

  const criarMarco = (titulo: string) => {
    if (!projectId || !titulo.trim()) return
    const t = quickAddTask(titulo, projectId, 'todo')
    updateTask(t.id, { taskType: 'milestone' })
  }
  const criarTarefa = (marco: Task, titulo: string) => {
    if (!projectId || !titulo.trim()) return
    quickAddTask(titulo, projectId, 'todo', marco.id)
    if (marco.status === 'done') updateTask(marco.id, { status: 'in_progress' })
  }

  const linha = (t: Task, opts: { destaque?: boolean; virarMarco?: boolean } = {}) => (
    <LinhaTarefa key={t.id} task={t} accent={accent} subtarefas={filhasDe.get(t.id) ?? 0}
      destaque={opts.destaque} onAbrir={() => setSelectedTask(t.id)}
      onConcluir={() => updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' })}
      onVirarMarco={opts.virarMarco ? () => updateTask(t.id, { taskType: 'milestone' }) : undefined}/>
  )

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/40">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 md:py-6 space-y-5">

        {marcos.length === 0 ? (
          <Vazio onCriar={criarMarco} temSoltas={semMarco.length > 0} podeCriar={!!projectId}/>
        ) : (
          <>
            <Trilha jornada={jornada} accent={accent} onIr={irPara}/>
            <Bussola jornada={jornada} accent={accent} onIr={irPara} onAbrir={id => setSelectedTask(id)}/>

            {/* Linha do tempo: um bloco por marco, com o trilho à esquerda ligando as estações. */}
            <div className="relative">
              {marcos.map((m, i) => (
                <SecaoMarco key={m.marco.id} m={m} accent={accent} aberto={estaAberto(m)}
                  ultimo={i === marcos.length - 1} proximo={i === atualIdx + 1 && atualIdx >= 0}
                  onAlternar={() => alternar(m)} onAbrir={() => setSelectedTask(m.marco.id)}
                  onPrazo={d => updateTask(m.marco.id, { dueDate: d })}
                  onSoltar={id => mover(id, m.marco.id)}
                  onNovaTarefa={projectId ? titulo => criarTarefa(m.marco, titulo) : undefined}>
                  {m.tarefas.map(t => linha(t, { destaque: m.proximoPasso?.id === t.id }))}
                </SecaoMarco>
              ))}
              {projectId && <NovoMarco onCriar={criarMarco}/>}
            </div>
          </>
        )}

        {/* Fora dos marcos: o que ainda não tem lugar na trilha. Também é alvo de arraste
            (devolver uma tarefa ao nível principal). */}
        {semMarco.length > 0 && (
          <AlvoSoltar onSoltar={id => mover(id, null)}
            className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-3 md:p-4">
            <div className="flex items-center justify-between gap-2 mb-2 px-1">
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-gray-500">
                Fora dos marcos <span className="tabnum text-gray-400 font-semibold">· {semMarco.length}</span>
              </h3>
              <span className="hidden sm:inline text-[11px] text-gray-400">
                {marcos.length ? 'Arraste para um marco para pôr na trilha' : 'Passe o mouse e use "Virar marco"'}
              </span>
            </div>
            <div className="space-y-0.5">{semMarco.map(t => linha(t, { virarMarco: true }))}</div>
          </AlvoSoltar>
        )}
      </div>
    </div>
  )
}

// ── Trilha: o mapa do caminho inteiro numa faixa ─────────────────────────────────────────────

function Trilha({ jornada, accent, onIr }: { jornada: ReturnType<typeof montarJornada>; accent: string; onIr: (id: string) => void }) {
  const { marcos, atualIdx, inicio, chegada } = jornada
  // Estações: Início, um por marco, Chegada. A linha liga o centro da primeira ao da última.
  const n = marcos.length + 2
  const centro = (k: number) => ((k + 0.5) / n) * 100
  const tudoFeito = atualIdx < 0
  // O preenchimento avança até a estação anterior ao marco atual e entra no trecho seguinte
  // na proporção do que já foi feito nele — o progresso "anda" pela trilha.
  const fim = tudoFeito
    ? centro(n - 1)
    : centro(atualIdx) + (centro(atualIdx + 1) - centro(atualIdx)) * (marcos[atualIdx].pct / 100)

  // Em tela estreita a trilha rola de lado: abre já centrada no "Você está aqui", senão no
  // celular a primeira coisa visível seria o passado. Mexe só no `scrollLeft` da própria
  // faixa (scrollIntoView rolaria a página inteira junto).
  const faixa = useRef<HTMLDivElement>(null)
  const idAtual = atualIdx >= 0 ? marcos[atualIdx].marco.id : null
  useEffect(() => {
    const el = faixa.current
    const alvo = el?.querySelector<HTMLElement>('[data-atual="1"]')
    if (el && alvo) el.scrollLeft = alvo.offsetLeft - (el.clientWidth - alvo.offsetWidth) / 2
  }, [idAtual])

  return (
    <div ref={faixa} className="bg-white border border-gray-200/70 rounded-2xl shadow-xs overflow-x-auto scrollbar-none">
      <div className="relative flex min-w-full w-max pt-9 pb-4 px-2">
        <div className="absolute h-[3px] rounded-full bg-gray-200" style={{ top: 'calc(2.25rem + 10px)', left: `${centro(0)}%`, right: `${100 - centro(n - 1)}%` }}/>
        <div className="absolute h-[3px] rounded-full transition-all duration-700" style={{ top: 'calc(2.25rem + 10px)', left: `${centro(0)}%`, width: `${fim - centro(0)}%`, background: accent }}/>

        <Estacao rotulo="Início" sub={inicio ? fmtCurta(inicio) : '—'}>
          <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-white shadow-sm" style={{ background: accent }}>
            <Flag size={11} strokeWidth={2.5}/>
          </span>
        </Estacao>

        {marcos.map(m => {
          const atual = m.fase === 'atual'
          const sub = m.fase === 'feito'
            ? `✓ ${fmtCurta(m.marco.completedAt ?? m.marco.updatedAt)}`
            : m.marco.dueDate ? `até ${fmtCurta(m.marco.dueDate)}` : 'sem prazo'
          return (
            <Estacao key={m.marco.id} rotulo={m.marco.title} sub={sub} onClick={() => onIr(m.marco.id)}
              forte={atual} alerta={m.atrasado} titulo={`${m.marco.title} — ${m.feitas}/${m.total} tarefas`}
              selo={atual ? 'Você está aqui' : undefined} accent={accent} atual={atual}>
              {m.fase === 'feito' && (
                <span className="w-[22px] h-[22px] flex items-center justify-center">
                  <span className="w-[15px] h-[15px] rotate-45 rounded-[3px] flex items-center justify-center" style={{ background: COR_FEITO }}>
                    <Check size={9} strokeWidth={3.5} className="-rotate-45 text-white"/>
                  </span>
                </span>
              )}
              {atual && (
                <span className="relative w-[22px] h-[22px] flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ background: accent }}/>
                  <span className="w-[17px] h-[17px] rotate-45 rounded-[4px] border-[3px] bg-white shadow-sm" style={{ borderColor: accent }}/>
                </span>
              )}
              {m.fase === 'adiante' && (
                <span className="w-[22px] h-[22px] flex items-center justify-center">
                  <span className="w-[13px] h-[13px] rotate-45 rounded-[3px] border-2 border-gray-300 bg-white"/>
                </span>
              )}
            </Estacao>
          )
        })}

        <Estacao rotulo={tudoFeito ? 'Chegou' : 'Chegada'} sub={tudoFeito ? 'tudo entregue' : chegada ? `prev. ${fmtCurta(chegada)}` : 'sem data'}>
          <span className={`w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 ${tudoFeito ? 'text-white' : 'bg-white border-gray-300 text-gray-400'}`}
            style={tudoFeito ? { background: COR_FEITO, borderColor: COR_FEITO } : undefined}>
            <MapPin size={11} strokeWidth={2.5}/>
          </span>
        </Estacao>
      </div>
    </div>
  )
}

function Estacao({ rotulo, sub, children, onClick, forte, alerta, titulo, selo, accent, atual }: {
  rotulo: string; sub: string; children: React.ReactNode; onClick?: () => void
  forte?: boolean; alerta?: boolean; titulo?: string; selo?: string; accent?: string; atual?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} title={titulo ?? rotulo} data-atual={atual ? '1' : undefined}
      className={`relative flex-1 min-w-[104px] max-w-[180px] flex flex-col items-center text-center px-1.5 ${onClick ? 'group cursor-pointer' : ''}`}>
      {selo && (
        <span className="absolute -top-7 whitespace-nowrap text-[10px] font-bold text-white px-2 py-0.5 rounded-full shadow-sm" style={{ background: accent }}>
          {selo}
        </span>
      )}
      <span className="relative z-10 transition-transform group-hover:scale-110">{children}</span>
      <span className={`mt-2 text-[11.5px] leading-tight line-clamp-2 ${forte ? 'font-bold text-gray-900' : 'font-semibold text-gray-600 group-hover:text-gray-900'}`}>{rotulo}</span>
      <span className={`tabnum mt-0.5 text-[10.5px] ${alerta ? 'text-danger-600 font-semibold' : 'text-gray-400'}`}>{sub}</span>
    </Tag>
  )
}

// ── Bússola: as três perguntas, respondidas em uma linha cada ────────────────────────────────

function Bussola({ jornada, accent, onIr, onAbrir }: {
  jornada: ReturnType<typeof montarJornada>; accent: string; onIr: (id: string) => void; onAbrir: (id: string) => void
}) {
  const { marcos, atualIdx, inicio, chegada, entregues } = jornada
  const feitos = marcos.filter(m => m.fase === 'feito')
  const ultimoFeito = feitos[feitos.length - 1]
  const atual = atualIdx >= 0 ? marcos[atualIdx] : null
  const seguinte = atualIdx >= 0 ? marcos[atualIdx + 1] : undefined

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Cartao Icone={Flag} titulo="De onde veio">
        <p className="text-[13px] font-semibold text-gray-900">{inicio ? `Começou em ${fmtLonga(inicio)}` : 'Ainda sem tarefas'}</p>
        <p className="text-[12px] text-gray-500 mt-1 tabnum">{feitos.length} de {marcos.length} marcos · {entregues} tarefa{entregues === 1 ? '' : 's'} entregue{entregues === 1 ? '' : 's'}</p>
        {ultimoFeito && (
          <button onClick={() => onIr(ultimoFeito.marco.id)} className="mt-2 text-[11.5px] text-gray-500 hover:text-gray-800 text-left truncate max-w-full">
            Último: <span className="font-semibold">{ultimoFeito.marco.title}</span>
          </button>
        )}
      </Cartao>

      <Cartao Icone={MapPin} titulo="Onde está" accent={accent}>
        {atual ? (
          <>
            <button onClick={() => onIr(atual.marco.id)} className="text-[13px] font-bold text-gray-900 hover:underline text-left line-clamp-2">{atual.marco.title}</button>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <span className="block h-full rounded-full transition-all duration-500" style={{ width: `${atual.pct}%`, background: accent }}/>
              </span>
              <span className="tabnum text-[11px] font-semibold text-gray-500">{atual.feitas}/{atual.total}</span>
            </div>
            {atual.proximoPasso ? (
              <button onClick={() => onAbrir(atual.proximoPasso!.id)}
                className="mt-2 w-full flex items-center gap-1.5 text-left text-[12px] text-gray-700 hover:text-gray-900 group">
                <CornerDownRight size={12} className="flex-shrink-0" style={{ color: accent }}/>
                <span className="text-gray-400 flex-shrink-0">Próximo passo:</span>
                <span className="font-semibold truncate group-hover:underline">{atual.proximoPasso.title}</span>
              </button>
            ) : (
              <p className="mt-2 text-[12px] text-gray-400">Sem tarefas abertas neste marco</p>
            )}
          </>
        ) : (
          <p className="text-[13px] font-semibold" style={{ color: COR_FEITO }}>Todos os marcos concluídos</p>
        )}
      </Cartao>

      <Cartao Icone={Navigation} titulo="Para onde vai">
        {seguinte ? (
          <>
            <button onClick={() => onIr(seguinte.marco.id)} className="text-[13px] font-semibold text-gray-900 hover:underline text-left line-clamp-2">{seguinte.marco.title}</button>
            <p className="text-[12px] text-gray-500 mt-1 tabnum">
              {seguinte.marco.dueDate ? `Até ${fmtLonga(seguinte.marco.dueDate)}` : 'Sem prazo definido'} · {seguinte.total} tarefa{seguinte.total === 1 ? '' : 's'}
            </p>
          </>
        ) : (
          <p className="text-[13px] font-semibold text-gray-900">{atual ? 'Este é o último marco' : 'Fim da trilha'}</p>
        )}
        {chegada && <p className="mt-2 text-[11.5px] text-gray-500 tabnum">Chegada prevista: <span className="font-semibold">{fmtLonga(chegada)}</span></p>}
      </Cartao>
    </div>
  )
}

function Cartao({ Icone, titulo, accent, children }: { Icone: React.ElementType; titulo: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200/70 rounded-2xl p-4 shadow-xs min-w-0"
      style={accent ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}>
      <div className="flex items-center gap-1.5 mb-2 text-[10.5px] font-bold uppercase tracking-wider text-gray-400">
        <Icone size={12} style={accent ? { color: accent } : undefined}/>{titulo}
      </div>
      {children}
    </div>
  )
}

// ── Linha do tempo ───────────────────────────────────────────────────────────────────────────

function SecaoMarco({ m, accent, aberto, ultimo, proximo, onAlternar, onAbrir, onPrazo, onSoltar, onNovaTarefa, children }: {
  m: MarcoDaJornada; accent: string; aberto: boolean; ultimo: boolean; proximo: boolean
  onAlternar: () => void; onAbrir: () => void; onPrazo: (d: string | null) => void
  onSoltar: (id: string) => void; onNovaTarefa?: (titulo: string) => void; children: React.ReactNode
}) {
  const feito = m.fase === 'feito'
  const atual = m.fase === 'atual'
  const cor = feito ? COR_FEITO : atual ? accent : undefined
  const selo = feito
    ? { texto: `Concluído em ${fmtCurta(m.marco.completedAt ?? m.marco.updatedAt)}`, cls: 'bg-success-50 text-success-700' }
    : atual ? { texto: 'Agora', cls: 'text-white' }
    : proximo ? { texto: 'A seguir', cls: 'bg-gray-100 text-gray-600' }
    : { texto: 'Depois', cls: 'bg-gray-50 text-gray-400' }

  return (
    <div id={'marco-' + m.marco.id} className="relative pl-8 md:pl-10 pb-4 scroll-mt-4">
      {/* trilho vertical */}
      {!ultimo && <span className={`absolute left-[11px] md:left-[15px] top-6 -bottom-1 w-[2px] ${feito ? '' : 'bg-gray-200'}`} style={feito ? { background: COR_FEITO } : undefined}/>}
      <span className="absolute left-[3px] md:left-[7px] top-[14px] w-[18px] h-[18px] flex items-center justify-center">
        <span className={`rotate-45 rounded-[3px] ${atual ? 'w-[15px] h-[15px] border-[3px] bg-white' : feito ? 'w-[13px] h-[13px]' : 'w-[12px] h-[12px] border-2 border-gray-300 bg-white'}`}
          style={atual ? { borderColor: accent } : feito ? { background: COR_FEITO } : undefined}/>
      </span>

      <AlvoSoltar onSoltar={onSoltar}
        className={`rounded-2xl border bg-white transition-shadow ${atual ? 'shadow-md' : 'shadow-xs'} ${feito ? 'border-gray-200/70' : atual ? '' : 'border-gray-200/70'}`}
        style={atual ? { borderColor: accent + '66' } : undefined}>
        {/* Cabeçalho do marco */}
        <div className="flex items-center gap-2 px-3 md:px-4 py-2.5">
          <button onClick={onAlternar} className="p-0.5 -ml-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title={aberto ? 'Recolher' : 'Expandir'}>
            <ChevronRight size={14} className={`transition-transform ${aberto ? 'rotate-90' : ''}`}/>
          </button>
          <Diamond size={14} className="flex-shrink-0" style={{ color: cor ?? STATUS_COLOR[m.marco.status] }} fill={feito ? COR_FEITO : 'none'}/>
          {/* O título fica com o espaço que sobrar (flex-1) — no celular os selos o reduziam a
              uma letra. O ID curto e a data longa do selo só aparecem a partir de `sm`. */}
          <span className="flex-1 min-w-0 flex items-center gap-2">
            <button onClick={onAbrir} className={`min-w-0 text-left truncate text-[14px] font-bold tracking-tight hover:underline ${feito ? 'text-gray-500' : 'text-gray-900'}`}>
              {m.marco.title}
            </button>
            <span className="hidden sm:inline-flex"><IdCurto tipo="task" seq={m.marco.seq}/></span>
            <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${selo.cls}`}
              style={atual ? { background: accent } : undefined}>
              {feito ? <><span className="sm:hidden">Feito</span><span className="hidden sm:inline">{selo.texto}</span></> : selo.texto}
            </span>
          </span>
          <span className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <span className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${m.pct}%`, background: cor ?? '#9CA3AF' }}/>
            </span>
            <span className="tabnum text-[11px] font-semibold text-gray-500 w-9 text-right">{m.feitas}/{m.total}</span>
          </span>
          {!feito && (
            <span className="flex-shrink-0" onClick={e => e.stopPropagation()}>
              <DueDatePicker value={m.marco.dueDate} onChange={onPrazo} overdue={m.atrasado}/>
            </span>
          )}
        </div>

        {aberto && (
          <div className="px-2 md:px-3 pb-2 border-t border-gray-100 pt-1.5">
            {React.Children.count(children) === 0 && (
              <p className="px-2 py-2 text-[12px] text-gray-400">Nenhuma tarefa neste marco ainda. Arraste uma para cá ou crie abaixo.</p>
            )}
            <div className="space-y-0.5">{children}</div>
            {onNovaTarefa && <CampoNovo placeholder="Adicionar tarefa a este marco" onCriar={onNovaTarefa} compacto/>}
          </div>
        )}
      </AlvoSoltar>
    </div>
  )
}

function LinhaTarefa({ task, accent, subtarefas, destaque, onAbrir, onConcluir, onVirarMarco }: {
  task: Task; accent: string; subtarefas: number; destaque?: boolean
  onAbrir: () => void; onConcluir: () => void; onVirarMarco?: () => void
}) {
  const Icone = TYPE_ICON[task.taskType ?? 'task']
  const feita = task.status === 'done'
  const atrasada = estaAtrasada(task.dueDate, task.status)
  return (
    <div draggable onDragStart={e => { e.dataTransfer.setData(ARRASTE, task.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={onAbrir}
      className={`group/linha relative flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors ${destaque ? 'bg-brand-50/60' : 'hover:bg-gray-50'}`}>
      {destaque && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" style={{ background: accent }}/>}
      <button onClick={e => { e.stopPropagation(); onConcluir() }} title={feita ? 'Reabrir' : 'Concluir'}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100">
        <Icone size={14} style={{ color: STATUS_COLOR[task.status] }} fill={feita && task.taskType === 'task' ? STATUS_COLOR.done : 'none'}/>
      </button>
      <span className={`min-w-0 truncate text-[13px] ${feita ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</span>
      <IdCurto tipo="task" seq={task.seq}/>
      {destaque && <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: accent }}>Próximo passo</span>}
      {subtarefas > 0 && <span className="flex-shrink-0 tabnum text-[10.5px] text-gray-400">{subtarefas} sub</span>}
      <span className="flex-1"/>
      {onVirarMarco && (
        <button onClick={e => { e.stopPropagation(); onVirarMarco() }} title="Transformar esta tarefa em marco"
          className="flex-shrink-0 md:opacity-0 md:group-hover/linha:opacity-100 flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-brand-600 px-1.5 py-0.5 rounded border border-gray-200 bg-white transition-opacity">
          <Diamond size={11}/> Virar marco
        </button>
      )}
      {task.dueDate && (
        <span className={`flex-shrink-0 tabnum text-[11px] ${atrasada ? 'text-danger-600 font-semibold' : 'text-gray-400'}`}>{formatarPrazo(task.dueDate)}</span>
      )}
      {task.assignee && <AssigneeAvatar name={task.assignee} size={20} variant="soft"/>}
    </div>
  )
}

function AlvoSoltar({ onSoltar, className, style, children }: {
  onSoltar: (id: string) => void; className?: string; style?: React.CSSProperties; children: React.ReactNode
}) {
  const [sobre, setSobre] = useState(false)
  return (
    <div className={`${className ?? ''} ${sobre ? 'ring-2 ring-brand-300' : ''}`} style={style}
      onDragOver={e => { if (e.dataTransfer.types.includes(ARRASTE.toLowerCase())) { e.preventDefault(); setSobre(true) } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(false) }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); setSobre(false); const id = e.dataTransfer.getData(ARRASTE); if (id) onSoltar(id) }}>
      {children}
    </div>
  )
}

function CampoNovo({ placeholder, onCriar, compacto }: { placeholder: string; onCriar: (t: string) => void; compacto?: boolean }) {
  const [valor, setValor] = useState('')
  const [ativo, setAtivo] = useState(false)
  const enviar = () => { if (valor.trim()) { onCriar(valor); setValor('') } }
  if (!ativo) return (
    <button onClick={() => setAtivo(true)}
      className={`flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 hover:text-gray-700 rounded-lg transition-colors ${compacto ? 'px-2 py-1.5 mt-0.5' : 'px-3 py-2'}`}>
      <Plus size={13}/>{placeholder}
    </button>
  )
  return (
    <div className={`flex items-center gap-1.5 ${compacto ? 'px-2 py-1 mt-0.5' : 'px-3 py-2'}`}>
      <Plus size={13} className="text-gray-400 flex-shrink-0"/>
      <input autoFocus value={valor} onChange={e => setValor(e.target.value)} placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter') enviar(); if (e.key === 'Escape') { setValor(''); setAtivo(false) } }}
        onBlur={() => { if (!valor.trim()) setAtivo(false) }}
        className="flex-1 min-w-0 text-[13px] bg-transparent outline-none text-gray-800 placeholder:text-gray-400"/>
      <button onMouseDown={e => e.preventDefault()} onClick={enviar} disabled={!valor.trim()}
        className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-brand-600 disabled:opacity-40" title="Criar (Enter)">
        <ArrowRight size={13}/>
      </button>
    </div>
  )
}

function NovoMarco({ onCriar }: { onCriar: (t: string) => void }) {
  return (
    <div className="relative pl-8 md:pl-10">
      <span className="absolute left-[3px] md:left-[7px] top-[11px] w-[18px] h-[18px] flex items-center justify-center">
        <span className="w-[11px] h-[11px] rotate-45 rounded-[3px] border-2 border-dashed border-gray-300"/>
      </span>
      <CampoNovo placeholder="Novo marco" onCriar={onCriar}/>
    </div>
  )
}

function Vazio({ onCriar, temSoltas, podeCriar }: { onCriar: (t: string) => void; temSoltas: boolean; podeCriar: boolean }) {
  return (
    <div className="bg-white border border-gray-200/70 rounded-2xl p-6 md:p-8 text-center shadow-xs">
      <div className="mx-auto w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
        <Sparkles size={20}/>
      </div>
      <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Este projeto ainda não tem marcos</h3>
      <p className="mt-1.5 text-[13px] text-gray-500 max-w-md mx-auto leading-relaxed">
        Marco é uma etapa com cara de entrega — "Piloto no ar", "Treinar a equipe". Cada um junta as tarefas
        daquela fase, e esta tela mostra de onde o trabalho veio, onde está e o que vem depois.
      </p>
      {podeCriar && (
        <div className="mt-4 max-w-sm mx-auto border border-gray-200 rounded-xl text-left">
          <CampoNovo placeholder="Criar o primeiro marco" onCriar={onCriar}/>
        </div>
      )}
      {temSoltas && <p className="mt-3 text-[12px] text-gray-400">Ou transforme uma tarefa que já existe: use "Virar marco" na lista abaixo.</p>}
    </div>
  )
}
