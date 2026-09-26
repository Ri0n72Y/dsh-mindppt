import { Excalidraw } from '@excalidraw/excalidraw'

import type { CompiledElements } from './runtime.ts'

interface MindPptCanvasProps {
  elements: CompiledElements
}

export function MindPptCanvas({ elements }: MindPptCanvasProps) {
  return (
    <section className="canvas-panel">
      <Excalidraw
        initialData={{
          elements,
          scrollToContent: true,
          appState: {
            zenModeEnabled: true,
          },
        }}
        viewModeEnabled
      />
    </section>
  )
}
