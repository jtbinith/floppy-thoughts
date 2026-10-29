import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-400-italic.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import '@fontsource/bricolage-grotesque/latin-800.css'
import './index.css'
import App from './App.tsx'



// Credits for the open-source libraries behind Floppy Thoughts (also listed in the README).
console.info(
  '%cFloppy Thoughts%c is built with React Flow (https://reactflow.dev, MIT) by the xyflow team, Zod (https://zod.dev) and word data from Datamuse (https://www.datamuse.com/api/). Thank you!',
  'font-weight:bold;color:#e2955a',
  'color:inherit',
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
