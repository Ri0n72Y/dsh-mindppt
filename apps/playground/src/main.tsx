import '@excalidraw/excalidraw/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import customerSvg from '../../../examples/assets/customer.svg?raw'
import source from '../../../examples/m7-data-analysis.mindppt?raw'
import { App } from './App.tsx'
import { createPlaygroundRuntime } from './runtime.ts'
import './style.css'

const runtime = await createPlaygroundRuntime(source, {
  documentPath: 'examples/m7-data-analysis.mindppt',
  files: {
    'examples/assets/customer.svg': {
      mimeType: 'image/svg+xml',
      dataURL: 'data:image/svg+xml;base64,' + btoa(customerSvg),
    },
  },
})
const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root')
}

createRoot(root).render(
  <StrictMode>
    <App runtime={runtime} />
  </StrictMode>,
)
