import type React from 'react'
import {
  Circle, Diamond, NotepadText, Bug, Trophy, Target, ClipboardList, MessageSquare,
} from 'lucide-react'
import type { TaskType } from '../types'

// Ícones de tipo de tarefa no estilo ClickUp (cinza neutro) — fonte única da verdade
export const TYPE_ICON: Record<TaskType, React.ElementType> = {
  task:          Circle,
  milestone:     Diamond,
  meeting_note:  NotepadText,
  bug:           Bug,
  goal:          Trophy,
  objective:     Target,
  form_response: ClipboardList,
  request:       MessageSquare,
}

export const TYPE_ICON_COLOR = '#656f7d'
