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
  .select-option:hover { background: rgba(13,153,255,0.1); color: #0D99FF; }
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
