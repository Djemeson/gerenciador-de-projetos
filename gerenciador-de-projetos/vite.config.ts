import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/gerenciador-de-projetos/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
