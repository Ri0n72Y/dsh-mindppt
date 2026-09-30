import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useEffect, useRef, useState } from 'react'

import type { CameraFocusRequest } from 'dsh-mindppt-camera'

import { runCameraTransition } from './excalidraw-focus.ts'
import type { CameraTransitionController } from './excalidraw-focus.ts'
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
  const transitionRef = useRef<CameraTransitionController | null>(null)

  useEffect(() => {
    if (!api) return

    api.updateScene({ elements })
    transitionRef.current?.reconcileScene()
  }, [api, elements])

  useEffect(() => {
    if (!api || !focusRequest) return

    const transition = runCameraTransition(api, focusRequest)
    transitionRef.current = transition

    return () => {
      transition.cancel()
      if (transitionRef.current === transition) {
        transitionRef.current = null
      }
    }
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
