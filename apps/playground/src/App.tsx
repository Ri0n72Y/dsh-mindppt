import { MindPptCanvas } from './MindPptCanvas.tsx'
import type { CompiledElements } from './runtime.ts'

interface AppProps {
  source: string
  elements: CompiledElements
}

export function App({ source, elements }: AppProps) {
  return (
    <main className="playground">
      <aside className="source-panel">
        <div className="panel-label">MindPPT source</div>
        <pre>{source}</pre>
      </aside>

      <MindPptCanvas elements={elements} />
    </main>
  )
}
