import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Ícones curados (lucide), por categoria — substitui a grade de emojis ────
export interface IconCategory { label: string; icons: string[] }

/**
 * Catálogo do seletor de ícones.
 *
 * **Todo nome aqui existe na versão instalada do lucide** — isso é verificado, não
 * presumido. A lista anterior tinha 34 nomes inventados ou de outra versão (`checklist`,
 * `tools`, `gear`, `cart`, `tree`...): `getIconComponent` devolvia `null` e a grade
 * simplesmente pulava, então eram 34 buracos invisíveis no seletor.
 *
 * Ampliado em 01/08/2026 de 291 ícones úteis em 14 categorias para 556 em 24, cobrindo
 * assuntos que faltavam por completo — educação e ciência, setas e direção, tempo e agenda,
 * arquivos, formas, clima, segurança, automação, emoções e esporte.
 */
export const ICON_CATEGORIES: IconCategory[] = [
  { label: 'Geral', icons: ['activity','airplay','arrow-right','arrow-left','arrow-up','arrow-down','arrow-up-right','circle-check','circle','circle-x','copyright','download','upload','equal','eye','eye-off','filter','grid-3x3','circle-help','hexagon','link','list','percent','settings','shapes','share-2','shuffle','square','square-check','star','tag','target','triangle','x','check','plus','minus','refresh-cw','rotate-cw','maximize','minimize','move','expand','shrink','zoom-in','zoom-out','sliders-horizontal','toggle-left','toggle-right','infinity','asterisk','more-horizontal','more-vertical','menu','chevron-right','chevron-down','external-link','corner-down-right','repeat'] },
  { label: 'Negócios & Finanças', icons: ['award','badge-check','banknote','bar-chart-2','bitcoin','briefcase','building-2','calculator','coins','credit-card','crown','database','diamond','gauge','gem','landmark','medal','pie-chart','piggy-bank','presentation','scale','store','trending-up','trending-down','trophy','wallet','receipt','hand-coins','wallet-cards','line-chart','bar-chart','area-chart','circle-dollar-sign','dollar-sign','euro','handshake','briefcase-business','building','factory','warehouse','shopping-cart','shopping-bag','ticket-percent','tags','badge-percent'] },
  { label: 'Comunicação', icons: ['bell','bell-ring','book','book-open','bookmark','headphones','mail','mail-open','megaphone','messages-square','message-circle','message-square','mic','mic-off','network','phone','phone-off','phone-call','radio','rss','satellite','screen-share','send','signal','speaker','voicemail','volume-2','volume-x','wifi','wifi-off','at-sign','reply','forward','inbox','video','video-off','podcast','antenna','radio-tower','captions','languages'] },
  { label: 'Pessoas & Comunidade', icons: ['baby','contact','heart','handshake','footprints','graduation-cap','hand','hard-hat','school','smile','user','user-check','user-plus','user-minus','user-x','users','users-round','user-round','circle-user','person-standing','accessibility','heart-handshake','hand-heart','cake','party-popper','gift'] },
  { label: 'Tarefas & Produtividade', icons: ['alarm-clock','archive','bookmark','calendar','calendar-check','calendar-days','calendar-clock','clipboard','clipboard-list','clipboard-check','clock','clock-3','file','file-text','flag','folder','folder-open','hourglass','inbox','list','list-checks','list-todo','milestone','notebook','notebook-pen','package','paperclip','pen','pen-tool','pencil','pin','printer','ruler','save','stamp','table','timer','square-check-big','circle-check-big','kanban','columns-3','rows-3','filter-x','history','calendar-plus','timer-reset','bell-plus'] },
  { label: 'Tecnologia', icons: ['battery','bluetooth','brackets','code','code-2','cpu','database','disc','git-branch','git-commit','git-merge','git-pull-request','github','globe','keyboard','laptop','layers','link','monitor','mouse-pointer','network','plug','puzzle','radar','server','smartphone','terminal','tv','watch','webcam','wifi','cloud','cloud-download','cloud-upload','hard-drive','memory-stick','binary','bug','bot','container','box','qr-code','scan','barcode','fingerprint','usb','cable','router'] },
  { label: 'Casa & Objetos', icons: ['axe','backpack','box','brush','door-open','fan','flashlight','gift','hammer','key','lightbulb','lock','luggage','magnet','home','paint-bucket','palette','power','scissors','shovel','sofa','sun','thermometer','trash-2','umbrella','unlock','wrench','bed','lamp','lamp-desk','armchair','blinds','bath','shower-head','washing-machine','refrigerator','microwave','trash','door-closed','picture-in-picture','frame'] },
  { label: 'Natureza & Clima', icons: ['bird','bug','clover','cloud','cloud-rain','cloud-snow','cloud-lightning','droplet','feather','fish','flower','flower-2','leaf','mountain','moon','snowflake','sprout','sun','sunrise','sunset','tornado','trees','tree-pine','waves','wheat','wind','rainbow','sun-dim','sun-medium','haze','thermometer-sun','thermometer-snowflake','shell','squirrel','rat','turtle','rabbit','dog','cat','egg','bone','paw-print'] },
  { label: 'Alimentos & Bebidas', icons: ['apple','banana','beer','cake','candy','carrot','chef-hat','coffee','cookie','egg','grape','ice-cream','martini','pizza','sandwich','utensils','wine','milk','cup-soda','salad','soup','ham','beef','fish','croissant','donut','popcorn','wheat','citrus','dessert','cooking-pot','utensils-crossed'] },
  { label: 'Viagem & Aventura', icons: ['anchor','backpack','bike','bus','car','compass','flag','fuel','globe','life-buoy','luggage','map','map-pin','navigation','package','parking-circle','plane','rocket','route','ship','tent','train-front','truck','watch','sailboat','caravan','mountain-snow','palmtree','footprints','signpost','milestone','ticket','bed-double','plane-takeoff','plane-landing','train-track','tram-front'] },
  { label: 'Mídia & Entretenimento', icons: ['album','book','book-open','camera','clapperboard','disc','drama','drum','film','gamepad-2','ghost','image','image-plus','music','music-2','newspaper','party-popper','piano','play','play-circle','sparkles','star','swords','ticket','video','wand','wand-2','headphones','mic-vocal','guitar','radio','tv','projector','camera-off','pause','skip-forward','skip-back','repeat-2','shuffle','list-music','audio-lines'] },
  { label: 'Saúde & Segurança', icons: ['beaker','bomb','circle-check-big','ear','eye','fingerprint','flame','flask-conical','heart','heart-pulse','lamp','pill','shield','shield-alert','shield-check','siren','skull','smile','square-activity','syringe','thermometer','umbrella','circle-x','stethoscope','brain','dna','microscope','test-tube','hospital','ambulance','cross','activity','hand-heart','life-buoy','triangle-alert','octagon-alert'] },
  { label: 'Compras & Moda', icons: ['backpack','badge','box','briefcase','gift','heart','luggage','package','palette','shirt','shopping-bag','shopping-cart','star','tag','glasses','watch','crown','gem','footprints','scissors','ruler','receipt','store','percent','baby','ticket','hand-coins'] },
  { label: 'Construção & Indústria', icons: ['building','building-2','cog','construction','cpu','database','drill','factory','gauge','hammer','hard-hat','key','layers','link','monitor','plug','server','settings','shovel','square','truck','tv','wrench','forklift','brick-wall','fence','pickaxe','ruler','traffic-cone','container','weight','wind','blocks','paint-roller'] },
  { label: 'Educação & Ciência', icons: ['graduation-cap','school','book','book-open','library','notebook-pen','pencil','ruler','calculator','microscope','telescope','atom','flask-conical','beaker','test-tube','dna','brain','lightbulb','puzzle','globe','languages','presentation','projector','award','medal','scroll-text','sigma','pi','radical'] },
  { label: 'Setas & Direção', icons: ['arrow-up','arrow-down','arrow-left','arrow-right','arrow-up-right','arrow-down-right','arrow-up-left','arrow-down-left','arrow-big-right','arrow-big-left','chevron-up','chevron-down','chevron-left','chevron-right','chevrons-up','chevrons-down','chevrons-left','chevrons-right','corner-up-right','corner-down-left','move-horizontal','move-vertical','redo','undo','rotate-ccw','rotate-cw','refresh-ccw','trending-up','trending-down','navigation-2','circle-arrow-up','circle-arrow-down'] },
  { label: 'Tempo & Agenda', icons: ['clock','clock-1','clock-3','clock-9','alarm-clock','alarm-clock-check','timer','timer-off','hourglass','calendar','calendar-days','calendar-check','calendar-x','calendar-plus','calendar-clock','calendar-range','history','watch','sunrise','sunset','moon','sun','cake','bell-ring'] },
  { label: 'Arquivos & Documentos', icons: ['file','file-text','file-check','file-x','file-plus','files','folder','folder-open','folder-plus','folder-check','archive','book-marked','clipboard','clipboard-check','newspaper','scroll-text','sticky-note','notebook','paperclip','printer','save','download','upload','copy','scissors','trash-2','file-spreadsheet','file-code','file-image','file-audio','file-video','file-json','binary'] },
  { label: 'Formas & Símbolos', icons: ['circle','square','triangle','hexagon','octagon','diamond','star','heart','pentagon','shapes','spade','club','flame','droplet','zap','sparkle','sparkles','asterisk','hash','at-sign','percent','infinity','plus','minus','x','check','dot','grip','grip-vertical','grip-horizontal'] },
  { label: 'Clima & Estações', icons: ['sun','moon','cloud','cloud-rain','cloud-snow','cloud-lightning','cloud-drizzle','cloud-fog','wind','snowflake','droplet','rainbow','thermometer','thermometer-sun','thermometer-snowflake','sunrise','sunset','umbrella','tornado','haze','sun-snow','waves'] },
  { label: 'Segurança & Acesso', icons: ['lock','unlock','lock-keyhole','key','key-round','shield','shield-check','shield-alert','shield-off','fingerprint','scan-face','eye','eye-off','user-check','user-x','ban','circle-slash','alert-triangle','triangle-alert','octagon-alert','bell-off','vault'] },
  { label: 'Automação & Fluxo', icons: ['zap','zap-off','workflow','git-branch','git-merge','split','merge','repeat','repeat-1','rotate-cw','play','pause','square','power','toggle-right','toggle-left','settings-2','sliders-vertical','cpu','bot','webhook','circuit-board','waypoints','network','share-2','arrow-right-left'] },
  { label: 'Emoções & Reações', icons: ['smile','frown','meh','laugh','angry','heart','heart-crack','thumbs-up','thumbs-down','star','flame','party-popper','sparkles','hand-heart','annoyed','smile-plus'] },
  { label: 'Esporte & Bem-estar', icons: ['dumbbell','bike','trophy','medal','award','target','flag','timer','heart-pulse','activity','footprints','mountain','waves','goal','tent'] },
]

// Cores predefinidas do seletor (mesma paleta usada em espaços/pastas/projetos).
export const SWATCH_COLORS: string[] = [
  '#EF4444','#F97316','#D89A18','#EAB308','#22C55E','#10B981',
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

// ── Ícones recentemente usados (últimos escolhidos, mais recente primeiro) ──
const RECENT_ICONS_KEY = 'tf_recent_icons'
const MAX_RECENT_ICONS = 12

export function loadRecentIcons(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_ICONS_KEY) ?? '[]') } catch { return [] }
}
export function addRecentIcon(name: string) {
  try {
    const next = [name, ...loadRecentIcons().filter(n => n !== name)].slice(0, MAX_RECENT_ICONS)
    localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(next))
  } catch { /* noop */ }
}
