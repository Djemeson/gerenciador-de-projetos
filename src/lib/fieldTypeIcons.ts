import type React from 'react'
import {
  Type, AlignLeft, Hash, DollarSign, Calendar, List, CheckSquare,
  Link2, Globe, Users, Mail, Phone, Tags, Star, Sparkles,
} from 'lucide-react'
import type { ColumnType } from '../types'

// Ícones de linha (lucide) para os tipos de campo personalizado — fonte única
// da verdade. Substitui os antigos emojis/glifos soltos (📅 🔗 👤 ✉️ ▾ ☑ ★).
// Reutilizado no ColumnsModal (grade, cabeçalho e aba "existente") e em qualquer
// outro lugar que precise exibir o tipo de um campo.
export const FIELD_TYPE_ICON: Record<ColumnType, React.ElementType> = {
  text:     Type,
  longtext: AlignLeft,
  number:   Hash,
  money:    DollarSign,
  date:     Calendar,
  dropdown: List,
  checkbox: CheckSquare,
  url:      Link2,
  website:  Globe,
  people:   Users,
  email:    Mail,
  phone:    Phone,
  labels:   Tags,
  rating:   Star,
  ai_summary: Sparkles,
}
