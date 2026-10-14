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

  useEffect(() => {
    if (!api) return

    // Excalidraw addFiles loads images referenced by its current scene.
    api.updateScene({ elements })
    replaceMountedFiles(api, files)
    const state = api.getAppState()
    console.log('P3A_MOUNT', JSON.stringify({
      width: state.width, height: state.height,
      scrollX: state.scrollX, scrollY: state.scrollY,
      zoom: state.zoom.value, mounted: Object.keys(api.getFiles()),
      images: api.getSceneElements().filter(e => e.type === 'image')
        .map(e => ({ id: e.id, fileId: (e as any).fileId, x: e.x, y: e.y, width: e.width, height: e.height })),
    }))
    // Initial Excalidraw scrollToContent can precede host viewport sizing.
    // Fit actual semantic slides once; subsequent Camera requests own navigation.
    if (needsInitialFit.current) {
      const surfaces = api.getSceneElements().filter(
        element => element.id.startsWith('slide:') && element.id.endsWith('/surface'),
      )
      if (surfaces.length > 0) {
        console.log('P3A_FIT_BEFORE', JSON.stringify({
          app: { width: state.width, height: state.height, scrollX: state.scrollX, scrollY: state.scrollY, zoom: state.zoom.value },
          surfaces: surfaces.map(e => ({x:e.x,y:e.y,width:e.width,height:e.height})),
        }))
        needsInitialFit.current = false
        api.scrollToContent(surfaces, {
          fitToViewport: true, viewportZoomFactor: 0.85, animate: false,
        })
        requestAnimationFrame(() => {
          const after = api.getAppState()
          console.log('P3A_FIT_RAF', JSON.stringify({ width: after.width, height: after.height, scrollX: after.scrollX, scrollY: after.scrollY, zoom: after.zoom.value }))
        })
      }
    }
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
          setApi(nextApi)
          onApi?.(nextApi)
        }}
        initialData={{
          elements,
          files,
          // The host applies one fit after mount; avoid Excalidraw's later auto-fit.
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
