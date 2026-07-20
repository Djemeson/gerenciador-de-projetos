import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Ícones curados (lucide), por categoria — substitui a grade de emojis ────
export interface IconCategory { label: string; icons: string[] }

export const ICON_CATEGORIES: IconCategory[] = [
  { label: 'Geral', icons: ['zap','zap-off','activity','airplay','arrow-right','arrow-up-right','check-circle','circle','copyright','download','upload','equal','eye','filter','grid-3x3','help-circle','hexagon','link','list','percent','settings','shapes','share-2','shuffle','square','square-check','star','tag','target','triangle','x-circle'] },
  { label: 'Negócios & Finanças', icons: ['award','badge-check','banknote','bar-chart-2','bitcoin','briefcase','building-2','calculator','coins','credit-card','crown','database','diamond','gauge','gem','landmark','medal','pie-chart','piggy-bank','presentation','scale','store','trending-up','trophy','wallet'] },
  { label: 'Comunicação', icons: ['bell','book','book-open','bookmark','headphones','mail','megaphone','messages-square','mic','mic-off','network','phone','phone-off','radio','rss','satellite','screen-share','send','signal','speaker','voicemail','volume-2','wifi','wifi-off'] },
  { label: 'Pessoas & Comunidade', icons: ['baby','contact','copyright','heart','handshake','footprints','graduation-cap','hand','hard-hat','helping-hand','school','smile','user','user-check','user-plus','users'] },
  { label: 'Tarefas & Produtividade', icons: ['alarm-clock','archive','bookmark','briefcase','calendar','checklist','clipboard','clipboard-list','clock','clock-3','file','file-text','flag','folder','folder-open','hourglass','inbox','inbox-0','list','list-checks','milestone','notebook','notepad','package','paperclip','pen','pen-tool','pencil','pin','printer','ruler','save','stamp','table','target','timer','todo'] },
  { label: 'Tecnologia', icons: ['battery','bluetooth','brackets','code','code-2','cpu','database','disc','git-branch','git-commit','github','globe','headphones','keyboard','laptop','layers','link','monitor','mouse-pointer','network','plug','puzzle','radar','rss','server','smartphone','terminal','tv','watch','webcam','wifi'] },
  { label: 'Casa & Objetos', icons: ['axe','backpack','bag','box','brush','couch','door-open','fan','flashlight','gift','hammer','home','key','lightbulb','lock','luggage','magnet','paint-bucket','palette','plug','power','scissors','shovel','sofa','sun','thermometer','trash-2','umbrella','unlock','wrench'] },
  { label: 'Natureza & Clima', icons: ['bird','bug','clover','cloud','cloud-rain','droplet','feather','fish','flower','flower-2','leaf','leaf-2','mountain','moon','panda','plant','shrub','snowflake','sprout','sun','sunrise','sunset','tornado','tree','tree-pine','waves','wheat','wind'] },
  { label: 'Alimentos & Bebidas', icons: ['apple','banana','beer','bottle','cake','candy','carrot','chef-hat','coffee','cookie','cup','egg','glass','glass-water','grape','grapes','ice-cream','lemon','martini','pizza','sandwich','tomato','utensils','wine'] },
  { label: 'Viagem & Aventura', icons: ['anchor','backpack','bike','binoculars','boat','briefcase','bus','car','compass','flag','fuel','globe','life-buoy','luggage','map','map-pin','navigation','package','parking-circle','plane','radar','rocket','route','ship','tent','tickets','tractor','train','train-track','tree','truck','watch'] },
  { label: 'Mídia & Entretenimento', icons: ['album','book','book-open','camera','clapperboard','clapper','dice','dice-1','dice-5','disc','drama','drum','film','gamepad','gamepad-2','ghost','gitlab','image','image-plus','music','music-2','newspaper','party-popper','pen','piano','play','play-circle','smile','sparkles','star','swords','ticket','video','volume','wand','wand-2'] },
  { label: 'Saúde & Segurança', icons: ['activity','beaker','bomb','check-circle-2','ear','eye','fingerprint','flame','flask','flask-conical','first-aid','heart','heart-handshake','home-heart','lamp','pill','shield','shield-alert','siren','skull','smile','square-activity','syringe','thermometer','umbrella','x-circle'] },
  { label: 'Compras & Moda', icons: ['backpack','badge','bag','box','briefcase','cart','clothing','dress','gift','handbag','heart','luggage','package','palette','shirt','shoe','shopping-bag','shopping-cart','shopping-bag','star','tag'] },
  { label: 'Construção & Indústria', icons: ['axe','blender','blueprint','bold','building','building-2','cog','construction','cpu','database','drill','factory','gauge','gear','hammer','hard-hat','key','layers','link','monitor','plug','server','settings','shovel','square','tool','tools','truck','tv','wrench'] },
]

// Cores predefinidas do seletor (mesma paleta usada em espaços/pastas/projetos).
export const SWATCH_COLORS: string[] = [
  '#EF4444','#F97316','#F59E0B','#EAB308','#22C55E','#10B981',
  '#14B8A6','#06B6D4','#378ADD','#6366F1','#8B5CF6','#EC4899',
]

const iconComponentCache = new Map<string, LucideIcon | null>()

function kebabToPascal(name: string): string {
  return name.split('-').map(seg => seg.charAt(0).toUpperCase() + seg.slice(1)).join('')
}

/** Resolve um nome de ícone (kebab-case, ex.: "trending-up") para o componente lucide-react. */
export function getIconComponent(name: string | undefined): LucideIcon | null {
  if (!name) return null
  if (iconComponentCache.has(name)) return iconComponentCache.get(name)!
  const comp = (LucideIcons as unknown as Record<string, LucideIcon>)[kebabToPascal(name)] ?? null
  iconComponentCache.set(name, comp)
  return comp
}

export function isKnownIcon(name: string | undefined): boolean {
  return !!getIconComponent(name)
}

// Normaliza texto para busca sem acento, caixa baixa.
export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Clareia uma cor hex por uma fração (0-1) — usado nos degradês dos ícones de espaço. */
export function lightenColor(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16))
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `#${[mix(r), mix(g), mix(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`
}

const SAVED_COLORS_KEY = 'tf_saved_icon_colors'

export function loadSavedColors(): string[] {
  try { return JSON.parse(localStorage.getItem(SAVED_COLORS_KEY) ?? '[]') } catch { return [] }
}
export function saveSavedColors(colors: string[]) {
  try { localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(colors)) } catch { /* noop */ }
}
