import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types'

export interface CanvasFocusRequest {
  revision: number
  slideId: string
  fromSlideId?: string
}

export interface CameraTransitionController {
  cancel(): void
  reconcileScene(): void
}

export const CAMERA_TARGET_ZOOM_FACTOR = 0.85
export const CAMERA_ZOOM_OUT_FACTOR = 0.55
export const CAMERA_ZOOM_OUT_DURATION = 220
export const CAMERA_TRAVEL_DURATION = 340
export const CAMERA_ZOOM_IN_DURATION = 220

export function replaceMountedFiles(
  api: ExcalidrawImperativeAPI,
  files: BinaryFiles,
): void {
  const mounted = api.getFiles()
  for (const fileId of Object.keys(mounted)) {
    if (!(fileId in files)) delete mounted[fileId]
  }
  api.addFiles(Object.values(files))
}

export function runCameraTransition(
  api: ExcalidrawImperativeAPI,
  request: CanvasFocusRequest,
): CameraTransitionController {
  type Phase = 'zoom-out' | 'travel' | 'zoom-in' | 'done' | 'cancelled'
  type SceneElement = ReturnType<ExcalidrawImperativeAPI['getSceneElements']>[number]
  let phase: Phase = 'done'
  let pendingTimer: ReturnType<typeof setTimeout> | undefined
  let pendingAnimationFrame: number | undefined
  let activeSurface: SceneElement | undefined

  const clearPending = () => {
    if (pendingTimer !== undefined) clearTimeout(pendingTimer)
    if (pendingAnimationFrame !== undefined) cancelAnimationFrame(pendingAnimationFrame)
    pendingTimer = undefined
    pendingAnimationFrame = undefined
  }
  const resolveSurface = (slideId: string) =>
    api.getSceneElements().find(element => element.id === `slide:${slideId}/surface`)
  const interrupt = () => {
    if (!activeSurface) return
    const { scrollX, scrollY, zoom } = api.getAppState()
    api.scrollToContent(activeSurface, { animate: false })
    api.updateScene({ appState: { scrollX, scrollY, zoom } })
  }
  const cancel = () => {
    if (phase === 'cancelled' || phase === 'done') return
    phase = 'cancelled'
    clearPending()
    interrupt()
  }
  const after = (duration: number, next: () => void) => {
    clearPending()
    pendingAnimationFrame = requestAnimationFrame(() => {
      pendingAnimationFrame = undefined
      if (phase === 'cancelled') return
      pendingTimer = setTimeout(() => {
        pendingTimer = undefined
        if (phase === 'cancelled') return
        pendingAnimationFrame = requestAnimationFrame(() => {
          pendingAnimationFrame = undefined
          if (phase !== 'cancelled') next()
        })
      }, duration)
    })
  }
  const finish = () => {
    if (phase === 'cancelled') return
    phase = 'done'
    activeSurface = undefined
  }
  const zoomIn = () => {
    const target = resolveSurface(request.slideId)
    if (!target || phase === 'cancelled') return cancel()
    phase = 'zoom-in'
    activeSurface = target
    api.scrollToContent(target, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
    after(CAMERA_ZOOM_IN_DURATION, finish)
  }
  const travel = () => {
    const target = resolveSurface(request.slideId)
    if (!target || phase === 'cancelled') return cancel()
    phase = 'travel'
    activeSurface = target
    api.scrollToContent(target, {
      animate: true,
      duration: CAMERA_TRAVEL_DURATION,
    })
    after(CAMERA_TRAVEL_DURATION, zoomIn)
  }
  const reconcileScene = () => {
    if (phase !== 'zoom-in') return
    const target = resolveSurface(request.slideId)
    if (!target) return cancel()
    activeSurface = target
    api.scrollToContent(target, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
    after(CAMERA_ZOOM_IN_DURATION, finish)
  }

  const controller = { cancel, reconcileScene }
  if (request.fromSlideId === request.slideId) {
    zoomIn()
    return controller
  }
  if (!resolveSurface(request.slideId)) return controller
  if (!request.fromSlideId) {
    travel()
    return controller
  }
  const source = resolveSurface(request.fromSlideId)
  if (!source) {
    travel()
    return controller
  }
  phase = 'zoom-out'
  activeSurface = source
  api.scrollToContent(source, {
    fitToViewport: true,
    viewportZoomFactor: CAMERA_ZOOM_OUT_FACTOR,
    animate: true,
    duration: CAMERA_ZOOM_OUT_DURATION,
  })
  after(CAMERA_ZOOM_OUT_DURATION, travel)
  return controller
}
