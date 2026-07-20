import type React from 'react'
import { List, BarChart2, Calendar, Target, CheckCircle2, Flag, Star, Pin } from 'lucide-react'

// Ícones (lucide) para as visualizações personalizadas ("+ Visualização").
// Substituem os emojis (📋📊📅🎯✅🔥⭐📌). O `icon` guardado passa a ser uma
// CHAVE; renderização com fallback para dados antigos (que ainda são emojis).
export const VIEW_ICON_KEYS = ['list','chart','calendar','target','check','flag','star','pin'] as const
export type ViewIconKey = typeof VIEW_ICON_KEYS[number]

export const VIEW_ICON: Record<string, React.ElementType> = {
  list:     List,
  chart:    BarChart2,
  calendar: Calendar,
  target:   Target,
  check:    CheckCircle2,
  flag:     Flag,
  star:     Star,
  pin:      Pin,
}
