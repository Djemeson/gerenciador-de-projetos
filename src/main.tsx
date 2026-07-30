import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registrarServiceWorker, sincronizarCorDaBarra } from './lib/pwa'
import './index.css'

registrarServiceWorker()
sincronizarCorDaBarra()

// O boundary envolve tudo — inclusive a tela de login e o splash: uma exceção ali também
// terminava em tela branca sem explicação.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
