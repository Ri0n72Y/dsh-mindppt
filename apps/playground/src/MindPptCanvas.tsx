import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useEffect, useState } from 'react'

import type { CameraFocusRequest } from 'dsh-mindppt-camera'

import { runCameraTransition } from './excalidraw-focus.ts'
import type { CompiledElements } from './runtime.ts'

interface MindPptCanvasProps {
  elements: CompiledElements
  focusRequest: CameraFocusRequest | undefined
}

export function MindPptCanvas({
  elements,
  focusRequest,
}: MindPptCanvasProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)

  useEffect(() => {
    if (!api) return
    api.updateScene({ elements })
  }, [api, elements])

  useEffect(() => {
    if (!api || !focusRequest) return

    return runCameraTransition(api, focusRequest)
  }, [api, focusRequest?.revision])

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
