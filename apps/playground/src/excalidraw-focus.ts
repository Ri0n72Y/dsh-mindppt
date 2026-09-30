import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { CameraFocusRequest } from 'dsh-mindppt-camera'

export const CAMERA_TARGET_ZOOM_FACTOR = 0.85
export const CAMERA_ZOOM_OUT_FACTOR = 0.55
export const CAMERA_ZOOM_OUT_DURATION = 220
export const CAMERA_TRAVEL_DURATION = 340
export const CAMERA_ZOOM_IN_DURATION = 220

export function runCameraTransition(
  api: ExcalidrawImperativeAPI,
  request: CameraFocusRequest,
): () => void {
  let cancelled = false
  let pendingTimer: ReturnType<typeof setTimeout> | undefined

  const cancel = () => {
    cancelled = true
    if (pendingTimer !== undefined) {
      clearTimeout(pendingTimer)
      pendingTimer = undefined
    }
  }

  const resolveSurface = (slideId: string) => {
    const surfaceId = `slide:${slideId}/surface`
    return api.getSceneElements().find((element) => element.id === surfaceId)
  }

  const schedule = (duration: number, next: () => void) => {
    pendingTimer = setTimeout(() => {
      pendingTimer = undefined
      if (!cancelled) next()
    }, duration)
  }

  const zoomInTarget = () => {
    if (cancelled) return

    const targetSurface = resolveSurface(request.slideId)
    if (!targetSurface) return

    api.scrollToContent(targetSurface, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
  }

  const travelToTarget = () => {
    if (cancelled) return

    const targetSurface = resolveSurface(request.slideId)
    if (!targetSurface) return

    api.scrollToContent(targetSurface, {
      animate: true,
      duration: CAMERA_TRAVEL_DURATION,
    })
    schedule(CAMERA_TRAVEL_DURATION, zoomInTarget)
  }

  if (request.fromSlideId === request.slideId) {
    zoomInTarget()
    return cancel
  }

  // Avoid moving away from the current viewport when the destination is absent.
  // Target phases still resolve again so source recompiles cannot leave stale
  // Excalidraw element objects queued in the choreography.
  if (!resolveSurface(request.slideId)) return cancel

  if (!request.fromSlideId) {
    travelToTarget()
    return cancel
  }

  const sourceSurface = resolveSurface(request.fromSlideId)
  if (!sourceSurface) {
    travelToTarget()
    return cancel
  }

  api.scrollToContent(sourceSurface, {
    fitToViewport: true,
    viewportZoomFactor: CAMERA_ZOOM_OUT_FACTOR,
    animate: true,
    duration: CAMERA_ZOOM_OUT_DURATION,
  })
  schedule(CAMERA_ZOOM_OUT_DURATION, travelToTarget)

  return cancel
}
