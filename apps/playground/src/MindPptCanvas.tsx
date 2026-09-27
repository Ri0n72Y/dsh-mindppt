import { Excalidraw } from '@excalidraw/excalidraw'

import { debugMountedElements, type CompiledElements } from './runtime.ts'

interface MindPptCanvasProps {
  elements: CompiledElements
}

let lastDebugSignature = ''

export function MindPptCanvas({ elements }: MindPptCanvasProps) {
  return (
    <section className="canvas-panel">
      <Excalidraw
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
        onChange={(currentElements) => {
          for (const element of currentElements) {
            if (
              element.type !== 'text' ||
              !('text' in element) ||
              !element.id.includes('/extension:')
            ) continue

            const signature = [
              element.id,
              element.text,
              element.width,
              element.height,
            ].join('|')

            if (signature !== lastDebugSignature) {
              lastDebugSignature = signature
              debugMountedElements(currentElements)
            }
            break
          }
        }}
        viewModeEnabled
      />
    </section>
  )
}
