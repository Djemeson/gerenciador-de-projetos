import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { TaskDetail } from '../components/tasks/TaskDetail'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export function CalendarView() {
  const { tasks, projects, setSelectedTask, selectedTaskId } = useAppStore()
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1) } else setMonth(m => m + 1) }

  const firstDay   = new Date(year, month, 1).getDay()
  const daysInMonth= new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const tasksOnDay = (day: number) => {
    const d = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return tasks.filter(t => t.dueDate === d && t.status !== 'done')
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white">
        <Calendar size={15} className="text-gray-400" />
        <h1 className="text-sm font-semibold text-gray-900 flex-1">Calendário</h1>
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-medium text-gray-700 w-36 text-center">
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const dayTasks = tasksOnDay(day)
            return (
              <div
                key={i}
                className={`min-h-[72px] p-1.5 rounded-lg border transition-colors
                  ${isToday ? 'border-brand-300 bg-brand-50/40' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <span className={`text-xs font-medium inline-flex w-5 h-5 items-center justify-center rounded-full
                  ${isToday ? 'bg-brand-600 text-white' : 'text-gray-600'}`}>
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayTasks.slice(0, 3).map(t => {
                    const project = projects.find(p => p.id === t.projectId)
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTask(t.id)}
                        className="w-full text-left text-[10px] px-1 py-0.5 rounded truncate leading-4"
                        style={{ background: (project?.color ?? '#6B5EE8') + '18', color: project?.color ?? '#6B5EE8' }}
                      >
                        {t.title}
                      </button>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <p className="text-[10px] text-gray-400 pl-1">+{dayTasks.length - 3}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {selectedTaskId && <TaskDetail />}
    </div>
  )
}
