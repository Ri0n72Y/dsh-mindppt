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
          const extensionText = currentElements.find(
            (element) =>
              element.type === 'text' &&
              element.id.includes('/extension:'),
          )
          const signature = extensionText
            ? [
                extensionText.id,
                extensionText.text,
                extensionText.width,
                extensionText.height,
              ].join('|')
            : ''

          if (signature && signature !== lastDebugSignature) {
            lastDebugSignature = signature
            debugMountedElements(currentElements)
          }
        }}
        viewModeEnabled
      />
    </section>
  )
}
