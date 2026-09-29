import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

export function focusSlideSurface(
  api: ExcalidrawImperativeAPI,
  slideId: string,
): boolean {
  const surfaceId = `slide:${slideId}/surface`
  const surface = api.getSceneElements().find((element) => element.id === surfaceId)

  if (!surface) return false

  api.scrollToContent(surface, {
    fitToViewport: true,
    viewportZoomFactor: 0.85,
    animate: false,
  })

  return true
}
