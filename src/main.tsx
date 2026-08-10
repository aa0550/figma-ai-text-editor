import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App'

const style = document.createElement('style')
style.textContent = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  @keyframes spin { to { transform: rotate(360deg); } }
  body { overflow: hidden; }
  button, select { outline: none; }
  button:focus, select:focus { outline: none; }
  button { transition: background-color 0.12s, border-color 0.12s; }
  .select-option:hover { background: #F0F0F0; color: #1E1E1E; }
  .select-trigger:hover { background: #EFEFEF !important; }
  .nav-btn-inactive:hover { background: rgba(0,0,0,0.06) !important; }
  .btn-primary:hover { background: #0B87E0 !important; }
  .btn-accept:hover { background: #0B87E0 !important; }
  .btn-secondary:hover { background: #F5F5F5 !important; }
  .btn-skip:hover { background: #F5F5F5 !important; }
  .key-link:hover { color: #1E1E1E !important; }
  .btn-undo:hover { color: #1E1E1E !important; }
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
