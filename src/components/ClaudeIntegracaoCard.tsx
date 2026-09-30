import { useEffect, useState } from 'react'
import { Bot, Copy, Check, KeyRound, AlertCircle, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'

/**
 * Chave pessoal do conector do Claude (DIRETRIZES, seção 17). A chave aparece uma única
 * vez, logo após ser gerada — o servidor guarda só o hash dela. Gerar outra revoga a
 * anterior, então perder a chave se resolve gerando de novo.
 */
type Status = { ativa: false } | { ativa: true; criadaEm: string; final: string; usadaEm: string | null }

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca')

export function ClaudeIntegracaoCard() {
  const user = useAuthStore(s => s.user)
  const [status, setStatus] = useState<Status | null>(null)
  const [chaveNova, setChaveNova] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const chamar = async (method: 'GET' | 'POST' | 'DELETE') => {
    if (!user) throw new Error('Entre com a conta Google para usar a integração.')
    const r = await fetch('/api/claude-chave', { method, headers: { Authorization: `Bearer ${await user.getIdToken()}` } })
    const corpo = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(corpo.error || `Falha (${r.status}).`)
    return corpo
  }

  useEffect(() => {
    if (!user) return
    chamar('GET').then(setStatus).catch(e => setErro(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const gerar = async () => {
    if (status?.ativa && !confirm('Gerar uma chave nova desliga a atual: onde ela estiver configurada, o Claude perde o acesso até você colar a nova. Continuar?')) return
    setOcupado(true); setErro(null)
    try {
      const { chave } = await chamar('POST')
      setChaveNova(chave)
      setStatus(await chamar('GET'))
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }
  const revogar = async () => {
    if (!confirm('Revogar a chave? O Claude deixa de acessar suas tarefas até você gerar outra.')) return
    setOcupado(true); setErro(null)
    try { setStatus(await chamar('DELETE')); setChaveNova(null) } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }
  const copiar = (rotulo: string, texto: string) =>
    navigator.clipboard?.writeText(texto).then(() => { setCopiado(rotulo); setTimeout(() => setCopiado(null), 1500) }).catch(() => {})

  const origem = typeof window !== 'undefined' ? window.location.origin : ''
  const comando = chaveNova && `claude mcp add --transport http --scope user gerenciador ${origem}/api/mcp --header "Authorization: Bearer ${chaveNova}"`
  const url = chaveNova && `${origem}/api/mcp/${chaveNova}`

  const Caixa = ({ rotulo, texto, ajuda }: { rotulo: string; texto: string; ajuda: string }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-gray-500">{rotulo}</span>
        <button onClick={() => copiar(rotulo, texto)} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
          {copiado === rotulo ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar</>}
        </button>
      </div>
      <pre className="text-[11px] font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap break-all text-gray-700">{texto}</pre>
      <p className="text-[10px] text-gray-400 mt-1">{ajuda}</p>
    </div>
  )

  return (
    <div className="border-b border-gray-100 pb-5">
      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Bot size={12} className="text-brand-500"/> Integração com o Claude
      </label>
      <p className="text-[11px] text-gray-400 mb-3">
        Deixa o Claude ler e organizar suas tarefas pelo ID (T-142, P-12): criar subtarefas e
        checklists, marcar o que terminou, registrar onde parou e montar relatórios. Ele nunca exclui nada.
      </p>

      {!user ? (
        <p className="text-[11px] text-gray-500">Entre com a conta Google para ativar.</p>
      ) : status === null && !erro ? (
        <p className="text-[11px] text-gray-400 flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin"/> Verificando…</p>
      ) : (
        <div className="space-y-3">
          {status?.ativa && (
            <div className="flex items-center gap-2 text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <KeyRound size={13} className="text-success-600 flex-shrink-0"/>
              <span className="flex-1">Chave ativa (…{status.final}) · criada {quando(status.criadaEm)} · último uso {quando(status.usadaEm)}</span>
            </div>
          )}

          {chaveNova && comando && url && (
            <div className="space-y-3 p-3 rounded-xl border border-brand-200 bg-brand-50/40">
              <p className="text-[11px] font-semibold text-brand-800">
                Copie agora: esta chave não aparece de novo. Se perder, é só gerar outra.
              </p>
              <Caixa rotulo="Claude Code (terminal)" texto={comando} ajuda="Cole num terminal uma vez; vale para todos os projetos."/>
              <Caixa rotulo="Claude no navegador, app e Cowork" texto={url} ajuda="Em Configurações → Conectores → Adicionar conector personalizado. A URL inteira funciona como senha: não compartilhe."/>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={gerar} disabled={ocupado}
              className="text-xs px-3 py-2 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {status?.ativa ? 'Gerar nova chave' : 'Gerar chave'}
            </button>
            {status?.ativa && (
              <button onClick={revogar} disabled={ocupado}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium">
                Revogar
              </button>
            )}
          </div>
        </div>
      )}

      {erro && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-danger-50 border border-danger-100 mt-3">
          <AlertCircle size={12} className="text-danger-600 mt-0.5 flex-shrink-0"/>
          <p className="text-[11px] text-danger-700 leading-relaxed">{erro}</p>
        </div>
      )}
    </div>
  )
}
