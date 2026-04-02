import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from './context/LocaleContext'
import './index.css'
import App from './App.jsx'
import { loadPublicSyncConfig } from './syncBootstrap'

async function bootstrap() {
  await loadPublicSyncConfig()
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </StrictMode>,
  )
}

void bootstrap()
