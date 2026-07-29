/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Cor de destaque: Índigo (estilo Linear/Notion) ──────────────────
        // Substitui o antigo roxo ClickUp. Mesmo papel dos tokens `brand-*`.
        brand: {
          50:  '#EEF0FF',
          100: '#E0E4FF',
          200: '#C7CCFE',
          300: '#A6ADFB',
          400: '#828BF6',
          500: '#6366F1',   // destaque principal
          600: '#4F46E5',   // botões / ações
          700: '#4338CA',
          800: '#3730A3',
          900: '#2C2879',
        },
        // ── Cores semânticas de feedback ────────────────────────────────────
        // Faltavam: o app tinha cor de *status de tarefa* e de *prioridade*, mas nada
        // para sucesso/aviso/erro/informação. Cada tela então inventava a sua
        // (`red-400`, `red-500`, `red-600`, `#E24B4A`, `#D85A30` no mesmo papel).
        // Os valores vêm das cores que o app já usava como referência: verde do status
        // "Concluído", âmbar da meta "Em risco", vermelho da prioridade "Urgente" e azul
        // do status "Em progresso".
        success: {
          50:  '#E8F6F0',
          100: '#D0EDE1',
          500: '#1D9E75',
          600: '#178462',
          700: '#12684D',
        },
        warning: {
          50:  '#FDF6E7',
          100: '#F9EAC6',
          500: '#D89A18',
          600: '#B57F12',
          700: '#8F640E',
        },
        danger: {
          50:  '#FDECEC',
          100: '#FAD7D7',
          500: '#E24B4A',
          600: '#C93B3A',
          700: '#A32E2D',
        },
        info: {
          50:  '#EAF3FC',
          100: '#D3E6F8',
          500: '#378ADD',
          600: '#2B72BC',
          700: '#215B98',
        },
        // ── Cinzas refinados (frios, quase neutros) — base minimalista ──────
        // Sobrescreve a paleta `gray` do Tailwind para dar acabamento premium
        // a todo o app sem tocar em cada componente.
        gray: {
          50:  'var(--gray-50)',
          100: 'var(--gray-100)',
          200: 'var(--gray-200)',
          300: 'var(--gray-300)',
          400: 'var(--gray-400)',
          500: 'var(--gray-500)',
          600: 'var(--gray-600)',
          700: 'var(--gray-700)',
          800: 'var(--gray-800)',
          900: 'var(--gray-900)',
        },
        // ── `slate` também sobrescrito (mesmo esquema RGB + <alpha-value>) ───
        // Vários componentes usam slate-* para painéis/cartões secundários;
        // sem isso, essas superfícies ficam claras/dessaturadas por cima do
        // fundo escuro no modo dark. Em modo claro os valores batem com o
        // slate padrão do Tailwind (nenhuma mudança visual); só o modo dark
        // remapeia para a mesma escala neutra do `gray` (ver index.css).
        slate: {
          50:  'rgb(var(--slate-50-rgb) / <alpha-value>)',
          100: 'rgb(var(--slate-100-rgb) / <alpha-value>)',
          200: 'rgb(var(--slate-200-rgb) / <alpha-value>)',
          300: 'rgb(var(--slate-300-rgb) / <alpha-value>)',
          400: 'rgb(var(--slate-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--slate-500-rgb) / <alpha-value>)',
          600: 'rgb(var(--slate-600-rgb) / <alpha-value>)',
          700: 'rgb(var(--slate-700-rgb) / <alpha-value>)',
          800: 'rgb(var(--slate-800-rgb) / <alpha-value>)',
          900: 'rgb(var(--slate-900-rgb) / <alpha-value>)',
        },
        // ── Sidebar (grafite profundo, tema escuro) ─────────────────────────
        cu: {
          bg:      '#111114',   // fundo da sidebar
          hover:   '#1B1C21',   // hover de item
          active:  '#26272D',   // item ativo
          border:  '#242529',   // bordas
          input:   '#191A1E',   // fundo de input
          text:    '#A6A7AE',   // texto padrão
          muted:   '#6B6D75',   // rótulos de seção / texto discreto
          'text-bright': '#FFFFFF', // texto ativo / hover
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // ── Sistema de elevação (sombras suaves e em camadas) ─────────────────
      boxShadow: {
        xs:    '0 1px 2px 0 rgba(23,24,28,0.04)',
        sm:    '0 1px 2px -1px rgba(23,24,28,0.06), 0 1px 3px 0 rgba(23,24,28,0.05)',
        md:    '0 2px 4px -2px rgba(23,24,28,0.06), 0 6px 16px -4px rgba(23,24,28,0.08)',
        lg:    '0 4px 8px -3px rgba(23,24,28,0.08), 0 12px 28px -6px rgba(23,24,28,0.12)',
        xl:    '0 8px 16px -6px rgba(23,24,28,0.10), 0 24px 48px -12px rgba(23,24,28,0.16)',
        '2xl': '0 16px 32px -8px rgba(23,24,28,0.16), 0 40px 72px -16px rgba(23,24,28,0.22)',
        focus: '0 0 0 3px rgba(99,102,241,0.35)',
      },
      // ── Raios um pouco mais suaves ────────────────────────────────────────
      borderRadius: {
        lg: '0.625rem',  // 10px
        xl: '0.875rem',  // 14px
      },
      keyframes: {
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.97) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        'scale-in': 'scale-in 0.14s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
