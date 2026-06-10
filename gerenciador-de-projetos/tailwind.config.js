/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F0EEFF',
          100: '#D9D4FF',
          200: '#B8AFFF',
          300: '#9589FF',
          400: '#8779F5',
          500: '#7B68EE',
          600: '#6457E0',
          700: '#5248CB',
          800: '#4239A0',
          900: '#2E2470',
        },
        // ClickUp sidebar dark theme tokens
        cu: {
          bg:      '#17192E',   // sidebar background
          hover:   '#1F2140',   // nav item hover
          active:  '#252847',   // nav item active
          border:  '#252847',   // borders
          input:   '#1C1E38',   // input background
          text:    '#A8A9BE',   // default text
          muted:   '#6B6B82',   // section labels / muted text
          'text-bright': '#FFFFFF', // active / hovered text
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
