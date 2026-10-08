import { Excalidraw } from '@excalidraw/excalidraw'
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types'
import { useEffect, useRef, useState } from 'react'
import type { CameraFocusRequest } from 'dsh-mindppt-camera'
import {
  replaceMountedFiles,
  runCameraTransition,
  type CameraTransitionController,
} from 'dsh-mindppt-canvas-excalidraw'
import { FontMetricRefreshBinding } from './font-metrics.ts'
import { fitWholeScene } from './panorama-fit.ts'
import type { CompiledElements } from './runtime.ts'

interface CanvasProps {
  elements: CompiledElements
  files: BinaryFiles
  onFontMetricsReady?: (() => void) | undefined
  height?: string | number | undefined
}

export function MindPptCanvas({
  elements,
  files,
  focusRequest,
  onFontMetricsReady,
  height = '100%',
}: CanvasProps & {
  focusRequest?: CameraFocusRequest | undefined
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const transition = useRef<CameraTransitionController | null>(null)
  useFontMetricRefresh(api, onFontMetricsReady)

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

  return (
    <div style={{ minWidth: 0, minHeight: 0, height }}>
      <CanvasView elements={elements} files={files} setApi={setApi} />
    </div>
  )
}

export function MindPptPanorama({
  elements,
  files,
  onFontMetricsReady,
  height = '100%',
}: CanvasProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const host = useRef<HTMLDivElement>(null)
  useFontMetricRefresh(api, onFontMetricsReady)

  useEffect(() => {
    if (!api) return
    replaceMountedFiles(api, files)
    api.updateScene({ elements })
    fitWholeScene(api, elements)
  }, [api, elements, files])

  useEffect(() => {
    if (!api || !host.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => fitWholeScene(api, elements))
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [api, elements])

  return (
    <div
      ref={host}
      aria-label="MindPPT panorama"
      style={{ minWidth: 0, minHeight: 0, height, pointerEvents: 'none' }}
    >
      <CanvasView elements={elements} files={files} setApi={setApi} />
    </div>
  )
}

function CanvasView({ elements, files, setApi }: {
  elements: CompiledElements
  files: BinaryFiles
  setApi(api: ExcalidrawImperativeAPI): void
}) {
  return (
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
  )
}

function useFontMetricRefresh(
  api: ExcalidrawImperativeAPI | null,
  refresh: (() => void) | undefined,
): void {
  const binding = useRef<FontMetricRefreshBinding | null>(null)
  if (!binding.current) binding.current = new FontMetricRefreshBinding()
  binding.current.update(refresh)
  useEffect(() => {
    if (!api) return
    return binding.current?.attach(document.fonts)
  }, [api])
}
