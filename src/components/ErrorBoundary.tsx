import React from 'react'
import { AlertTriangle, RotateCcw, Copy } from 'lucide-react'

/**
 * Rede de segurança de renderização.
 *
 * Sem isto, qualquer exceção durante o render deixava **tela branca** — sem mensagem, sem
 * caminho de volta — num app que guarda o trabalho do dia. O dado em si não se perde (está
 * no armazenamento local e na nuvem), e é isso que a tela precisa dizer para a pessoa não
 * achar que perdeu tudo.
 *
 * Componente de classe porque `componentDidCatch` não tem equivalente em hooks.
 */
interface Props { children: React.ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Fica no console para investigação; o usuário vê a mensagem tratada abaixo.
    console.error('Falha de renderização capturada pelo ErrorBoundary:', error, info.componentStack)
  }

  private copiarDetalhes = () => {
    const { error } = this.state
    navigator.clipboard?.writeText(`${error?.name}: ${error?.message}\n\n${error?.stack ?? ''}`)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-app)] p-6">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-[0_14px_32px_-10px_rgba(23,24,28,.12)]">
          <div className="w-11 h-11 rounded-xl bg-danger-50 border border-danger-100 flex items-center justify-center mb-3">
            <AlertTriangle size={18} className="text-danger-600" />
          </div>

          <h1 className="text-[16px] font-extrabold tracking-tight text-gray-900">
            Algo quebrou nesta tela
          </h1>
          <p className="text-[12.5px] text-gray-600 mt-1.5 leading-relaxed">
            <strong className="font-semibold">Seus dados estão salvos</strong> — o problema é
            só na exibição. Recarregar costuma resolver; se voltar a acontecer na mesma tela,
            copie os detalhes técnicos e me mande.
          </p>

          <p className="mt-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-mono text-gray-700 break-words">
            {error.message || error.name}
          </p>

          <div className="flex items-center gap-2 mt-4">
            <button onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-[12.5px] font-bold rounded-lg transition-colors">
              <RotateCcw size={14} /> Recarregar
            </button>
            <button onClick={this.copiarDetalhes}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 hover:border-gray-300 text-gray-700 text-[12.5px] font-semibold rounded-lg transition-colors">
              <Copy size={14} /> Copiar detalhes
            </button>
          </div>
        </div>
      </div>
    )
  }
}
