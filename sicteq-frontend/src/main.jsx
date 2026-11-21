import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { aplicarTema, temaActual } from './tema'

aplicarTema(temaActual()) // antes de dibujar: sin parpadeo del tema equivocado

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
