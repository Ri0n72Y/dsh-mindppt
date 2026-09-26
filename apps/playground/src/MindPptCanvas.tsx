import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

type InitialData = Parameters<ExcalidrawImperativeAPI['updateScene']>[0]

interface MindPptCanvasProps {
  elements: NonNullable<InitialData['elements']>
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
