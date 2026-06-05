import React from 'react'
import type { Task, ColumnDef } from '../../types'
import { useAppStore } from '../../stores/useAppStore'

interface Props { task: Task; column: ColumnDef }

export function CustomFieldCell({ task, column }: Props) {
  const { updateCustomField } = useAppStore()
  const value = task.customFields?.[column.id]

  const update = (v: unknown) => updateCustomField(task.id, column.id, v)

  if (column.type === 'checkbox') {
    return (
      <input type="checkbox" checked={!!value} onChange={e => { e.stopPropagation(); update(e.target.checked) }}
        className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 cursor-pointer" onClick={e => e.stopPropagation()} />
    )
  }
  if (column.type === 'dropdown' && column.options) {
    return (
      <select value={String(value??'')} onChange={e=>{e.stopPropagation();update(e.target.value)}}
        onClick={e=>e.stopPropagation()}
        className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 cursor-pointer">
        <option value="">—</option>
        {column.options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (column.type === 'date') {
    return (
      <input type="date" value={String(value??'')} onChange={e=>{e.stopPropagation();update(e.target.value)}}
        onClick={e=>e.stopPropagation()}
        className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 cursor-pointer"/>
    )
  }
  if (column.type === 'number' || column.type === 'money') {
    return (
      <input type="number" value={String(value??'')} onChange={e=>{e.stopPropagation();update(e.target.value)}}
        onClick={e=>e.stopPropagation()}
        placeholder="0"
        className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600"/>
    )
  }
  // text / url / default
  return (
    <input type="text" value={String(value??'')} onChange={e=>{e.stopPropagation();update(e.target.value)}}
      onClick={e=>e.stopPropagation()}
      placeholder="—"
      className="w-full text-[11px] bg-transparent border-none outline-none text-gray-600 placeholder:text-gray-300"/>
  )
}
