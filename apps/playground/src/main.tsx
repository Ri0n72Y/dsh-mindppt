import '@excalidraw/excalidraw/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import source from '../../../examples/hello-world.mindppt?raw'
import { App } from './App.tsx'
import { compileMindPpt } from './runtime.ts'
import './style.css'

const elements = await compileMindPpt(source)
const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root')
}

createRoot(root).render(
  <StrictMode>
    <App source={source} elements={elements} />
  </StrictMode>,
)
