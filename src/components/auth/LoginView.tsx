import React from 'react'
import { Zap, AlertCircle, Loader2, CheckSquare, Layers, RefreshCw, ArrowRight } from 'lucide-react'
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

// Rótulos curtos de propósito: as três colunas do rodapé do cartão só ficam alinhadas
// enquanto cada um couber numa linha.
const FEATURES = [
  { icon: Layers,      label: 'Projetos' },
  { icon: CheckSquare, label: 'Tarefas e metas' },
  { icon: RefreshCw,   label: 'Sincronia' },
]

/** Fundo compartilhado pela tela de login e pelo splash — grafite, halos e malha. */
function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#08090C] flex items-center justify-center p-5">
      {/* Halos de cor */}
      <div className="login-orb login-orb-a w-[520px] h-[520px] -top-40 -left-32 bg-[#4F46E5]" />
      <div className="login-orb login-orb-b w-[440px] h-[440px] -bottom-36 -right-24 bg-[#7C3AED]" />
      <div className="login-orb w-[320px] h-[320px] top-1/3 left-1/2 -translate-x-1/2 bg-[#2563EB] opacity-[.28]" />
      {/* Malha fina por cima dos halos */}
      <div className="login-grid absolute inset-0" />
      {/* Vinheta — puxa o olho para o centro */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,transparent,rgba(8,9,12,.75))]" />

      <div className="relative w-full flex items-center justify-center">{children}</div>
    </div>
  )
}

export function LoginView() {
  const { signIn, signingIn, authError } = useAuthStore()

  return (
    <Backdrop>
      <div className="w-full max-w-[400px]">

        {/* Marca */}
        <div className="login-rise flex flex-col items-center text-center mb-8" style={{ animationDelay: '.05s' }}>
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-brand-500 blur-xl opacity-50" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-[#7C3AED] flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(79,70,229,.7)] ring-1 ring-white/20">
              <Zap size={24} className="text-white" fill="currentColor" />
            </div>
          </div>
          <span className="mt-5 text-[10px] font-bold uppercase tracking-[.2em] text-white/45">
            Gerenciador de Projetos
          </span>
          <h1 className="mt-3 text-[27px] leading-tight font-extrabold tracking-tight text-white">
            Bem-vindo de volta
          </h1>
          <p className="mt-2 text-[13.5px] text-white/55 leading-relaxed max-w-[300px]">
            Seus projetos, tarefas e metas — no computador e no celular, sempre em dia.
          </p>
        </div>

        {/* Cartão de vidro */}
        <div className="login-rise relative rounded-2xl bg-white/[.045] backdrop-blur-xl border border-white/10 shadow-[0_24px_70px_-20px_rgba(0,0,0,.8)] overflow-hidden"
             style={{ animationDelay: '.16s' }}>
          {/* Fio de luz na borda de cima */}
          <div className="login-hairline absolute top-0 inset-x-8 h-px" />

          <div className="p-7">
            <button
              onClick={signIn}
              disabled={signingIn}
              className="group w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-white text-[14px] font-semibold text-gray-800 shadow-[0_6px_20px_-6px_rgba(0,0,0,.5)] hover:shadow-[0_10px_28px_-6px_rgba(0,0,0,.6)] hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all duration-200"
            >
              {signingIn
                ? <Loader2 size={18} className="animate-spin text-gray-400" />
                : <GoogleMark size={19} />}
              {signingIn ? 'Entrando…' : 'Continuar com Google'}
              {!signingIn && (
                <ArrowRight size={15} className="text-gray-300 -ml-1 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
              )}
            </button>

            {authError && (
              <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-400/25 text-red-200">
                <AlertCircle size={14} className="shrink-0 mt-px" />
                <span className="text-[11.5px] leading-relaxed">{authError}</span>
              </div>
            )}

            {/* Recursos — discretos, separados por um filete */}
            <div className="mt-7 pt-6 border-t border-white/[.07] grid grid-cols-3 gap-2">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center text-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-white/[.06] border border-white/[.08] flex items-center justify-center">
                    <Icon size={14} className="text-brand-300" />
                  </span>
                  <span className="text-[10.5px] leading-tight text-white/55 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="login-rise mt-6 text-center text-[11px] text-white/40 leading-relaxed px-4"
           style={{ animationDelay: '.28s' }}>
          App de uso pessoal. Seus dados ficam vinculados à sua conta Google e só você os enxerga.
        </p>
      </div>
    </Backdrop>
  )
}

/** Tela intermediária enquanto o Firebase decide se já existe sessão salva. */
export function AuthSplash() {
  return (
    <Backdrop>
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-brand-500 blur-xl opacity-50" />
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-[#7C3AED] flex items-center justify-center ring-1 ring-white/20">
            <Zap size={24} className="text-white" fill="currentColor" />
          </div>
        </div>
        <Loader2 size={16} className="animate-spin text-white/30" />
      </div>
    </Backdrop>
  )
}
