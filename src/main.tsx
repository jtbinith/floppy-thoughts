import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Credits for the open-source libraries behind HunchHack (also listed in the README).
console.info(
  '%cHunchHack%c is built with React Flow (https://reactflow.dev, MIT) by the xyflow team, Zod (https://zod.dev) and word data from Datamuse (https://www.datamuse.com/api/). Thank you!',
  'font-weight:bold;color:#e2955a',
  'color:inherit',
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
