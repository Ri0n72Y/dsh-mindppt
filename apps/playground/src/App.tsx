import type { ReactElement } from 'react'

import { MindPptCanvas } from './MindPptCanvas.tsx'

interface AppProps {
  source: string
  canvas: ReactElement
}

export function App({ source, canvas }: AppProps) {
  return (
    <main className="playground">
      <aside className="source-panel">
        <div className="panel-label">MindPPT source</div>
        <pre>{source}</pre>
      </aside>

      {canvas}
    </main>
  )
}
