import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar, CalendarDays } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskDetail } from '../components/tasks/TaskDetail'
import { PRIORITY_COLOR } from '../types'
import type { Task } from '../types'

/**
 * Calendário.
 *
 * Corrigido em 29/07/2026. Dois problemas:
 *
 * 1. **Bug de layout**: o container raiz era `flex` (linha) sem `flex-col`, então o
 *    cabeçalho ficava *ao lado* da grade em vez de acima dela, comprimindo o mês. Era isso
 *    que produzia célula de 14px de largura no celular.
 * 2. **Grade de 7 colunas não serve em tela estreita.** Abaixo de `md` a tela vira uma
 *    agenda: lista só dos dias que têm tarefa, em ordem. É o padrão dos apps de calendário
 *    no telefone, e mostra o texto da tarefa em vez de um retângulo de 40px.
 */

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export function CalendarView() {
  const { tasks, projects, setSelectedTask, selectedTaskId, activeWorkspaceId } = useAppStore()
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1) } else setMonth(m => m + 1) }
  const irParaHoje = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const chave = (day: number) => `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`

  // Um índice por dia em vez de varrer as tarefas para cada célula (era filter dentro do
  // map, 42 varreduras por render).
  const porDia = useMemo(() => {
    const mapa = new Map<string, Task[]>()
    tasks.forEach(t => {
      if (t.status === 'done' || !t.dueDate || t.workspaceId !== activeWorkspaceId) return
      const lista = mapa.get(t.dueDate) ?? []
      lista.push(t)
      mapa.set(t.dueDate, lista)
    })
    return mapa
  }, [tasks, activeWorkspaceId])

  const diasComTarefa = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1)
      .map(day => ({ day, tarefas: porDia.get(chave(day)) ?? [] }))
      .filter(d => d.tarefas.length > 0),
    [porDia, year, month, daysInMonth],
  )

  const ehHoje = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const corDaTarefa = (t: Task) =>
    projects.find(p => p.id === t.projectId)?.color ?? PRIORITY_COLOR[t.priority]

  return (
    <div className="flex flex-1 overflow-hidden min-w-0">
      {/* `flex-col` aqui é o que faltava: sem ele o cabeçalho ficava ao lado do mês */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <div className="flex items-center gap-2 px-4 md:px-6 py-3.5 border-b border-gray-200 bg-white flex-shrink-0">
          <Calendar size={16} className="text-gray-400 flex-shrink-0" />
          <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900 flex-1 truncate">Calendário</h1>
          <button onClick={irParaHoje}
            className="hidden sm:block text-[11px] font-semibold text-gray-600 hover:text-brand-600 px-2 py-1 rounded-lg transition-colors">
            Hoje
          </button>
          <button onClick={prevMonth} aria-label="Mês anterior"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 flex-shrink-0">
            <ChevronLeft size={14} />
          </button>
          <span className="text-[12.5px] font-bold text-gray-700 w-28 md:w-36 text-center tabular-nums">
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} aria-label="Próximo mês"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 flex-shrink-0">
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {/* ── Grade do mês (a partir de md) ── */}
          <div className="hidden md:block">
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[11px] font-semibold text-gray-500 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`vazio-${i}`} />
                const dayTasks = porDia.get(chave(day)) ?? []
                return (
                  <div key={chave(day)}
                    className={`min-h-[72px] p-1.5 rounded-lg border transition-colors ${
                      ehHoje(day) ? 'border-brand-300 bg-brand-50/40' : 'border-gray-100 hover:border-gray-200'}`}>
                    <span className={`text-[11.5px] font-semibold inline-flex w-5 h-5 items-center justify-center rounded-full ${
                      ehHoje(day) ? 'bg-brand-600 text-white' : 'text-gray-600'}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayTasks.slice(0, 3).map(t => (
                        <button key={t.id} onClick={() => setSelectedTask(t.id)}
                          className="w-full text-left text-[10px] px-1 py-0.5 rounded truncate leading-4"
                          style={{ background: corDaTarefa(t) + '18', color: corDaTarefa(t) }}>
                          {t.title}
                        </button>
                      ))}
                      {dayTasks.length > 3 && (
                        <p className="text-[10px] text-gray-500 pl-1">+{dayTasks.length - 3}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Agenda (celular) ── só os dias com tarefa, com o texto legível */}
          <div className="md:hidden space-y-2">
            {diasComTarefa.length === 0 ? (
              <div className="text-center py-12">
                <CalendarDays size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-[12.5px] font-semibold text-gray-600">Nada com prazo em {MONTHS[month].toLowerCase()}</p>
                <p className="text-[11px] text-gray-500 mt-1">Tarefas com prazo neste mês aparecem aqui.</p>
              </div>
            ) : diasComTarefa.map(({ day, tarefas }) => (
              <div key={chave(day)} className={`rounded-xl border p-3 ${ehHoje(day) ? 'border-brand-300 bg-brand-50/40' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[12px] font-extrabold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                    ehHoje(day) ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {day}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-600">
                    {DAYS[new Date(year, month, day).getDay()]}
                    {ehHoje(day) && <span className="text-brand-600"> · hoje</span>}
                  </span>
                  <span className="text-[10px] text-gray-500 tabnum ml-auto">{tarefas.length}</span>
                </div>
                <div className="space-y-1">
                  {tarefas.map(t => {
                    const projeto = projects.find(p => p.id === t.projectId)
                    return (
                      <button key={t.id} onClick={() => setSelectedTask(t.id)}
                        className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: corDaTarefa(t) }} />
                        <span className="text-[12px] text-gray-800 flex-1 truncate">{t.title}</span>
                        {projeto && <span className="text-[10px] text-gray-500 flex-shrink-0 truncate max-w-[90px]">{projeto.name}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedTaskId && <TaskDetail />}
    </div>
  )
}
