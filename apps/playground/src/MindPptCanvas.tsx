import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useEffect, useState } from 'react'

import type { CompiledElements } from './runtime.ts'

interface MindPptCanvasProps {
  elements: CompiledElements
}

export function MindPptCanvas({ elements }: MindPptCanvasProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)

  useEffect(() => {
    if (!api) return
    api.updateScene({ elements })
  }, [api, elements])

  return (
    <section className="canvas-panel">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{
          elements,
          scrollToContent: true,
          appState: {
            zenModeEnabled: true,
            frameRendering: {
              enabled: true,
              clip: false,
              name: false,
              outline: false,
            },
          },
        }}
        viewModeEnabled
      />
    </section>
  )
}
