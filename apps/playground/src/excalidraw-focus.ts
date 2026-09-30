import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { CameraFocusRequest } from 'dsh-mindppt-camera'

export const CAMERA_TARGET_ZOOM_FACTOR = 0.85
export const CAMERA_ZOOM_OUT_FACTOR = 0.55
export const CAMERA_ZOOM_OUT_DURATION = 220
export const CAMERA_TRAVEL_DURATION = 340
export const CAMERA_ZOOM_IN_DURATION = 220

export interface CameraTransitionController {
  cancel(): void
  reconcileScene(): void
}

type TransitionPhase = 'zoom-out' | 'travel' | 'zoom-in' | 'done' | 'cancelled'
type SceneElement = ReturnType<
  ExcalidrawImperativeAPI['getSceneElements']
>[number]

export function runCameraTransition(
  api: ExcalidrawImperativeAPI,
  request: CameraFocusRequest,
): CameraTransitionController {
  let phase: TransitionPhase = 'done'
  let pendingTimer: ReturnType<typeof setTimeout> | undefined
  let activeSurface: SceneElement | undefined

  const clearPendingTimer = () => {
    if (pendingTimer !== undefined) {
      clearTimeout(pendingTimer)
      pendingTimer = undefined
    }
  }

  const interruptViewportAnimation = () => {
    if (!activeSurface) return

    const { scrollX, scrollY, zoom } = api.getAppState()

    // Excalidraw 0.18.0 cancels its in-progress RAF whenever a non-string
    // scrollToContent command starts. Issue a synchronous command only to
    // release that animation ownership, then restore the exact interpolated
    // viewport captured immediately before the interruption.
    api.scrollToContent(activeSurface, { animate: false })
    api.updateScene({
      appState: {
        scrollX,
        scrollY,
        zoom,
      },
    })
  }

  const cancel = () => {
    if (phase === 'cancelled' || phase === 'done') return

    phase = 'cancelled'
    clearPendingTimer()
    interruptViewportAnimation()
  }

  const resolveSurface = (slideId: string) => {
    const surfaceId = `slide:${slideId}/surface`
    return api.getSceneElements().find((element) => element.id === surfaceId)
  }

  const schedule = (duration: number, next: () => void) => {
    clearPendingTimer()
    pendingTimer = setTimeout(() => {
      pendingTimer = undefined
      if (phase !== 'cancelled') next()
    }, duration)
  }

  const finish = () => {
    if (phase !== 'cancelled') {
      phase = 'done'
      activeSurface = undefined
    }
  }

  const zoomInTarget = () => {
    if (phase === 'cancelled') return

    const targetSurface = resolveSurface(request.slideId)
    if (!targetSurface) {
      cancel()
      return
    }

    phase = 'zoom-in'
    activeSurface = targetSurface
    api.scrollToContent(targetSurface, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
    schedule(CAMERA_ZOOM_IN_DURATION, finish)
  }

  const travelToTarget = () => {
    if (phase === 'cancelled') return

    const targetSurface = resolveSurface(request.slideId)
    if (!targetSurface) {
      cancel()
      return
    }

    phase = 'travel'
    activeSurface = targetSurface
    api.scrollToContent(targetSurface, {
      animate: true,
      duration: CAMERA_TRAVEL_DURATION,
    })
    schedule(CAMERA_TRAVEL_DURATION, zoomInTarget)
  }

  const reconcileScene = () => {
    if (phase !== 'zoom-in') return

    const targetSurface = resolveSurface(request.slideId)
    if (!targetSurface) {
      cancel()
      return
    }

    // A successful compile may replace the target geometry while Excalidraw's
    // final RAF is still interpolating toward a numeric endpoint derived from
    // the previous scene. Restart only the terminal framing from the current
    // interpolated viewport against the latest target object.
    activeSurface = targetSurface
    api.scrollToContent(targetSurface, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
    schedule(CAMERA_ZOOM_IN_DURATION, finish)
  }

  const controller: CameraTransitionController = {
    cancel,
    reconcileScene,
  }

  if (request.fromSlideId === request.slideId) {
    zoomInTarget()
    return controller
  }

  // Avoid moving away from the current viewport when the destination is absent.
  // Target phases still resolve again so source recompiles cannot leave stale
  // Excalidraw element objects queued in the choreography.
  if (!resolveSurface(request.slideId)) return controller

  if (!request.fromSlideId) {
    travelToTarget()
    return controller
  }

  const sourceSurface = resolveSurface(request.fromSlideId)
  if (!sourceSurface) {
    travelToTarget()
    return controller
  }

  phase = 'zoom-out'
  activeSurface = sourceSurface
  api.scrollToContent(sourceSurface, {
    fitToViewport: true,
    viewportZoomFactor: CAMERA_ZOOM_OUT_FACTOR,
    animate: true,
    duration: CAMERA_ZOOM_OUT_DURATION,
  })
  schedule(CAMERA_ZOOM_OUT_DURATION, travelToTarget)

  return controller
}
