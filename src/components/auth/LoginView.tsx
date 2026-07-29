import React from 'react'
import { Zap, AlertCircle, Loader2, CheckSquare, Layers, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'

/** Logotipo do Google (marca registrada) — único SVG de marca do app; o resto da UI usa lucide. */
function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

const FEATURES = [
  { icon: Layers,      label: 'Espaços, pastas e projetos organizados como no ClickUp' },
  { icon: CheckSquare, label: 'Tarefas, subtarefas, checklists e metas num painel só' },
  { icon: RefreshCw,   label: 'Tudo sincronizado em tempo real entre o PC e o celular' },
]

export function LoginView() {
  const { signIn, signingIn, authError } = useAuthStore()

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-app)] p-4">
      <div className="w-full max-w-[900px] grid md:grid-cols-2 rounded-2xl overflow-hidden bg-white shadow-[0_1px_2px_rgba(23,24,28,.04),0_14px_32px_-10px_rgba(23,24,28,.12)] border border-gray-200/70">

        {/* Coluna de marca — escondida no celular pra tela caber sem rolagem */}
        <div className="hidden md:flex flex-col justify-between p-8 bg-[#111114] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1B1C22] border border-white/10 flex items-center justify-center">
              <Zap size={16} className="text-brand-400" />
            </div>
            <span className="text-[15px] font-extrabold tracking-tight">Gerenciador de Projetos</span>
          </div>

          <div className="space-y-5 py-10">
            <h2 className="text-2xl font-extrabold tracking-tight leading-snug">
              Seus projetos<br />em qualquer dispositivo.
            </h2>
            <ul className="space-y-3">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-start gap-2.5 text-[13px] text-white/70 leading-relaxed">
                  <span className="w-[26px] h-[26px] rounded-lg bg-white/[.06] flex items-center justify-center flex-shrink-0 mt-px">
                    <Icon size={13} className="text-brand-400" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-white/35 leading-relaxed">
            Entrando com o Google, seus dados ficam vinculados à sua conta e sincronizam
            sozinhos em todo dispositivo onde você entrar.
          </p>
        </div>

        {/* Coluna de login */}
        <div className="p-7 md:p-10 flex flex-col justify-center">
          {/* Marca compacta — só no celular, onde a coluna escura não aparece */}
          <div className="flex md:hidden items-center gap-2.5 mb-7">
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
              <Zap size={16} className="text-brand-500" />
            </div>
            <span className="text-[15px] font-extrabold tracking-tight text-gray-900">Gerenciador de Projetos</span>
          </div>

          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">Entrar</h1>
          <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
            Use sua conta Google para acessar seus projetos e tarefas.
          </p>

          <button
            onClick={signIn}
            disabled={signingIn}
            className="mt-6 w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-gray-200 bg-white text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-xs active:scale-[.99]"
          >
            {signingIn ? <Loader2 size={17} className="animate-spin text-gray-400" /> : <GoogleMark />}
            {signingIn ? 'Entrando…' : 'Entrar com Google'}
          </button>

          {authError && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700">
              <AlertCircle size={14} className="shrink-0 mt-px" />
              <span className="text-[11.5px] leading-relaxed">{authError}</span>
            </div>
          )}

          <p className="text-[11px] text-gray-400 mt-6 leading-relaxed">
            É um app de uso pessoal: só a sua conta enxerga os seus dados.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Tela intermediária enquanto o Firebase decide se já existe sessão salva. */
export function AuthSplash() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 bg-[var(--bg-app)]">
      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-xs">
        <Zap size={18} className="text-brand-500" />
      </div>
      <Loader2 size={16} className="animate-spin text-gray-300" />
    </div>
  )
}
