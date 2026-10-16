import { Excalidraw } from '@excalidraw/excalidraw'
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types'
import { useEffect, useRef, useState } from 'react'

import type { CameraFocusRequest } from 'dsh-mindppt-camera'

import { replaceMountedFiles } from './excalidraw-files.ts'
import { runCameraTransition } from './excalidraw-focus.ts'
import type { CameraTransitionController } from './excalidraw-focus.ts'
import type { CompiledElements } from './runtime.ts'

interface MindPptCanvasProps {
  elements: CompiledElements
  files: BinaryFiles
  focusRequest: CameraFocusRequest | undefined
  onApi?: (api: ExcalidrawImperativeAPI) => void
  onFontMetricsReady?: () => void
}

export function MindPptCanvas({
  elements,
  files,
  focusRequest,
  onApi,
  onFontMetricsReady,
}: MindPptCanvasProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const transitionRef = useRef<CameraTransitionController | null>(null)
  const needsInitialFit = useRef(true)
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)

  useEffect(() => {
    if (!api) return

    // Excalidraw addFiles loads images referenced by its current scene.
    api.updateScene({ elements })
    replaceMountedFiles(api, files)
    transitionRef.current?.reconcileScene()
  }, [api, elements, files])

  useEffect(() => {
    if (!api || !onFontMetricsReady) return

    let cancelled = false
    const refresh = () => {
      if (!cancelled) onFontMetricsReady()
    }

    document.fonts.addEventListener('loadingdone', refresh)
    void document.fonts.ready.then(refresh)

    return () => {
      cancelled = true
      document.fonts.removeEventListener('loadingdone', refresh)
    }
  }, [api, onFontMetricsReady])

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
        excalidrawAPI={(nextApi) => {
          apiRef.current = nextApi
          setApi(nextApi)
          onApi?.(nextApi)
        }}
        onChange={() => {
          if (!needsInitialFit.current) return
          const current = apiRef.current
          if (!current || current.getAppState().isLoading) return
          const surfaces = current.getSceneElements().filter(
            element => element.id.startsWith('slide:') && element.id.endsWith('/surface'),
          )
          if (!surfaces.length) return
          needsInitialFit.current = false
          current.scrollToContent(surfaces, {
            fitToViewport: true, viewportZoomFactor: 0.85, animate: false,
          })
        }}
        initialData={{
          elements,
          files,
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
