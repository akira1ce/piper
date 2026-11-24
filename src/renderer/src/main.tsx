import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/main.css'
import { themeActions } from './store/theme'

document.documentElement.dataset.os = window.api.platform
themeActions.init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
