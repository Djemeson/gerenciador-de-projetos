/**
 * Ditado por voz (Web Speech API).
 *
 * **O que é possível e o que não é.** O pedido original falava em um *widget* de tela
 * inicial que já abrisse escutando. Widget de verdade — aquele quadradinho na home do
 * Android — só existe para app nativo; nenhuma API da web cria um. O mais próximo que um
 * PWA alcança é um **atalho no ícone do app** (segurar o ícone → "Nova tarefa por voz"),
 * que abre já gravando. É o que está implementado, via `shortcuts` no manifesto apontando
 * para `/?acao=voz`.
 *
 * O reconhecimento roda **no dispositivo/navegador**, sem chave de IA e sem custo. No
 * Chrome (Android e computador) funciona bem em pt-BR; no Safari existe sob prefixo e é
 * menos previsível; no Firefox não existe. Por isso tudo aqui começa por `suportaFala()` —
 * a interface só mostra o microfone quando há suporte, em vez de oferecer um botão que
 * falha ao ser tocado.
 */

type ReconhecimentoEvento = {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

interface Reconhecimento {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: ReconhecimentoEvento) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function construtor(): (new () => Reconhecimento) | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function suportaFala(): boolean {
  return construtor() !== null
}

export interface OuvinteDeFala {
  /** Encerra e devolve o texto final. */
  parar: () => void
  /** Cancela sem entregar nada. */
  cancelar: () => void
}

export interface OpcoesDeFala {
  /** Texto parcial, atualizado enquanto a pessoa fala. */
  aoTranscrever: (texto: string, definitivo: boolean) => void
  aoTerminar?: (textoFinal: string) => void
  aoFalhar?: (motivo: string) => void
}

const MOTIVOS: Record<string, string> = {
  'not-allowed':      'Permissão de microfone negada. Libere o microfone para este site.',
  'service-not-allowed': 'O navegador bloqueou o reconhecimento de fala.',
  'no-speech':        'Não ouvi nada. Tente de novo mais perto do microfone.',
  'audio-capture':    'Nenhum microfone encontrado.',
  'network':          'Sem conexão para o reconhecimento de fala.',
  'aborted':          '',   // cancelamento pedido pelo usuário: não é erro para mostrar
}

/**
 * Começa a escutar. Devolve `null` quando não há suporte — quem chama deve ter checado
 * antes com `suportaFala()`, mas o retorno nulo evita que um caminho esquecido quebre.
 */
export function ouvirFala(op: OpcoesDeFala): OuvinteDeFala | null {
  const Ctor = construtor()
  if (!Ctor) return null

  const rec = new Ctor()
  rec.lang = 'pt-BR'
  // `continuous` para a frase inteira não ser cortada numa pausa de respiração — quem
  // dita uma tarefa costuma parar no meio para pensar.
  rec.continuous = true
  rec.interimResults = true

  let finalizado = ''
  let cancelado = false

  rec.onresult = (e) => {
    let parcial = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const alt = e.results[i][0]?.transcript ?? ''
      if (e.results[i].isFinal) finalizado += alt
      else parcial += alt
    }
    op.aoTranscrever((finalizado + parcial).trim(), false)
  }

  rec.onerror = (e) => {
    const msg = MOTIVOS[e.error] ?? `Falha no reconhecimento (${e.error}).`
    if (msg) op.aoFalhar?.(msg)
  }

  rec.onend = () => {
    if (cancelado) return
    const texto = finalizado.trim()
    op.aoTranscrever(texto, true)
    op.aoTerminar?.(texto)
  }

  try { rec.start() } catch { return null }

  return {
    parar:    () => { try { rec.stop() } catch { /* já parado */ } },
    cancelar: () => { cancelado = true; try { rec.abort() } catch { /* já parado */ } },
  }
}
