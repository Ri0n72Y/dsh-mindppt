import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { CompiledElements } from './runtime.ts'

export function fitWholeScene(
  api: ExcalidrawImperativeAPI,
  elements: CompiledElements,
): void {
  api.refresh()
  if (elements.length === 0) return
  api.scrollToContent(elements, {
    fitToViewport: true,
    viewportZoomFactor: 0.9,
  })
}
