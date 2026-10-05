import { Excalidraw } from '@excalidraw/excalidraw'
import type { BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useEffect, useRef, useState } from 'react'
import type { CameraFocusRequest } from 'dsh-mindppt-camera'
import {
  replaceMountedFiles,
  runCameraTransition,
  type CameraTransitionController,
} from 'dsh-mindppt-canvas-excalidraw'
import type { CompiledElements } from './runtime.ts'

export function MindPptCanvas({
  elements,
  files,
  focusRequest,
  onFontMetricsReady,
  height = '100%',
}: {
  elements: CompiledElements
  files: BinaryFiles
  focusRequest?: CameraFocusRequest
  onFontMetricsReady?: () => void
  height?: string | number
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const transition = useRef<CameraTransitionController | null>(null)

  useEffect(() => {
    if (!api) return
    replaceMountedFiles(api, files)
    api.updateScene({ elements })
    transition.current?.reconcileScene()
  }, [api, elements, files])

  useEffect(() => {
    if (!api || !focusRequest) return
    const current = runCameraTransition(api, focusRequest)
    transition.current = current
    return () => {
      current.cancel()
      if (transition.current === current) transition.current = null
    }
  }, [api, focusRequest?.revision])

  useEffect(() => {
    if (!api || !onFontMetricsReady) return
    let active = true
    const refresh = () => { if (active) onFontMetricsReady() }
    document.fonts.addEventListener('loadingdone', refresh)
    void document.fonts.ready.then(refresh)
    return () => {
      active = false
      document.fonts.removeEventListener('loadingdone', refresh)
    }
  }, [api, onFontMetricsReady])

  return (
    <div style={{ minWidth: 0, minHeight: 0, height }}>
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{
          elements,
          files,
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
    </div>
  )
}
