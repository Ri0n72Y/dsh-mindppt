import '@excalidraw/excalidraw/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import source from '../../../examples/m4-branching-lr-tree.mindppt?raw'
import { App } from './App.tsx'
import { createPlaygroundRuntime } from './runtime.ts'
import './style.css'

const runtime = await createPlaygroundRuntime(source)
const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root')
}

createRoot(root).render(
  <StrictMode>
    <App runtime={runtime} />
  </StrictMode>,
)
