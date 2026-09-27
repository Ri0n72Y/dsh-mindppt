import '@excalidraw/excalidraw/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import source from '../../../examples/m2-content-profile.mindppt?raw'
import { App } from './App.tsx'
import { compileMindPpt } from './runtime.ts'
import './style.css'

;(globalThis as { __MINDPPT_DEBUG__?: boolean }).__MINDPPT_DEBUG__ = true

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
