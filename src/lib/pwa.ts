import { useEffect, useState } from 'react'

/**
 * Instalação do app no celular (PWA).
 *
 * Três coisas moram aqui porque as três dependem do mesmo estado "o app está instalado?":
 * o registro do service worker, o convite de instalação e a cor da barra de status.
 *
 * O registro é **só em produção**: em desenvolvimento o service worker briga com o
 * recarregamento a quente do Vite e serve módulo velho, o que parece bug do código.
 */

const EH_IOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** No iOS o app instalado se identifica por `navigator.standalone`; nos demais, por media query. */
export function estaInstalado(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true
}

// ── Service worker ───────────────────────────────────────────────────────────

export function registrarServiceWorker() {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(e => {
      // Falhar aqui não pode derrubar o app: sem service worker ele continua funcionando,
      // só perde a instalação e o modo offline.
      console.warn('Service worker não registrado:', e)
    })
  })
}

// ── Cor da barra de status ───────────────────────────────────────────────────

const COR_ESCURA = '#08090C'   // --bg-app do tema escuro (padrão do app)
const COR_CLARA  = '#EEEEF1'   // --bg-app do tema claro

/**
 * Instalado, o app não tem barra do navegador — a barra de status do sistema encosta no
 * conteúdo. Se a cor não acompanhar o tema, fica uma faixa branca em cima do app escuro.
 * O tema é uma classe no `<html>` (ver Sidebar), então observar o elemento funciona
 * independentemente de onde o botão de alternar esteja.
 */
export function sincronizarCorDaBarra() {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  const aplicar = () => meta.setAttribute(
    'content',
    document.documentElement.classList.contains('dark') ? COR_ESCURA : COR_CLARA,
  )
  aplicar()
  new MutationObserver(aplicar).observe(document.documentElement, {
    attributes: true, attributeFilter: ['class'],
  })
}

// ── Convite de instalação ────────────────────────────────────────────────────

interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * O navegador dispara `beforeinstallprompt` uma única vez, e normalmente **antes** de a
 * tela de configurações existir. Por isso o evento é capturado no carregamento do módulo e
 * guardado — sem isso o botão "Instalar" quase nunca aparece.
 */
let eventoGuardado: EventoDeInstalacao | null = null
const inscritos = new Set<() => void>()
const avisar = () => inscritos.forEach(fn => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()                       // impede o banner automático do Chrome
    eventoGuardado = e as EventoDeInstalacao
    avisar()
  })
  window.addEventListener('appinstalled', () => { eventoGuardado = null; avisar() })
}

export interface EstadoDeInstalacao {
  /** Chrome/Edge/Android: dá para instalar com um clique. */
  podeInstalar: boolean
  /** Já está rodando como app instalado. */
  instalado: boolean
  /** iOS nunca dispara o evento — só resta ensinar o caminho manual. */
  precisaInstrucaoIOS: boolean
  instalar: () => Promise<'accepted' | 'dismissed' | 'indisponivel'>
}

export function usePwaInstall(): EstadoDeInstalacao {
  const [, forcar] = useState(0)
  const [instalado, setInstalado] = useState(estaInstalado)

  useEffect(() => {
    const fn = () => forcar(v => v + 1)
    inscritos.add(fn)
    const mq = window.matchMedia('(display-mode: standalone)')
    const onModo = () => setInstalado(estaInstalado())
    mq.addEventListener('change', onModo)
    return () => { inscritos.delete(fn); mq.removeEventListener('change', onModo) }
  }, [])

  return {
    podeInstalar: !!eventoGuardado && !instalado,
    instalado,
    precisaInstrucaoIOS: EH_IOS() && !instalado,
    instalar: async () => {
      if (!eventoGuardado) return 'indisponivel'
      await eventoGuardado.prompt()
      const { outcome } = await eventoGuardado.userChoice
      if (outcome === 'accepted') { eventoGuardado = null; avisar() }
      return outcome
    },
  }
}
